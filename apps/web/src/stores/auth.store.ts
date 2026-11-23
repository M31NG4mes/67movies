import { create } from 'zustand';

const PROD_API_FALLBACK = 'https://six7movies-api.onrender.com/api';
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000/api'
      : PROD_API_FALLBACK
    : process.env.NODE_ENV === 'production'
    ? PROD_API_FALLBACK
    : 'http://localhost:4000/api');

const STORAGE_KEY = '67movies_auth_v1';
const PROFILES_STORAGE_KEY = '67movies_profiles_v1';
const COOKIE_KEY = '67movies_auth_cookie';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AccountProfile {
  id: string;
  name: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  isKidsMode?: boolean;
  language?: string;
}

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  profiles: AccountProfile[];
  activeProfileId: string | null;
  rememberDevice: boolean;
  hydrated: boolean;

  hydrate: () => void;
  setSession: (data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    profiles?: AccountProfile[];
    rememberDevice?: boolean;
  }) => void;
  setProfiles: (profiles: AccountProfile[]) => void;
  setActiveProfileId: (id: string) => void;
  logout: () => Promise<void>;
}

/**
 * Strips nested `profiles` or `settings` arrays from the `user` object so the core auth JSON
 * stays tiny (< 500 bytes) and never triggers localStorage QuotaExceededError.
 */
function slimUser(u: any): AuthUser | null {
  if (!u || typeof u !== 'object' || !u.id) return null;
  return {
    id: String(u.id),
    email: String(u.email || ''),
    name: String(u.name || 'Пользователь'),
    role: String(u.role || 'USER'),
  };
}

function writeAuthCookie(payload: {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  activeProfileId: string | null;
  rememberDevice: boolean;
}) {
  if (typeof document === 'undefined') return;
  try {
    if (!payload.accessToken || !payload.user) {
      document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
      return;
    }
    const encoded = encodeURIComponent(JSON.stringify(payload));
    document.cookie = `${COOKIE_KEY}=${encoded}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    // ignore cookie errors
  }
}

function readAuthCookie(): any | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${COOKIE_KEY}=`));
    if (!match) return null;
    const val = match.split('=').slice(1).join('=');
    return JSON.parse(decodeURIComponent(val));
  } catch {
    return null;
  }
}

function saveProfilesToStorage(profiles: AccountProfile[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // If base64 avatar/banner exceeds localStorage 5MB quota, save slimmed profiles without oversized base64
    try {
      const slimProfiles = profiles.map((p) => ({
        ...p,
        avatarUrl:
          p.avatarUrl && p.avatarUrl.length > 250_000 ? null : p.avatarUrl,
        bannerUrl:
          p.bannerUrl && p.bannerUrl.length > 250_000 ? null : p.bannerUrl,
      }));
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(slimProfiles));
    } catch {
      // ignore
    }
  }
}

function readProfilesFromStorage(fallbackProfiles?: AccountProfile[]): AccountProfile[] {
  if (typeof window === 'undefined') return fallbackProfiles || [];
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return Array.isArray(fallbackProfiles) ? fallbackProfiles : [];
}

function saveToStorage(
  state: {
    user: AuthUser | null;
    accessToken: string | null;
    refreshToken: string | null;
    profiles: AccountProfile[];
    activeProfileId: string | null;
  },
  rememberDevice = true
) {
  if (typeof window === 'undefined') return;
  const cleanUser = slimUser(state.user);

  if (!state.accessToken || !cleanUser) {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PROFILES_STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    writeAuthCookie({
      user: null,
      accessToken: null,
      refreshToken: null,
      activeProfileId: null,
      rememberDevice: true,
    });
    return;
  }

  const corePayload = {
    user: cleanUser,
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    activeProfileId: state.activeProfileId,
    rememberDevice,
  };
  const coreSerialized = JSON.stringify(corePayload);

  // 1. Always write tiny core payload to cookie, sessionStorage, and localStorage
  writeAuthCookie(corePayload);
  try {
    sessionStorage.setItem(STORAGE_KEY, coreSerialized);
  } catch {}

  try {
    localStorage.setItem(STORAGE_KEY, coreSerialized);
  } catch {
    // Free up space from old oversized profile cache and retry saving the core token
    try {
      localStorage.removeItem(PROFILES_STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, coreSerialized);
    } catch {}
  }

  // 2. Save profiles in their own isolated storage key
  if (Array.isArray(state.profiles) && state.profiles.length > 0) {
    saveProfilesToStorage(state.profiles);
  }
}

function readFromStorage(): {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  profiles: AccountProfile[];
  activeProfileId: string | null;
  rememberDevice: boolean;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const localRaw = localStorage.getItem(STORAGE_KEY);
    const sessionRaw = sessionStorage.getItem(STORAGE_KEY);
    let parsed: any = null;

    if (localRaw) {
      try {
        parsed = JSON.parse(localRaw);
      } catch {}
    }
    if ((!parsed || !parsed.accessToken) && sessionRaw) {
      try {
        parsed = JSON.parse(sessionRaw);
      } catch {}
    }
    if (!parsed || !parsed.accessToken) {
      parsed = readAuthCookie();
    }

    if (!parsed || !parsed.accessToken) return null;

    const cleanUser = slimUser(parsed.user);
    const legacyProfiles = Array.isArray(parsed.profiles)
      ? parsed.profiles
      : Array.isArray(parsed.user?.profiles)
      ? parsed.user.profiles
      : [];
    const profiles = readProfilesFromStorage(legacyProfiles);
    const activeProfileId = parsed.activeProfileId || profiles?.[0]?.id || null;
    const rememberDevice = parsed.rememberDevice ?? true;

    const result = {
      user: cleanUser,
      accessToken: String(parsed.accessToken),
      refreshToken: parsed.refreshToken ? String(parsed.refreshToken) : null,
      profiles,
      activeProfileId,
      rememberDevice,
    };

    // Migrate / re-sync slim core payload so future refreshes are instant
    saveToStorage(result, rememberDevice);
    return result;
  } catch {
    return null;
  }
}

const initialStored = typeof window !== 'undefined' ? readFromStorage() : null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: initialStored?.user ?? null,
  accessToken: initialStored?.accessToken ?? null,
  refreshToken: initialStored?.refreshToken ?? null,
  profiles: initialStored?.profiles ?? [],
  activeProfileId: initialStored?.activeProfileId ?? null,
  rememberDevice: initialStored?.rememberDevice ?? true,
  hydrated: typeof window !== 'undefined',

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const current = get();
    if (current.accessToken && current.user) {
      if (!current.hydrated) set({ hydrated: true });
      return;
    }
    const stored = readFromStorage();
    if (stored) {
      set({
        ...stored,
        hydrated: true,
      });
      return;
    }
    set({ hydrated: true });
  },

  setSession: ({ user, accessToken, refreshToken, profiles, rememberDevice }) => {
    const cleanUser = slimUser(user) || get().user;
    const incomingProfiles =
      profiles && profiles.length > 0
        ? profiles
        : Array.isArray((user as any)?.profiles) && (user as any).profiles.length > 0
        ? (user as any).profiles
        : get().profiles;
    const activeProfileId = get().activeProfileId || incomingProfiles?.[0]?.id || null;
    const nextRemember = rememberDevice ?? get().rememberDevice ?? true;
    const next = {
      user: cleanUser,
      accessToken,
      refreshToken,
      profiles: incomingProfiles,
      activeProfileId,
    };
    saveToStorage(next, nextRemember);
    set({ ...next, rememberDevice: nextRemember, hydrated: true });
  },

  setProfiles: (profiles) => {
    const currentActive = get().activeProfileId;
    const activeProfileId =
      profiles.find((p) => p.id === currentActive)?.id || profiles[0]?.id || null;
    const next = {
      user: get().user,
      accessToken: get().accessToken,
      refreshToken: get().refreshToken,
      profiles,
      activeProfileId,
    };
    saveToStorage(next, get().rememberDevice);
    set({ profiles, activeProfileId });
  },

  setActiveProfileId: (id) => {
    const next = {
      user: get().user,
      accessToken: get().accessToken,
      refreshToken: get().refreshToken,
      profiles: get().profiles,
      activeProfileId: id,
    };
    saveToStorage(next, get().rememberDevice);
    set({ activeProfileId: id });
  },

  logout: async () => {
    const { accessToken, refreshToken } = get();
    if (accessToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // ignore network errors on logout
      }
    }
    saveToStorage({
      user: null,
      accessToken: null,
      refreshToken: null,
      profiles: [],
      activeProfileId: null,
    });
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      profiles: [],
      activeProfileId: null,
    });
  },
}));

// Singleton refresh mutex so concurrent 401 responses share a single token refresh call
let inflightRefreshPromise: Promise<string | null> | null = null;

/**
 * Authenticated fetch wrapper with deduplicated refresh-token rotation on 401.
 * Never force-logs out the user on background refresh failures so page reloads always keep the session.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let store = useAuthStore.getState();
  if ((!store.hydrated || !store.accessToken) && typeof window !== 'undefined') {
    store.hydrate();
    store = useAuthStore.getState();
  }

  const makeRequest = (token: string | null) =>
    fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await makeRequest(store.accessToken);

  if (res.status === 401 && store.refreshToken) {
    try {
      if (!inflightRefreshPromise) {
        inflightRefreshPromise = (async () => {
          try {
            const currentStore = useAuthStore.getState();
            const refRes = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: currentStore.refreshToken }),
            });
            if (refRes.ok) {
              const refData = await refRes.json();
              currentStore.setSession({
                user: refData.user || currentStore.user!,
                accessToken: refData.accessToken,
                refreshToken: refData.refreshToken,
                rememberDevice: currentStore.rememberDevice,
              });
              return refData.accessToken as string;
            }
            return null;
          } catch {
            return null;
          } finally {
            inflightRefreshPromise = null;
          }
        })();
      }

      const newAccessToken = await inflightRefreshPromise;
      if (newAccessToken) {
        res = await makeRequest(newAccessToken);
      }
    } catch {
      // keep original response without logging out user
    }
  }

  return res;
}

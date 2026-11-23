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
    const raw = localRaw || sessionRaw;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.accessToken) return null;
    // Ensure localStorage always has a copy so page refresh never loses login
    if (!localRaw && sessionRaw) {
      localStorage.setItem(STORAGE_KEY, sessionRaw);
    }
    return {
      user: parsed.user || null,
      accessToken: parsed.accessToken || null,
      refreshToken: parsed.refreshToken || null,
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      activeProfileId: parsed.activeProfileId || parsed.profiles?.[0]?.id || null,
      rememberDevice: parsed.rememberDevice ?? true,
    };
  } catch {
    return null;
  }
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
  try {
    if (!state.accessToken) {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      const serialized = JSON.stringify({ ...state, rememberDevice });
      // Always persist to localStorage so page refresh (F5) and browser restart keep the user signed in
      localStorage.setItem(STORAGE_KEY, serialized);
      sessionStorage.setItem(STORAGE_KEY, serialized);
    }
  } catch {
    // ignore storage errors
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
  hydrated: typeof window !== 'undefined' && initialStored !== null,

  hydrate: () => {
    if (typeof window === 'undefined') return;
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
    const nextProfiles = profiles || get().profiles;
    const activeProfileId = get().activeProfileId || nextProfiles?.[0]?.id || null;
    const nextRemember = rememberDevice ?? get().rememberDevice ?? true;
    const next = { user, accessToken, refreshToken, profiles: nextProfiles, activeProfileId };
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
  if (!store.hydrated && typeof window !== 'undefined') {
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

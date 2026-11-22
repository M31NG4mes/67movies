import { create } from 'zustand';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
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
  hydrated: boolean;

  hydrate: () => void;
  setSession: (data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    profiles?: AccountProfile[];
  }) => void;
  setProfiles: (profiles: AccountProfile[]) => void;
  setActiveProfileId: (id: string) => void;
  logout: () => Promise<void>;
}

function saveToStorage(state: {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  profiles: AccountProfile[];
  activeProfileId: string | null;
}) {
  if (typeof window === 'undefined') return;
  try {
    if (!state.accessToken) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore storage errors
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  profiles: [],
  activeProfileId: null,
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined' || get().hydrated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          user: parsed.user || null,
          accessToken: parsed.accessToken || null,
          refreshToken: parsed.refreshToken || null,
          profiles: parsed.profiles || [],
          activeProfileId: parsed.activeProfileId || parsed.profiles?.[0]?.id || null,
          hydrated: true,
        });
        return;
      }
    } catch {
      // ignore invalid JSON
    }
    set({ hydrated: true });
  },

  setSession: ({ user, accessToken, refreshToken, profiles }) => {
    const nextProfiles = profiles || get().profiles;
    const activeProfileId = get().activeProfileId || nextProfiles?.[0]?.id || null;
    const next = { user, accessToken, refreshToken, profiles: nextProfiles, activeProfileId };
    saveToStorage(next);
    set({ ...next, hydrated: true });
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
    saveToStorage(next);
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
    saveToStorage(next);
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

/**
 * Authenticated fetch wrapper with automatic refresh-token rotation on 401.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const store = useAuthStore.getState();
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
      const refRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: store.refreshToken }),
      });

      if (refRes.ok) {
        const refData = await refRes.json();
        store.setSession({
          user: refData.user || store.user!,
          accessToken: refData.accessToken,
          refreshToken: refData.refreshToken,
        });
        res = await makeRequest(refData.accessToken);
      } else {
        await store.logout();
      }
    } catch {
      // keep original 401
    }
  }

  return res;
}

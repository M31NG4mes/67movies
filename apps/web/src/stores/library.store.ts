import { create } from 'zustand';
import { MediaItem } from '@cinemaflow/types';

export interface LibraryEntry {
  id: string;
  tmdbId: number;
  type: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  releaseYear?: number;
  voteAverage?: number;
  addedAt: string;
  aliases?: string[];
}

const WATCHLIST_KEY = '67movies_watchlist_v1';
const FAVORITES_KEY = '67movies_favorites_v1';
const HISTORY_KEY = '67movies_history_v1';

type MediaInput = Partial<MediaItem> & {
  id: string | number;
  title: string;
  routeId?: string;
};

function getNumericId(item: MediaInput): number {
  if (item.tmdbId && Number.isFinite(Number(item.tmdbId))) {
    return Number(item.tmdbId);
  }
  const raw = String(item.routeId || item.id || '').trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const kp = /^kp-(\d+)$/i.exec(raw);
  if (kp) return 1_000_000_000 + (Number(kp[1]) % 200_000_000);
  const mal = /^mal-(\d+)$/i.exec(raw);
  if (mal) return 1_200_000_000 + (Number(mal[1]) % 200_000_000);
  const tvm = /^tvmaze-(\d+)$/i.exec(raw);
  if (tvm) return 1_400_000_000 + (Number(tvm[1]) % 200_000_000);
  const omdb = /^(?:omdb-)?tt(\d+)$/i.exec(raw);
  if (omdb) return 1_600_000_000 + (Number(omdb[1]) % 200_000_000);
  const al = /^al-(\d+)$/i.exec(raw);
  if (al) return 1_800_000_000 + (Number(al[1]) % 200_000_000);
  if (item.anilibertyId) return 1_800_000_000 + (Number(item.anilibertyId) % 200_000_000);
  if (item.kinopoiskId) return 1_000_000_000 + (Number(item.kinopoiskId) % 200_000_000);
  return 0;
}

function buildAliases(item: MediaInput): string[] {
  const set = new Set<string>();
  const add = (v?: string | number | null) => {
    if (v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== '0') {
      set.add(String(v).trim().toLowerCase());
    }
  };
  add(item.routeId);
  add(item.id);
  add(item.tmdbId);
  const numId = getNumericId(item);
  if (numId) add(numId);
  if (item.anilibertyId) add(`al-${item.anilibertyId}`);
  if (item.malId) add(`mal-${item.malId}`);
  if (item.kinopoiskId) add(`kp-${item.kinopoiskId}`);
  return Array.from(set);
}

function buildCanonicalRouteId(item: MediaInput): string {
  if (item.routeId && String(item.routeId).trim()) {
    return String(item.routeId).trim();
  }
  const rawId = String(item.id || '').trim();
  if (/^(al|mal|kp|tvmaze|omdb)-/i.test(rawId)) {
    return rawId;
  }
  if (item.anilibertyId) {
    return `al-${item.anilibertyId}`;
  }
  if (item.tmdbId) {
    return String(item.tmdbId);
  }
  return rawId;
}

function toLibraryEntry(item: MediaInput): LibraryEntry {
  return {
    id: buildCanonicalRouteId(item),
    tmdbId: getNumericId(item),
    type: item.type === 'tv' ? 'tv' : 'movie',
    title: item.title,
    posterPath: item.posterPath || item.backdropPath || null,
    releaseYear: item.releaseYear,
    voteAverage: item.voteAverage,
    addedAt: new Date().toISOString(),
    aliases: buildAliases(item),
  };
}

function entryMatchesTarget(entry: LibraryEntry, target: string | number | MediaInput): boolean {
  const entryKeys = new Set<string>();
  if (entry.id) entryKeys.add(String(entry.id).toLowerCase());
  if (entry.tmdbId) entryKeys.add(String(entry.tmdbId).toLowerCase());
  if (Array.isArray(entry.aliases)) {
    for (const a of entry.aliases) {
      if (a) entryKeys.add(String(a).toLowerCase());
    }
  }

  if (typeof target === 'string' || typeof target === 'number') {
    const key = String(target).trim().toLowerCase();
    return Boolean(key) && entryKeys.has(key);
  }

  const candidateKeys = buildAliases(target);
  return candidateKeys.some((k) => entryKeys.has(k));
}

function readList(key: string): LibraryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(key: string, val: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

interface LibraryStore {
  watchlist: LibraryEntry[];
  favorites: LibraryEntry[];
  history: LibraryEntry[];
  hydrated: boolean;

  hydrate: () => void;
  toggleWatchlist: (item: MediaInput) => boolean;
  isInWatchlist: (target: string | number | MediaInput) => boolean;
  removeFromWatchlist: (target: string | number) => void;
  toggleFavorite: (item: MediaInput) => boolean;
  setFavoriteState: (item: MediaInput, isFav: boolean) => void;
  isInFavorites: (target: string | number | MediaInput) => boolean;
  removeFromFavorites: (target: string | number) => void;
  addToHistory: (item: MediaInput) => void;
  removeFromHistory: (target: string | number) => void;
  clearHistory: () => void;
}

const initialWatchlist = typeof window !== 'undefined' ? readList(WATCHLIST_KEY) : [];
const initialFavorites = typeof window !== 'undefined' ? readList(FAVORITES_KEY) : [];
const initialHistory = typeof window !== 'undefined' ? readList(HISTORY_KEY) : [];

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  watchlist: initialWatchlist,
  favorites: initialFavorites,
  history: initialHistory,
  hydrated: typeof window !== 'undefined',

  hydrate: () => {
    if (typeof window === 'undefined') return;
    set({
      watchlist: readList(WATCHLIST_KEY),
      favorites: readList(FAVORITES_KEY),
      history: readList(HISTORY_KEY),
      hydrated: true,
    });
  },

  toggleWatchlist: (item) => {
    const current = get().hydrated ? get().watchlist : readList(WATCHLIST_KEY);
    const exists = current.some((x) => entryMatchesTarget(x, item));
    const next = exists
      ? current.filter((x) => !entryMatchesTarget(x, item))
      : [toLibraryEntry(item), ...current];
    save(WATCHLIST_KEY, next);
    set({ watchlist: next, hydrated: true });
    return !exists;
  },

  isInWatchlist: (target) => {
    return get().watchlist.some((x) => entryMatchesTarget(x, target));
  },

  removeFromWatchlist: (target) => {
    const current = get().hydrated ? get().watchlist : readList(WATCHLIST_KEY);
    const next = current.filter((x) => !entryMatchesTarget(x, target));
    save(WATCHLIST_KEY, next);
    set({ watchlist: next, hydrated: true });
  },

  toggleFavorite: (item) => {
    const current = get().hydrated ? get().favorites : readList(FAVORITES_KEY);
    const exists = current.some((x) => entryMatchesTarget(x, item));
    const next = exists
      ? current.filter((x) => !entryMatchesTarget(x, item))
      : [toLibraryEntry(item), ...current];
    save(FAVORITES_KEY, next);
    set({ favorites: next, hydrated: true });
    return !exists;
  },

  setFavoriteState: (item, isFav) => {
    const current = get().hydrated ? get().favorites : readList(FAVORITES_KEY);
    const filtered = current.filter((x) => !entryMatchesTarget(x, item));
    const next = isFav ? [toLibraryEntry(item), ...filtered] : filtered;
    save(FAVORITES_KEY, next);
    set({ favorites: next, hydrated: true });
  },

  isInFavorites: (target) => {
    return get().favorites.some((x) => entryMatchesTarget(x, target));
  },

  removeFromFavorites: (target) => {
    const current = get().hydrated ? get().favorites : readList(FAVORITES_KEY);
    const next = current.filter((x) => !entryMatchesTarget(x, target));
    save(FAVORITES_KEY, next);
    set({ favorites: next, hydrated: true });
  },

  addToHistory: (item) => {
    const current = get().hydrated ? get().history : readList(HISTORY_KEY);
    const filtered = current.filter((x) => !entryMatchesTarget(x, item));
    const next = [toLibraryEntry(item), ...filtered].slice(0, 60);
    save(HISTORY_KEY, next);
    set({ history: next, hydrated: true });
  },

  removeFromHistory: (target) => {
    const current = get().hydrated ? get().history : readList(HISTORY_KEY);
    const next = current.filter((x) => !entryMatchesTarget(x, target));
    save(HISTORY_KEY, next);
    set({ history: next, hydrated: true });
  },

  clearHistory: () => {
    save(HISTORY_KEY, []);
    set({ history: [], hydrated: true });
  },
}));

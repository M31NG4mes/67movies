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
}

const WATCHLIST_KEY = '67movies_watchlist_v1';
const HISTORY_KEY = '67movies_history_v1';

interface LibraryStore {
  watchlist: LibraryEntry[];
  history: LibraryEntry[];
  hydrated: boolean;

  hydrate: () => void;
  toggleWatchlist: (item: Partial<MediaItem> & { id: string | number; title: string }) => boolean;
  isInWatchlist: (id: string | number) => boolean;
  removeFromWatchlist: (id: string | number) => void;
  addToHistory: (item: Partial<MediaItem> & { id: string | number; title: string }) => void;
  removeFromHistory: (id: string | number) => void;
  clearHistory: () => void;
}

function save(key: string, val: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  watchlist: [],
  history: [],
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined' || get().hydrated) return;
    let watchlist: LibraryEntry[] = [];
    let history: LibraryEntry[] = [];
    try {
      const w = localStorage.getItem(WATCHLIST_KEY);
      if (w) watchlist = JSON.parse(w);
    } catch {}
    try {
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) history = JSON.parse(h);
    } catch {}
    set({ watchlist, history, hydrated: true });
  },

  toggleWatchlist: (item) => {
    const idStr = String(item.tmdbId || item.id);
    const exists = get().watchlist.some((x) => String(x.id) === idStr);
    let next: LibraryEntry[];
    if (exists) {
      next = get().watchlist.filter((x) => String(x.id) !== idStr);
    } else {
      const entry: LibraryEntry = {
        id: idStr,
        tmdbId: Number(item.tmdbId || item.id) || 0,
        type: item.type === 'tv' ? 'tv' : 'movie',
        title: item.title,
        posterPath: item.posterPath || item.backdropPath || null,
        releaseYear: item.releaseYear,
        voteAverage: item.voteAverage,
        addedAt: new Date().toISOString(),
      };
      next = [entry, ...get().watchlist];
    }
    save(WATCHLIST_KEY, next);
    set({ watchlist: next });
    return !exists;
  },

  isInWatchlist: (id) => {
    const idStr = String(id);
    return get().watchlist.some((x) => String(x.id) === idStr);
  },

  removeFromWatchlist: (id) => {
    const idStr = String(id);
    const next = get().watchlist.filter((x) => String(x.id) !== idStr);
    save(WATCHLIST_KEY, next);
    set({ watchlist: next });
  },

  addToHistory: (item) => {
    const idStr = String(item.tmdbId || item.id);
    const entry: LibraryEntry = {
      id: idStr,
      tmdbId: Number(item.tmdbId || item.id) || 0,
      type: item.type === 'tv' ? 'tv' : 'movie',
      title: item.title,
      posterPath: item.posterPath || item.backdropPath || null,
      releaseYear: item.releaseYear,
      voteAverage: item.voteAverage,
      addedAt: new Date().toISOString(),
    };
    const filtered = get().history.filter((x) => String(x.id) !== idStr);
    const next = [entry, ...filtered].slice(0, 60);
    save(HISTORY_KEY, next);
    set({ history: next });
  },

  removeFromHistory: (id) => {
    const idStr = String(id);
    const next = get().history.filter((x) => String(x.id) !== idStr);
    save(HISTORY_KEY, next);
    set({ history: next });
  },

  clearHistory: () => {
    save(HISTORY_KEY, []);
    set({ history: [] });
  },
}));

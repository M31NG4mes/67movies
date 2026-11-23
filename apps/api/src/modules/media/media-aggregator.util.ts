import { MediaItem, MediaType } from '@cinemaflow/types';

export interface DiscoverProviderOptions {
  type: MediaType;
  category?: string;
  genreId?: number;
  page: number;
  sort: 'popularity' | 'rating' | 'date' | 'votes';
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  originalLanguage?: string;
}

export interface ParsedMediaId {
  provider: 'tmdb' | 'kinopoisk' | 'anime' | 'tvmaze' | 'omdb' | 'aniliberty';
  rawId: string;
}

export function parsePrefixedMediaId(id: string): ParsedMediaId {
  const trimmed = String(id || '').trim();
  if (/^al-\d+$/i.test(trimmed)) {
    return { provider: 'aniliberty', rawId: trimmed.slice(3) };
  }
  if (/^kp-\d+$/i.test(trimmed)) {
    return { provider: 'kinopoisk', rawId: trimmed.slice(3) };
  }
  if (/^mal-\d+$/i.test(trimmed)) {
    return { provider: 'anime', rawId: trimmed.slice(4) };
  }
  if (/^tvmaze-\d+$/i.test(trimmed)) {
    return { provider: 'tvmaze', rawId: trimmed.slice(7) };
  }
  if (/^omdb-tt\d+$/i.test(trimmed)) {
    return { provider: 'omdb', rawId: trimmed.slice(5) };
  }
  if (/^tt\d+$/i.test(trimmed)) {
    return { provider: 'omdb', rawId: trimmed };
  }
  return { provider: 'tmdb', rawId: trimmed };
}

export function normalizeTitle(title?: string | null): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function stripHtml(input?: string | null): string {
  if (!input) return '';
  return String(input)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlaceholderOverview(overview?: string): boolean {
  if (!overview || overview.trim().length < 15) return true;
  const lower = overview.toLowerCase();
  return (
    lower.includes('описание фильма временно отсутствует') ||
    lower.includes('описание сериала временно отсутствует') ||
    lower.includes('описание отсутствует')
  );
}

export function isValidPosterUrl(url?: string | null): boolean {
  if (!url) return false;
  const s = String(url).trim();
  if (!/^https?:\/\//i.test(s)) return false;
  const lower = s.toLowerCase();
  if (
    lower.includes('no-poster') ||
    lower.includes('missing_original') ||
    lower.includes('shikimori.one/system/')
  ) {
    return false;
  }
  return true;
}

function enrichItem(target: MediaItem, incoming: MediaItem): void {
  if (!target.anilibertyId && incoming.anilibertyId) {
    target.anilibertyId = incoming.anilibertyId;
  }
  if (!target.tmdbId && incoming.tmdbId && target.source !== 'aniliberty') {
    target.tmdbId = incoming.tmdbId;
  }
  if (!target.imdbId && incoming.imdbId) target.imdbId = incoming.imdbId;
  if (!target.kinopoiskId && incoming.kinopoiskId) target.kinopoiskId = incoming.kinopoiskId;
  if (!target.malId && incoming.malId) target.malId = incoming.malId;
  if (!target.tvmazeId && incoming.tvmazeId) target.tvmazeId = incoming.tvmazeId;
  if (!isValidPosterUrl(target.posterPath) && isValidPosterUrl(incoming.posterPath)) {
    target.posterPath = incoming.posterPath;
  }
  if (!isValidPosterUrl(target.backdropPath) && isValidPosterUrl(incoming.backdropPath)) {
    target.backdropPath = incoming.backdropPath;
  }
  if (!target.originalTitle && incoming.originalTitle) target.originalTitle = incoming.originalTitle;
  if (!target.durationMinutes && incoming.durationMinutes) {
    target.durationMinutes = incoming.durationMinutes;
  }
  if (!target.releaseDate && incoming.releaseDate) target.releaseDate = incoming.releaseDate;
  if ((!target.voteAverage || target.voteAverage <= 0) && incoming.voteAverage > 0) {
    target.voteAverage = incoming.voteAverage;
  }
  if ((!target.voteCount || target.voteCount <= 0) && incoming.voteCount && incoming.voteCount > 0) {
    target.voteCount = incoming.voteCount;
  }
  if (isPlaceholderOverview(target.overview) && !isPlaceholderOverview(incoming.overview)) {
    target.overview = incoming.overview;
  }
  if ((!target.genres || target.genres.length === 0) && incoming.genres?.length > 0) {
    target.genres = incoming.genres;
  }
}

function computeSearchRelevance(item: MediaItem, queryNorm: string): number {
  const titleNorm = normalizeTitle(item.title);
  const origNorm = normalizeTitle(item.originalTitle);
  let score = 0;

  if (titleNorm === queryNorm || origNorm === queryNorm) {
    score += 100;
  } else if (titleNorm.startsWith(queryNorm) || origNorm.startsWith(queryNorm)) {
    score += 65;
  } else if (titleNorm.includes(queryNorm) || origNorm.includes(queryNorm)) {
    score += 35;
  }

  if (item.posterPath) score += 12;
  if (item.voteAverage > 0) score += Math.min(10, item.voteAverage);
  if (item.voteCount && item.voteCount > 100) score += Math.min(10, Math.log10(item.voteCount) * 2);
  if (item.source === 'tmdb' || item.source === 'kinopoisk') score += 5;

  return score;
}

export function mergeAndDeduplicateMedia(
  primary: MediaItem[],
  secondaryLists: MediaItem[][],
  options?: {
    query?: string;
    sort?: 'popularity' | 'rating' | 'date' | 'votes';
    maxItems?: number;
    requirePoster?: boolean;
  },
): MediaItem[] {
  const merged: MediaItem[] = [];

  const byTmdb = new Map<string, MediaItem>();
  const byImdb = new Map<string, MediaItem>();
  const byKp = new Map<number, MediaItem>();
  const byMal = new Map<number, MediaItem>();
  const byTvMaze = new Map<number, MediaItem>();
  const byTitleBucket = new Map<string, MediaItem[]>();

  const registerKeys = (item: MediaItem) => {
    if (item.tmdbId) byTmdb.set(`${item.type}:${item.tmdbId}`, item);
    if (item.imdbId) byImdb.set(item.imdbId.toLowerCase(), item);
    if (item.kinopoiskId) byKp.set(item.kinopoiskId, item);
    if (item.malId) byMal.set(item.malId, item);
    if (item.tvmazeId) byTvMaze.set(item.tvmazeId, item);

    const names = [normalizeTitle(item.title), normalizeTitle(item.originalTitle)].filter(Boolean);
    for (const name of new Set(names)) {
      const key = `${item.type}:${name}`;
      const bucket = byTitleBucket.get(key) || [];
      if (!bucket.includes(item)) {
        bucket.push(item);
        byTitleBucket.set(key, bucket);
      }
    }
  };

  const findDuplicate = (incoming: MediaItem): MediaItem | undefined => {
    if (incoming.tmdbId) {
      const hit = byTmdb.get(`${incoming.type}:${incoming.tmdbId}`);
      if (hit) return hit;
    }
    if (incoming.imdbId) {
      const hit = byImdb.get(incoming.imdbId.toLowerCase());
      if (hit) return hit;
    }
    if (incoming.kinopoiskId) {
      const hit = byKp.get(incoming.kinopoiskId);
      if (hit) return hit;
    }
    if (incoming.malId) {
      const hit = byMal.get(incoming.malId);
      if (hit) return hit;
    }
    if (incoming.tvmazeId) {
      const hit = byTvMaze.get(incoming.tvmazeId);
      if (hit) return hit;
    }

    const names = [normalizeTitle(incoming.title), normalizeTitle(incoming.originalTitle)].filter(Boolean);
    for (const name of names) {
      const bucket = byTitleBucket.get(`${incoming.type}:${name}`);
      if (!bucket) continue;
      for (const existing of bucket) {
        if (!existing.releaseYear || !incoming.releaseYear) {
          return existing;
        }
        if (Math.abs(existing.releaseYear - incoming.releaseYear) <= 1) {
          return existing;
        }
      }
    }
    return undefined;
  };

  const addItem = (raw: MediaItem) => {
    if (!raw || !raw.title || !raw.title.trim()) return;
    const item: MediaItem = { ...raw };
    if (!isValidPosterUrl(item.posterPath)) {
      item.posterPath = isValidPosterUrl(item.backdropPath) ? item.backdropPath : null;
    }
    const dup = findDuplicate(item);
    if (dup) {
      enrichItem(dup, item);
      registerKeys(dup);
      return;
    }
    if (options?.requirePoster && !isValidPosterUrl(item.posterPath)) {
      return;
    }
    merged.push(item);
    registerKeys(item);
  };

  for (const item of primary) {
    addItem(item);
  }

  // Round-robin interleave across secondary providers so no single source dominates
  const maxLen = secondaryLists.reduce((acc, list) => Math.max(acc, list.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const list of secondaryLists) {
      if (i < list.length) {
        addItem(list[i]);
      }
    }
  }

  if (options?.query) {
    const qNorm = normalizeTitle(options.query);
    if (qNorm) {
      merged.sort((a, b) => computeSearchRelevance(b, qNorm) - computeSearchRelevance(a, qNorm));
    }
  } else if (options?.sort === 'rating') {
    merged.sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));
  } else if (options?.sort === 'date') {
    merged.sort((a, b) => {
      const da = a.releaseDate || `${a.releaseYear || 0}-01-01`;
      const db = b.releaseDate || `${b.releaseYear || 0}-01-01`;
      return db.localeCompare(da);
    });
  } else if (options?.sort === 'votes') {
    merged.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
  }

  if (options?.maxItems && merged.length > options.maxItems) {
    return merged.slice(0, options.maxItems);
  }

  return merged;
}

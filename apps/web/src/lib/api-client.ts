import {
  Genre,
  MediaItem,
  MediaType,
  PaginatedResult,
  PlaybackSyncPayload,
  Season,
  StreamSourceGroup,
  User,
  WatchProgress,
} from '@cinemaflow/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const TMDB_KEY = process.env.TMDB_API_KEY || '9cea7e9e78f99a9f9468c4f74f3d7eab';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const isMutation = options?.method && options.method !== 'GET';
  const fetchInit: RequestInit & { next?: { revalidate?: number | false } } = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  };
  if (!isMutation && options?.cache !== 'no-store') {
    fetchInit.next = { revalidate: 60 };
  }
  const res = await fetch(url, fetchInit);

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Direct server-side TMDB fetcher for Next.js when backend API is offline
 */
async function fetchDirectTmdb<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!TMDB_KEY) return null;
  const sp = new URLSearchParams({
    api_key: TMDB_KEY,
    language: 'ru-RU',
    ...params,
  });

  try {
    const res = await fetch(`https://api.themoviedb.org/3${path}?${sp.toString()}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function mapTmdbToMedia(item: any, type: MediaType): MediaItem {
  const isMovie = type === 'movie';
  const releaseDate = isMovie ? item.release_date : item.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : 2024;

  return {
    id: String(item.id),
    tmdbId: item.id,
    type,
    title: isMovie ? item.title : item.name,
    originalTitle: isMovie ? item.original_title : item.original_name,
    overview: item.overview || 'Описание отсутствует.',
    posterPath: item.poster_path ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}` : null,
    backdropPath: item.backdrop_path ? `${TMDB_IMAGE_BASE}/original${item.backdrop_path}` : null,
    releaseDate,
    releaseYear: isNaN(year) ? 2024 : year,
    voteAverage: Number((item.vote_average || 0).toFixed(1)),
    voteCount: item.vote_count,
    ageRating: item.adult ? '18+' : '16+',
    genres: [],
  };
}

export const api = {
  media: {
    getTrending: async (type: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'day', page = 1) => {
      try {
        return await fetcher<PaginatedResult<MediaItem>>(`/media/trending?type=${type}&timeWindow=${timeWindow}&page=${page}`);
      } catch (err) {
        // Direct TMDB fallback
        const tmdbData: any = await fetchDirectTmdb(`/trending/${type}/${timeWindow}`, { page: String(page) });
        if (tmdbData?.results) {
          return {
            items: tmdbData.results.map((r: any) => mapTmdbToMedia(r, r.media_type === 'tv' ? 'tv' : 'movie')),
            page: tmdbData.page,
            totalPages: tmdbData.total_pages,
            totalItems: tmdbData.total_results,
          };
        }
        throw err;
      }
    },

    getPopularMovies: async (page = 1) => {
      try {
        return await fetcher<PaginatedResult<MediaItem>>(`/media/popular/movies?page=${page}`);
      } catch (err) {
        const tmdbData: any = await fetchDirectTmdb('/movie/popular', { page: String(page) });
        if (tmdbData?.results) {
          return {
            items: tmdbData.results.map((r: any) => mapTmdbToMedia(r, 'movie')),
            page: tmdbData.page,
            totalPages: tmdbData.total_pages,
            totalItems: tmdbData.total_results,
          };
        }
        throw err;
      }
    },

    getPopularTv: async (page = 1) => {
      try {
        return await fetcher<PaginatedResult<MediaItem>>(`/media/popular/tv?page=${page}`);
      } catch (err) {
        const tmdbData: any = await fetchDirectTmdb('/tv/popular', { page: String(page) });
        if (tmdbData?.results) {
          return {
            items: tmdbData.results.map((r: any) => mapTmdbToMedia(r, 'tv')),
            page: tmdbData.page,
            totalPages: tmdbData.total_pages,
            totalItems: tmdbData.total_results,
          };
        }
        throw err;
      }
    },

    getNewMovies: async (page = 1) => {
      try {
        return await fetcher<PaginatedResult<MediaItem>>(`/media/new/movies?page=${page}`);
      } catch (err) {
        const tmdbData: any = await fetchDirectTmdb('/movie/now_playing', { page: String(page) });
        if (tmdbData?.results) {
          return {
            items: tmdbData.results.map((r: any) => mapTmdbToMedia(r, 'movie')),
            page: tmdbData.page,
            totalPages: tmdbData.total_pages,
            totalItems: tmdbData.total_results,
          };
        }
        throw err;
      }
    },

    getNewTv: async (page = 1) => {
      try {
        return await fetcher<PaginatedResult<MediaItem>>(`/media/new/tv?page=${page}`);
      } catch (err) {
        const tmdbData: any = await fetchDirectTmdb('/tv/on_the_air', { page: String(page) });
        if (tmdbData?.results) {
          return {
            items: tmdbData.results.map((r: any) => mapTmdbToMedia(r, 'tv')),
            page: tmdbData.page,
            totalPages: tmdbData.total_pages,
            totalItems: tmdbData.total_results,
          };
        }
        throw err;
      }
    },

    search: async (query: string, page = 1) => {
      try {
        return await fetcher<PaginatedResult<MediaItem>>(`/media/search?q=${encodeURIComponent(query)}&page=${page}`);
      } catch (err) {
        const tmdbData: any = await fetchDirectTmdb('/search/multi', { query, page: String(page) });
        if (tmdbData?.results) {
          return {
            items: tmdbData.results
              .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
              .map((r: any) => mapTmdbToMedia(r, r.media_type)),
            page: tmdbData.page,
            totalPages: tmdbData.total_pages,
            totalItems: tmdbData.total_results,
          };
        }
        throw err;
      }
    },

    getMovieDetails: async (id: string | number) => {
      try {
        return await fetcher<MediaItem>(`/media/movie/${id}`);
      } catch (err) {
        const d: any = await fetchDirectTmdb(`/movie/${id}`, { append_to_response: 'credits' });
        if (d) return mapTmdbToMedia(d, 'movie');
        throw err;
      }
    },

    getTvDetails: async (id: string | number) => {
      try {
        return await fetcher<MediaItem>(`/media/tv/${id}`);
      } catch (err) {
        const d: any = await fetchDirectTmdb(`/tv/${id}`, { append_to_response: 'credits' });
        if (d) return mapTmdbToMedia(d, 'tv');
        throw err;
      }
    },

    getTvSeason: async (tvId: string | number, seasonNumber: number) => {
      try {
        return await fetcher<Season>(`/media/tv/${tvId}/season/${seasonNumber}`);
      } catch (err) {
        const s: any = await fetchDirectTmdb(`/tv/${tvId}/season/${seasonNumber}`);
        if (s) {
          return {
            id: s.id,
            seasonNumber: s.season_number,
            name: s.name,
            overview: s.overview,
            posterPath: s.poster_path ? `${TMDB_IMAGE_BASE}/w500${s.poster_path}` : null,
            airDate: s.air_date,
            episodeCount: s.episodes?.length || 0,
            episodes: s.episodes?.map((e: any) => ({
              id: e.id,
              seasonNumber: e.season_number,
              episodeNumber: e.episode_number,
              name: e.name,
              overview: e.overview,
              stillPath: e.still_path ? `${TMDB_IMAGE_BASE}/w500${e.still_path}` : null,
              durationMinutes: e.runtime || 45,
            })),
          };
        }
        throw err;
      }
    },

    getGenres: async (type: MediaType = 'movie') => {
      try {
        return await fetcher<Genre[]>(`/media/genres?type=${type}`);
      } catch (err) {
        const g: any = await fetchDirectTmdb(`/genre/${type}/list`);
        return g?.genres || [];
      }
    },

    getCalendar: async (year: number, month: number, type: 'all' | 'movie' | 'tv' = 'all') => {
      try {
        return await fetcher<{
          year: number;
          month: number;
          days: Array<{ date: string; items: MediaItem[] }>;
        }>(`/media/calendar?year=${year}&month=${month}&type=${type}`);
      } catch {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const items: MediaItem[] = [];

        if (type === 'all' || type === 'movie') {
          const mRes: any = await fetchDirectTmdb('/discover/movie', {
            'primary_release_date.gte': startDate,
            'primary_release_date.lte': endDate,
            sort_by: 'popularity.desc',
            include_adult: 'false',
            page: '1',
          });
          if (mRes?.results) {
            items.push(...mRes.results.map((m: any) => mapTmdbToMedia(m, 'movie')));
          }
        }
        if (type === 'all' || type === 'tv') {
          const tRes: any = await fetchDirectTmdb('/discover/tv', {
            'first_air_date.gte': startDate,
            'first_air_date.lte': endDate,
            sort_by: 'popularity.desc',
            include_adult: 'false',
            page: '1',
          });
          if (tRes?.results) {
            items.push(...tRes.results.map((t: any) => mapTmdbToMedia(t, 'tv')));
          }
        }

        const grouped: Record<string, MediaItem[]> = {};
        for (const it of items) {
          const d = (it.releaseDate || '').slice(0, 10);
          if (!d) continue;
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push(it);
        }

        return {
          year,
          month,
          days: Object.keys(grouped)
            .sort()
            .map((date) => ({ date, items: grouped[date] })),
        };
      }
    },

    discoverByGenre: async (
      type: MediaType = 'movie',
      genreId?: number,
      page = 1,
      sort: 'popularity' | 'rating' | 'date' | 'votes' = 'popularity',
      extra?: {
        category?: string;
        yearFrom?: number;
        yearTo?: number;
        minRating?: number;
        lang?: string;
      }
    ) => {
      const category = extra?.category || type;
      const isTv = category === 'tv' || category === 'anime' || category === 'dorama';
      const resolvedType: MediaType = isTv ? 'tv' : 'movie';

      try {
        const sp = new URLSearchParams({
          type: resolvedType,
          category,
          sort,
          page: String(page),
        });
        if (genreId && genreId > 0) sp.set('genreId', String(genreId));
        if (extra?.yearFrom) sp.set('yearFrom', String(extra.yearFrom));
        if (extra?.yearTo) sp.set('yearTo', String(extra.yearTo));
        if (extra?.minRating) sp.set('minRating', String(extra.minRating));
        if (extra?.lang) sp.set('lang', extra.lang);
        return await fetcher<PaginatedResult<MediaItem>>(`/media/discover?${sp.toString()}`);
      } catch (err) {
        const today = new Date().toISOString().split('T')[0];
        const sortBy =
          sort === 'rating'
            ? 'vote_average.desc'
            : sort === 'votes'
            ? 'vote_count.desc'
            : sort === 'date'
            ? isTv
              ? 'first_air_date.desc'
              : 'primary_release_date.desc'
            : 'popularity.desc';

        const params: Record<string, string> = {
          sort_by: sortBy,
          include_adult: 'false',
          page: String(page),
        };

        const genreList: number[] = [];
        if (category === 'cartoons' || category === 'anime') genreList.push(16);
        if (category === 'documentary') genreList.push(99);
        if (genreId && genreId > 0 && !genreList.includes(genreId)) genreList.push(genreId);
        if (genreList.length > 0) params.with_genres = genreList.join(',');

        if (category === 'anime') params.with_original_language = 'ja';
        else if (category === 'dorama') params.with_original_language = 'ko';
        else if (extra?.lang) params.with_original_language = extra.lang;

        const dateField = isTv ? 'first_air_date' : 'primary_release_date';
        if (extra?.yearFrom) params[`${dateField}.gte`] = `${extra.yearFrom}-01-01`;
        if (extra?.yearTo) params[`${dateField}.lte`] = `${extra.yearTo}-12-31`;
        else if (sort === 'date') params[`${dateField}.lte`] = today;

        if (extra?.minRating) params['vote_average.gte'] = String(extra.minRating);

        if (sort === 'rating') params['vote_count.gte'] = isTv ? '250' : '500';
        else if (sort === 'date') params['vote_count.gte'] = '15';
        else if (sort === 'popularity') {
          params['vote_count.gte'] =
            category === 'documentary' || category === 'dorama' ? '30' : isTv ? '100' : '200';
        }

        const d: any = await fetchDirectTmdb(`/discover/${resolvedType}`, params);
        if (d?.results) {
          return {
            items: d.results.map((m: any) => mapTmdbToMedia(m, resolvedType)),
            page: d.page,
            totalPages: d.total_pages,
            totalItems: d.total_results,
          };
        }
        throw err;
      }
    },

    getById: async (id: string, type?: MediaType) => {
      try {
        return await fetcher<MediaItem>(`/media/${encodeURIComponent(id)}${type ? `?type=${type}` : ''}`);
      } catch (err) {
        if (/^\d+$/.test(id)) {
          const d: any = await fetchDirectTmdb(type === 'tv' ? `/tv/${id}` : `/movie/${id}`);
          if (d) return mapTmdbToMedia(d, type === 'tv' ? 'tv' : 'movie');
        }
        throw err;
      }
    },
  },

  sources: {
    getStreams: (params: {
      tmdbId: number | string;
      type: MediaType;
      title?: string;
      year?: number;
      season?: number;
      episode?: number;
    }) => {
      const sp = new URLSearchParams({
        tmdbId: String(params.tmdbId),
        type: params.type,
      });
      if (params.title) sp.set('title', params.title);
      if (params.year) sp.set('year', String(params.year));
      if (params.season !== undefined) sp.set('season', String(params.season));
      if (params.episode !== undefined) sp.set('episode', String(params.episode));
      return fetcher<{
        streams: Array<{
          sourceId: string;
          title: string;
          quality: string;
          audio: Array<{ id: string; language: string; label: string; default?: boolean }>;
          subtitles: Array<{ id: string; language: string; label: string; url: string; format: 'vtt' | 'srt' | 'ass' }>;
          type: 'hls' | 'dash' | 'mp4';
          url: string;
          voiceActing?: string;
        }>;
        total: number;
      }>(`/sources/streams?${sp.toString()}`).catch(() => ({ streams: [], total: 0 }));
    },

    resolve: (params: {
      title: string;
      type: MediaType;
      year: number;
      tmdbId?: number;
      season?: number;
      episode?: number;
    }) => {
      const sp = new URLSearchParams({
        title: params.title,
        type: params.type,
        year: String(params.year),
      });
      if (params.tmdbId) sp.set('tmdbId', String(params.tmdbId));
      if (params.season !== undefined) sp.set('season', String(params.season));
      if (params.episode !== undefined) sp.set('episode', String(params.episode));
      return fetcher<StreamSourceGroup[]>(`/sources/resolve?${sp.toString()}`).catch(() => []);
    },

    listAdapters: () =>
      fetcher<
        Array<{
          id: string;
          name: string;
          version: string;
          type: 'native' | 'lampa';
          isEnabled: boolean;
          priority: number;
          isCustom?: boolean;
          pluginUrl?: string;
          allowedDomains?: string[];
        }>
      >('/sources/adapters', { cache: 'no-store' }).catch(() => []),

    addPlugin: async (payload: {
      url: string;
      name?: string;
      allowedDomains?: string[];
      makePrimary?: boolean;
    }) => {
      const url = `${API_BASE}/sources/plugins`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `Ошибка ${res.status}`);
      }
      return data;
    },

    removePlugin: (id: string) =>
      fetcher<{ success: boolean }>(`/sources/plugins/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),

    getHealth: () =>
      fetcher<
        Array<{
          sourceId: string;
          healthy: boolean;
          latencyMs: number;
          lastChecked: string;
          error?: string;
        }>
      >('/sources/health', { cache: 'no-store' }).catch(() => []),

    updateAdapterSettings: (
      id: string,
      patch: { isEnabled?: boolean; priority?: number; options?: Record<string, unknown> }
    ) =>
      fetcher<{ success: boolean }>(`/sources/adapters/${encodeURIComponent(id)}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),

    verifyLampa: () =>
      fetcher<{
        pluginId: string;
        passed: boolean;
        totalChecks: number;
        passedChecks: number;
        checks: Array<{ name: string; passed: boolean; details?: string }>;
      }>('/sources/lampa/verify', { cache: 'no-store' }),
  },

  history: {
    sync: (payload: PlaybackSyncPayload, profileId = 'default-profile') =>
      fetcher<WatchProgress>(`/history/sync?profileId=${profileId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }).catch(() => ({} as WatchProgress)),
    getProgress: (mediaId: string, profileId = 'default-profile') =>
      fetcher<WatchProgress | null>(`/history/progress/${mediaId}?profileId=${profileId}`).catch(() => null),
    getContinueWatching: (profileId = 'default-profile') =>
      fetcher<WatchProgress[]>(`/history/continue-watching?profileId=${profileId}`).catch(() => []),
  },

  auth: {
    getMe: () => fetcher<User>('/auth/me').catch(() => ({} as User)),
  },
};

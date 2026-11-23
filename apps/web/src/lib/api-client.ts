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
const TMDB_KEY = process.env.TMDB_API_KEY || '9cea7e9e78f99a9f9468c4f74f3d7eab';
const TMDB_API_BASE = (process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3').replace(/\/+$/, '');
const TMDB_IMAGE_BASE = (
  process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p'
).replace(/\/+$/, '');
const ANILIBERTY_BASE = 'https://api.anilibria.app';

function mapDirectAniLibertyRelease(r: any, includeDetails = false): MediaItem | null {
  const id = Number(r?.id);
  const title = r?.name?.main || r?.name?.english;
  if (!id || !title) return null;
  const posterRel = r?.poster?.src || r?.poster?.preview;
  const posterPath = posterRel
    ? /^https?:\/\//i.test(posterRel)
      ? posterRel
      : `${ANILIBERTY_BASE}${posterRel.startsWith('/') ? posterRel : `/${posterRel}`}`
    : null;
  const type: MediaType = String(r?.type?.value || 'TV').toUpperCase() === 'MOVIE' ? 'movie' : 'tv';
  const year = Number(r?.year) || 2024;
  const rating =
    [r?.mal?.rating, r?.shikimori?.rating, r?.rating?.average]
      .map((v) => Number(v))
      .find((v) => v > 0) || 0;
  const genres: Genre[] = Array.isArray(r?.genres)
    ? r.genres.filter((g: any) => g?.id).map((g: any) => ({ id: Number(g.id), name: String(g.name) }))
    : [];

  const base: MediaItem = {
    id: `al-${id}`,
    anilibertyId: id,
    malId: Number(r?.mal?.id) || undefined,
    source: 'aniliberty',
    type,
    title: String(title),
    originalTitle: r?.name?.english || undefined,
    overview: String(r?.description || '').replace(/<[^>]+>/g, '').trim() || 'Описание аниме временно отсутствует.',
    posterPath,
    backdropPath: posterPath,
    releaseDate: `${year}-01-01`,
    releaseYear: year,
    voteAverage: Number(rating.toFixed(1)),
    durationMinutes: Number(r?.average_duration_of_episode) || (type === 'movie' ? 100 : 24),
    ageRating: String(r?.age_rating?.label || '16+'),
    genres,
    isOngoing: Boolean(r?.is_ongoing),
    episodesTotal: Number(r?.episodes_total) || undefined,
  };

  if (includeDetails) {
    base.voiceovers = Array.isArray(r?.members)
      ? r.members
          .filter((m: any) => m?.nickname)
          .map((m: any) => ({
            name: String(m.nickname),
            role: String(m.role?.description || m.role?.value || 'Участник'),
          }))
      : [];
    base.voiceTeamName = 'AniLibria';
    if (type === 'tv' && Array.isArray(r?.episodes) && r.episodes.length > 0) {
      const episodes = r.episodes
        .map((e: any, idx: number) => {
          const ord = Number(e?.ordinal) || idx + 1;
          const prev = e?.preview?.src || e?.preview?.preview;
          return {
            id: String(e?.id || `al-${id}-e${ord}`),
            seasonNumber: 1,
            episodeNumber: ord,
            name: e?.name || `Серия ${ord}`,
            stillPath: prev
              ? /^https?:\/\//i.test(prev)
                ? prev
                : `${ANILIBERTY_BASE}${prev.startsWith('/') ? prev : `/${prev}`}`
              : null,
            durationMinutes: e?.duration ? Math.max(1, Math.round(Number(e.duration) / 60)) : 24,
            airDate: e?.updated_at ? String(e.updated_at).slice(0, 10) : undefined,
          };
        })
        .sort((a: any, b: any) => a.episodeNumber - b.episodeNumber);
      base.seasons = [
        {
          id: `al-${id}-s1`,
          seasonNumber: 1,
          name: 'Эпизоды',
          posterPath,
          episodeCount: episodes.length,
          episodes,
        },
      ];
    }
  }
  return base;
}

async function fetchDirectAniLibertyReleaseById(alId: number | string): Promise<any | null> {
  try {
    const res = await fetch(`${ANILIBERTY_BASE}/api/v1/anime/releases/${alId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: any = await res.json();
    const r = raw?.data || raw;
    return r && r.id ? r : null;
  } catch {
    return null;
  }
}

async function findDirectAniLibertyReleaseRaw(params: {
  anilibertyId?: number;
  malId?: number;
  title?: string;
  originalTitle?: string;
}): Promise<any | null> {
  if (params.anilibertyId) {
    const direct = await fetchDirectAniLibertyReleaseById(params.anilibertyId);
    if (direct) return direct;
  }

  const queries: string[] = [];
  const pushQ = (q?: string) => {
    const clean = (q || '').trim();
    if (clean && !queries.includes(clean)) queries.push(clean);
    const base = clean.split(/[:—–-]/)[0]?.trim();
    if (base && base.length >= 3 && !queries.includes(base)) queries.push(base);
  };
  pushQ(params.title);
  pushQ(params.originalTitle);

  const norm = (s?: string) =>
    String(s || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/gi, ' ')
      .trim();

  const qTitle = norm(params.title);
  const qOrig = norm(params.originalTitle);

  for (const q of queries) {
    try {
      const sp = new URLSearchParams({
        page: '1',
        limit: '10',
        'f[search]': q,
      });
      const res = await fetch(
        `${ANILIBERTY_BASE}/api/v1/anime/catalog/releases?${sp.toString()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) continue;
      const json: any = await res.json();
      const list: any[] = Array.isArray(json?.data) ? json.data : [];
      if (list.length === 0) continue;

      const hit =
        (params.malId
          ? list.find(
              (r) => Number(r?.mal?.id) === params.malId || Number(r?.shikimori?.id) === params.malId
            )
          : undefined) ||
        list.find((r) => {
          const m = norm(r?.name?.main);
          const e = norm(r?.name?.english);
          return (
            (qTitle && m === qTitle) ||
            (qOrig && e === qOrig) ||
            (qTitle && m.startsWith(qTitle)) ||
            (qTitle && qTitle.startsWith(m))
          );
        }) ||
        list[0];

      if (hit?.id) {
        const full = await fetchDirectAniLibertyReleaseById(hit.id);
        if (full) return full;
      }
    } catch {}
  }

  return null;
}

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
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (!isMutation && !fetchInit.signal && typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    fetchInit.signal = controller.signal;
    timeoutId = setTimeout(() => controller.abort(), 8000);
  }
  const res = await fetch(url, fetchInit).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

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
    const res = await fetch(`${TMDB_API_BASE}${path}?${sp.toString()}`, {
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
        return await fetcher<Season>(`/media/tv/${encodeURIComponent(String(tvId))}/season/${seasonNumber}`);
      } catch (err) {
        const tvIdStr = String(tvId);
        if (/^al-\d+$/i.test(tvIdStr)) {
          const alId = tvIdStr.slice(3);
          const res = await fetch(`${ANILIBERTY_BASE}/api/v1/anime/releases/${alId}`);
          if (res.ok) {
            const raw: any = await res.json();
            const mapped = mapDirectAniLibertyRelease(raw?.data || raw, true);
            if (mapped?.seasons?.[0]) return mapped.seasons[0];
          }
        }
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

    getGenres: async (type: MediaType = 'movie', category?: string) => {
      try {
        const catQs = category === 'anime' ? '&category=anime' : '';
        return await fetcher<Genre[]>(`/media/genres?type=${type}${catQs}`);
      } catch (err) {
        if (category === 'anime') {
          try {
            const r = await fetch(`${ANILIBERTY_BASE}/api/v1/anime/catalog/references/genres`, {
              next: { revalidate: 86400 },
            });
            if (r.ok) {
              const list: any[] = await r.json();
              if (Array.isArray(list) && list.length > 0) {
                return list.map((g) => ({ id: Number(g.id), name: String(g.name) }));
              }
            }
          } catch {}
        }
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
        q?: string;
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
        if (extra?.q) sp.set('q', extra.q);
        return await fetcher<PaginatedResult<MediaItem>>(`/media/discover?${sp.toString()}`);
      } catch (err) {
        if (category === 'anime') {
          try {
            const alSp = new URLSearchParams({
              page: String(page),
              limit: '36',
              'f[sorting]':
                sort === 'rating' || sort === 'votes'
                  ? 'RATING_DESC'
                  : sort === 'date'
                  ? 'YEAR_DESC'
                  : 'FRESH_AT_DESC',
            });
            if (extra?.yearFrom && extra?.yearTo) {
              alSp.set('f[years][from_year]', String(extra.yearFrom));
              alSp.set('f[years][to_year]', String(extra.yearTo));
            }
            if (extra?.q?.trim()) {
              alSp.set('f[search]', extra.q.trim());
            }
            const res = await fetch(`${ANILIBERTY_BASE}/api/v1/anime/catalog/releases?${alSp.toString()}`);
            if (res.ok) {
              const raw: any = await res.json();
              const list = Array.isArray(raw?.data) ? raw.data : [];
              const mapped = list.map((r: any) => mapDirectAniLibertyRelease(r)).filter(Boolean) as MediaItem[];
              if (mapped.length > 0) {
                return {
                  items: mapped,
                  page,
                  totalPages: Number(raw?.meta?.pagination?.total_pages) || page + 1,
                  totalItems: Number(raw?.meta?.pagination?.total) || mapped.length,
                };
              }
            }
          } catch {}
        }

        const sortByMap: Record<string, string> = {
          popularity: 'popularity.desc',
          rating: 'vote_average.desc',
          votes: 'vote_count.desc',
          date: resolvedType === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc',
        };
        const params: Record<string, string> = {
          sort_by: sortByMap[sort] || 'popularity.desc',
        };
        if (genreId && genreId > 0) params.with_genres = String(genreId);
        if (category === 'anime') {
          params.with_genres = '16';
          params.with_original_language = 'ja';
        } else if (category === 'cartoon') {
          params.with_genres = '16';
        } else if (category === 'dorama') {
          params.with_original_language = 'ko';
        }
        if (extra?.yearFrom) {
          params[resolvedType === 'tv' ? 'first_air_date.gte' : 'primary_release_date.gte'] = `${extra.yearFrom}-01-01`;
        }
        if (extra?.yearTo) {
          params[resolvedType === 'tv' ? 'first_air_date.lte' : 'primary_release_date.lte'] = `${extra.yearTo}-12-31`;
        }
        if (extra?.minRating) params['vote_average.gte'] = String(extra.minRating);

        const tmdbRes: any = await fetchDirectTmdb(`/discover/${resolvedType}`, { ...params, page: String(page) });
        if (tmdbRes?.results) {
          return {
            items: tmdbRes.results.map((m: any) => mapTmdbToMedia(m, resolvedType)),
            page: tmdbRes.page || page,
            totalPages: tmdbRes.total_pages || 1,
            totalItems: tmdbRes.total_results || tmdbRes.results.length,
          };
        }
        throw err;
      }
    },

    getById: async (id: string, type?: MediaType): Promise<MediaItem> => {
      try {
        return await fetcher<MediaItem>(`/media/${encodeURIComponent(id)}${type ? `?type=${type}` : ''}`);
      } catch (err) {
        if (/^\d+$/.test(id)) {
          const d: any = await fetchDirectTmdb(type === 'tv' ? `/tv/${id}` : `/movie/${id}`);
          if (d) return mapTmdbToMedia(d, type === 'tv' ? 'tv' : 'movie');
        }
        if (/^al-\d+$/i.test(id)) {
          const alId = id.slice(3);
          try {
            const res = await fetch(`${ANILIBERTY_BASE}/api/v1/anime/releases/${alId}`);
            if (res.ok) {
              const raw: any = await res.json();
              const mapped = mapDirectAniLibertyRelease(raw?.data || raw, true);
              if (mapped) return mapped;
            }
          } catch {}
        }
        if (/^mal-\d+$/i.test(id)) {
          const malId = Number(id.slice(4));
          try {
            const aniRes = await fetch('https://graphql.anilist.co', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({
                query: `query ($idMal: Int) {
                  Media(type: ANIME, idMal: $idMal) {
                    idMal format title { english romaji } description(asHtml: false)
                    coverImage { extraLarge large } bannerImage averageScore startDate { year } duration
                  }
                }`,
                variables: { idMal: malId },
              }),
            });
            if (aniRes.ok) {
              const j: any = await aniRes.json();
              const a = j?.data?.Media;
              if (a) {
                return {
                  id: `mal-${malId}`,
                  malId,
                  source: 'jikan' as const,
                  type: (a.format === 'MOVIE' ? 'movie' : 'tv') as MediaType,
                  title: a.title?.english || a.title?.romaji || `Anime #${malId}`,
                  originalTitle: a.title?.romaji,
                  overview: String(a.description || '').replace(/<[^>]+>/g, '') || 'Описание отсутствует.',
                  posterPath: a.coverImage?.extraLarge || a.coverImage?.large || null,
                  backdropPath: a.bannerImage || a.coverImage?.extraLarge || null,
                  releaseYear: a.startDate?.year || 2024,
                  voteAverage: a.averageScore ? Number((a.averageScore / 10).toFixed(1)) : 0,
                  durationMinutes: a.duration || 24,
                  ageRating: '16+',
                  genres: [{ id: 16, name: 'Аниме' }],
                };
              }
            }
          } catch {}
        }
        if (/^tvmaze-\d+$/i.test(id)) {
          const tvId = Number(id.slice(7));
          try {
            const res = await fetch(`https://api.tvmaze.com/shows/${tvId}`);
            if (res.ok) {
              const s: any = await res.json();
              if (s?.id) {
                return {
                  id: `tvmaze-${tvId}`,
                  tvmazeId: tvId,
                  source: 'tvmaze' as const,
                  type: 'tv' as MediaType,
                  title: s.name,
                  originalTitle: s.name,
                  overview: String(s.summary || '').replace(/<[^>]+>/g, '') || 'Описание отсутствует.',
                  posterPath: s.image?.original || s.image?.medium || null,
                  backdropPath: s.image?.original || s.image?.medium || null,
                  releaseYear: s.premiered ? parseInt(String(s.premiered).slice(0, 4), 10) : 2024,
                  voteAverage: Number(s.rating?.average || 0),
                  durationMinutes: s.averageRuntime || 45,
                  ageRating: '16+',
                  genres: [],
                };
              }
            }
          } catch {}
        }
        throw err;
      }
    },

    resolveAniLibertyRelease: async (params: {
      anilibertyId?: number;
      malId?: number;
      title?: string;
      originalTitle?: string;
    }): Promise<MediaItem | null> => {
      const raw = await findDirectAniLibertyReleaseRaw(params);
      const mapped = raw ? mapDirectAniLibertyRelease(raw, true) : null;

      if (typeof window !== 'undefined') {
        try {
          const sp = new URLSearchParams({
            id: params.anilibertyId ? `al-${params.anilibertyId}` : '',
            episode: '1',
          });
          if (params.title || mapped?.title) sp.set('title', String(params.title || mapped?.title));
          if (params.originalTitle || mapped?.originalTitle) {
            sp.set('originalTitle', String(params.originalTitle || mapped?.originalTitle));
          }
          if (params.malId || mapped?.malId) sp.set('malId', String(params.malId || mapped?.malId));
          if (params.anilibertyId || mapped?.anilibertyId) {
            sp.set('anilibertyId', String(params.anilibertyId || mapped?.anilibertyId));
          }

          const res = await fetch(`/api/anime-streams?${sp.toString()}`, { cache: 'no-store' });
          if (res.ok) {
            const json: any = await res.json();
            const fullEps = Array.isArray(json?.episodes) ? json.episodes : [];
            if (fullEps.length > 0) {
              const existingCount = mapped?.seasons?.[0]?.episodes?.length || 0;
              if (mapped && fullEps.length > existingCount) {
                mapped.episodesTotal = fullEps.length;
                mapped.seasons = [
                  {
                    id: `al-${mapped.anilibertyId || 'anime'}-s1`,
                    seasonNumber: 1,
                    name: 'Эпизоды',
                    posterPath: mapped.posterPath,
                    episodeCount: fullEps.length,
                    episodes: fullEps,
                  },
                ];
              } else if (!mapped) {
                return {
                  id: params.anilibertyId ? `al-${params.anilibertyId}` : `mal-${params.malId || 0}`,
                  anilibertyId: params.anilibertyId,
                  malId: params.malId,
                  source: 'aniliberty',
                  type: 'tv',
                  title: params.title || params.originalTitle || 'Аниме',
                  originalTitle: params.originalTitle,
                  overview: '',
                  posterPath: null,
                  backdropPath: null,
                  releaseYear: 2024,
                  voteAverage: 0,
                  genres: [{ id: 16, name: 'Аниме' }],
                  episodesTotal: fullEps.length,
                  seasons: [
                    {
                      id: 'anime-s1',
                      seasonNumber: 1,
                      name: 'Эпизоды',
                      posterPath: null,
                      episodeCount: fullEps.length,
                      episodes: fullEps,
                    },
                  ],
                };
              }
            }
          }
        } catch {}
      }

      return mapped;
    },
  },

  sources: {
    /**
     * AniLiberty HLS streams (qualities 480/720/1080) for any anime episode.
     * Works with `al-<id>`, `mal-<id>`, or TMDB anime IDs (auto-resolving by title / malId).
     */
    getAnimeStreams: async (
      id: string,
      episode = 1,
      extra?: {
        title?: string;
        originalTitle?: string;
        malId?: number;
        anilibertyId?: number;
      }
    ): Promise<StreamSourceGroup[]> => {
      const targetId = extra?.anilibertyId ? `al-${extra.anilibertyId}` : id;
      const alMatch = /^al-(\d+)$/i.exec(targetId);
      const malMatch = /^mal-(\d+)$/i.exec(targetId);
      const resolvedAlId =
        extra?.anilibertyId || (alMatch ? Number(alMatch[1]) : undefined);
      const resolvedMalId =
        extra?.malId || (malMatch ? Number(malMatch[1]) : undefined);

      // 1. Primary multi-voiceover aggregator (AniLiberty + Kodik real voiceovers + AnimeVost)
      if (typeof window !== 'undefined') {
        try {
          const sp = new URLSearchParams({
            id: targetId,
            episode: String(episode),
          });
          if (extra?.title) sp.set('title', extra.title);
          if (extra?.originalTitle) sp.set('originalTitle', extra.originalTitle);
          if (resolvedMalId) sp.set('malId', String(resolvedMalId));
          if (resolvedAlId) sp.set('anilibertyId', String(resolvedAlId));

          const localRes = await fetch(`/api/anime-streams?${sp.toString()}`, {
            cache: 'no-store',
          });
          if (localRes.ok) {
            const localJson: { groups?: StreamSourceGroup[] } = await localRes.json();
            if (localJson?.groups && localJson.groups.length > 0) {
              return localJson.groups;
            }
          }
        } catch {}
      }

      try {
        const sp = new URLSearchParams({ episode: String(episode) });
        if (extra?.title) sp.set('title', extra.title);
        if (extra?.originalTitle) sp.set('originalTitle', extra.originalTitle);
        if (resolvedMalId) sp.set('malId', String(resolvedMalId));
        const r = await fetcher<{ groups: StreamSourceGroup[] }>(
          `/media/anime/${encodeURIComponent(targetId)}/streams?${sp.toString()}`,
          { cache: 'no-store' }
        );
        if (r?.groups && r.groups.length > 0) return r.groups;
      } catch {}

      try {
        const r = await findDirectAniLibertyReleaseRaw({
          anilibertyId: resolvedAlId,
          malId: resolvedMalId,
          title: extra?.title,
          originalTitle: extra?.originalTitle,
        });
        if (r) {
          const alId = r.id;
          const eps: any[] = Array.isArray(r?.episodes) ? r.episodes : [];
          const ep =
            eps.find((e) => Number(e?.ordinal) === Number(episode)) ||
            (eps.length === 1 && Number(episode) === 1 ? eps[0] : null);
          if (ep) {
            const team = Array.isArray(r?.members)
              ? r.members
                  .filter(
                    (m: any) =>
                      m?.nickname &&
                      /озвуч|voic/i.test(String(m?.role?.description || m?.role?.value || ''))
                  )
                  .map((m: any) => String(m.nickname))
              : [];
            const primaryVoice =
              team.length > 0 ? `AniLibria (${team.slice(0, 3).join(', ')})` : 'AniLibria';
            const hdLevels: Array<[string, '1080p' | '720p']> = [
              ['hls_1080', '1080p'],
              ['hls_720', '720p'],
            ];
            const activeLevels: Array<[string, '1080p' | '720p']> = hdLevels.some(
              ([f]) => typeof ep[f] === 'string' && ep[f]
            )
              ? hdLevels
              : [
                  ['hls_1080', '1080p'],
                  ['hls_720', '720p'],
                  ['hls_480', '720p'],
                ];

            const streams = activeLevels
              .filter(([f]) => typeof ep[f] === 'string' && ep[f])
              .map(([f, quality]) => ({
                id: `al-${alId}-e${ep.ordinal}-aniliberty-${quality}`,
                providerId: 'aniliberty',
                providerName: 'AniLibria',
                title: ep.name || `Серия ${ep.ordinal}`,
                voiceActing: primaryVoice,
                season: 1,
                episode: Number(ep.ordinal),
                quality,
                format: 'hls' as const,
                streamUrl: String(ep[f]).replace(/^http:\/\//i, 'https://'),
                audioTracks: [
                  { id: '0', language: 'ru', label: primaryVoice, isDefault: true },
                ],
              }));

            if (streams.length > 0) {
              return [
                {
                  providerId: 'aniliberty',
                  providerName: 'AniLibria',
                  voiceActing: primaryVoice,
                  streams,
                },
              ];
            }
          }
        }
      } catch {}
      return [];
    },

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
          type: 'native';
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

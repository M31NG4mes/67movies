import { Injectable, Logger } from '@nestjs/common';
import { Episode, Genre, MediaItem, MediaType, Season } from '@cinemaflow/types';
import { RedisService } from '../../../common/redis/redis.service';
import { DiscoverProviderOptions, stripHtml } from '../media-aggregator.util';

const ANILIST_URL = 'https://graphql.anilist.co';
const SHIKIMORI_BASE = 'https://shikimori.one';

const TMDB_TO_ANILIST_GENRE: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  35: 'Comedy',
  18: 'Drama',
  14: 'Fantasy',
  27: 'Horror',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  53: 'Thriller',
  10402: 'Music',
  10759: 'Action',
  10765: 'Fantasy',
};

const ANILIST_GENRE_RU: Record<string, string> = {
  Action: 'Боевик',
  Adventure: 'Приключения',
  Comedy: 'Комедия',
  Drama: 'Драма',
  Fantasy: 'Фэнтези',
  Horror: 'Ужасы',
  Mystery: 'Детектив',
  Psychological: 'Психологическое',
  Romance: 'Мелодрама',
  'Sci-Fi': 'Фантастика',
  'Slice of Life': 'Повседневность',
  Sports: 'Спорт',
  Supernatural: 'Сверхъестественное',
  Thriller: 'Триллер',
  Mecha: 'Меха',
  Music: 'Музыка',
};

const ANILIST_LIST_QUERY = `
query ($page: Int, $perPage: Int, $search: String, $formatIn: [MediaFormat], $sort: [MediaSort], $genre: String, $minScore: Int, $startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    media(
      type: ANIME,
      isAdult: false,
      search: $search,
      format_in: $formatIn,
      sort: $sort,
      genre: $genre,
      averageScore_greater: $minScore,
      startDate_greater: $startDateGreater,
      startDate_lesser: $startDateLesser
    ) {
      id
      idMal
      format
      title { romaji english native }
      description(asHtml: false)
      coverImage { extraLarge large }
      bannerImage
      averageScore
      popularity
      episodes
      duration
      genres
      startDate { year month day }
    }
  }
}
`;

const ANILIST_BY_MAL_IDS_QUERY = `
query ($malIds: [Int]) {
  Page(page: 1, perPage: 50) {
    media(type: ANIME, idMal_in: $malIds, isAdult: false) {
      id
      idMal
      format
      title { romaji english native }
      description(asHtml: false)
      coverImage { extraLarge large }
      bannerImage
      averageScore
      popularity
      episodes
      duration
      genres
      startDate { year month day }
    }
  }
}
`;

const ANILIST_DETAIL_QUERY = `
query ($idMal: Int) {
  Media(type: ANIME, idMal: $idMal) {
    id
    idMal
    format
    title { romaji english native }
    description(asHtml: false)
    coverImage { extraLarge large }
    bannerImage
    averageScore
    popularity
    episodes
    duration
    genres
    startDate { year month day }
    studios(isMain: true) { nodes { name } }
    characters(perPage: 12, sort: ROLE) {
      nodes {
        id
        name { full }
        image { medium }
      }
    }
    recommendations(perPage: 8, sort: RATING_DESC) {
      nodes {
        mediaRecommendation {
          id
          idMal
          format
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          averageScore
          startDate { year }
          genres
        }
      }
    }
  }
}
`;

@Injectable()
export class AnimeProviderService {
  private readonly logger = new Logger(AnimeProviderService.name);

  constructor(private readonly redisService: RedisService) {}

  private async fetchJson<T>(
    url: string,
    cacheKey: string,
    ttlSeconds = 1800,
    timeoutMs = 4500,
  ): Promise<T | null> {
    const cached = await this.redisService.get<T>(cacheKey);
    if (cached) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': '67movies-cinema/1.0 (https://github.com/M31NG4mes/67movies)',
        },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as T;
      if (data) {
        await this.redisService.set(cacheKey, data, ttlSeconds);
      }
      return data;
    } catch (err: any) {
      this.logger.debug(`Anime provider fetch skipped [${url}]: ${err?.message || err}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchAniList<T>(
    query: string,
    variables: Record<string, any>,
    cacheKey: string,
    ttlSeconds = 1800,
    timeoutMs = 5000,
  ): Promise<T | null> {
    const cached = await this.redisService.get<T>(cacheKey);
    if (cached) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(ANILIST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': '67movies-cinema/1.0',
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const json: any = await res.json();
      const data = json?.data as T;
      if (data) {
        await this.redisService.set(cacheKey, data, ttlSeconds);
      }
      return data || null;
    } catch (err: any) {
      this.logger.debug(`AniList fetch skipped: ${err?.message || err}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // =========================================================================
  // Public Catalog Methods (AniList HD posters + Shikimori RU titles — 100% free)
  // =========================================================================

  async search(query: string, page = 1): Promise<MediaItem[]> {
    const q = query.trim();
    if (!q) return [];

    const [aniRes, shikiRaw] = await Promise.all([
      this.fetchAniList<any>(
        ANILIST_LIST_QUERY,
        { page, perPage: 16, search: q, sort: ['SEARCH_MATCH', 'POPULARITY_DESC'] },
        `anilist:search:${q.toLowerCase()}:${page}`,
        600,
      ),
      this.fetchJson<any[]>(
        `${SHIKIMORI_BASE}/api/animes?search=${encodeURIComponent(q)}&limit=14&page=${page}&censored=true`,
        `shiki:search:${q.toLowerCase()}:${page}`,
        600,
      ),
    ]);

    return this.mergeAniListAndShikimori(aniRes?.Page?.media || [], shikiRaw || []);
  }

  async getPopular(type: MediaType, page = 1): Promise<MediaItem[]> {
    const formatIn = type === 'movie' ? ['MOVIE'] : ['TV', 'ONA', 'OVA'];
    const shikiKind = type === 'movie' ? 'movie' : 'tv';

    const [aniRes, shikiRaw] = await Promise.all([
      this.fetchAniList<any>(
        ANILIST_LIST_QUERY,
        { page, perPage: 18, formatIn, sort: ['POPULARITY_DESC'] },
        `anilist:pop:${type}:${page}`,
        1800,
      ),
      this.fetchJson<any[]>(
        `${SHIKIMORI_BASE}/api/animes?order=popularity&kind=${shikiKind}&limit=18&page=${page}&censored=true`,
        `shiki:pop:${type}:${page}`,
        1800,
      ),
    ]);

    return this.mergeAniListAndShikimori(aniRes?.Page?.media || [], shikiRaw || []);
  }

  async getNew(type: MediaType, page = 1): Promise<MediaItem[]> {
    const formatIn = type === 'movie' ? ['MOVIE'] : ['TV', 'ONA'];
    const shikiKind = type === 'movie' ? 'movie' : 'tv';

    const [aniRes, shikiRaw] = await Promise.all([
      this.fetchAniList<any>(
        ANILIST_LIST_QUERY,
        { page, perPage: 16, formatIn, sort: ['TRENDING_DESC', 'START_DATE_DESC'] },
        `anilist:new:${type}:${page}`,
        1800,
      ),
      this.fetchJson<any[]>(
        `${SHIKIMORI_BASE}/api/animes?order=aired_on&status=ongoing,released&kind=${shikiKind}&score=6&limit=14&page=${page}&censored=true`,
        `shiki:new:${type}:${page}`,
        1800,
      ),
    ]);

    return this.mergeAniListAndShikimori(aniRes?.Page?.media || [], shikiRaw || []);
  }

  async discover(options: DiscoverProviderOptions): Promise<MediaItem[]> {
    const isMovie = options.category === 'cartoons' || options.type === 'movie';
    const formatIn = isMovie ? ['MOVIE'] : ['TV', 'ONA', 'OVA'];

    const aniSort =
      options.sort === 'rating'
        ? ['SCORE_DESC']
        : options.sort === 'date'
        ? ['START_DATE_DESC']
        : ['POPULARITY_DESC'];

    const aniVars: Record<string, any> = {
      page: options.page,
      perPage: 26,
      formatIn,
      sort: aniSort,
    };

    if (options.genreId && TMDB_TO_ANILIST_GENRE[options.genreId]) {
      aniVars.genre = TMDB_TO_ANILIST_GENRE[options.genreId];
    }
    if (options.minRating && options.minRating > 0) {
      // AniList uses 0..100 scale
      aniVars.minScore = Math.max(10, Math.round(options.minRating * 10) - 1);
    }
    if (options.yearFrom && options.yearFrom >= 1900) {
      aniVars.startDateGreater = options.yearFrom * 10000;
    }
    if (options.yearTo && options.yearTo >= 1900) {
      aniVars.startDateLesser = options.yearTo * 10000 + 1232;
    }

    const shikiOrder =
      options.sort === 'rating'
        ? 'ranked'
        : options.sort === 'date'
        ? 'aired_on'
        : 'popularity';

    const shikiParams = new URLSearchParams({
      order: shikiOrder,
      kind: isMovie ? 'movie' : 'tv',
      limit: '24',
      page: String(options.page),
      censored: 'true',
    });
    if (options.minRating && options.minRating > 0) {
      shikiParams.set('score', String(Math.floor(options.minRating)));
    }
    if (options.yearFrom && options.yearTo) {
      shikiParams.set('season', `${options.yearFrom}_${options.yearTo}`);
    } else if (options.yearFrom) {
      shikiParams.set('season', `${options.yearFrom}_${new Date().getFullYear()}`);
    }

    const [aniRes, shikiRaw] = await Promise.all([
      this.fetchAniList<any>(
        ANILIST_LIST_QUERY,
        aniVars,
        `anilist:disc:${JSON.stringify(aniVars)}`,
        1200,
      ),
      this.fetchJson<any[]>(
        `${SHIKIMORI_BASE}/api/animes?${shikiParams.toString()}`,
        `shiki:disc:${shikiParams.toString()}`,
        1200,
      ),
    ]);

    return this.mergeAniListAndShikimori(aniRes?.Page?.media || [], shikiRaw || []);
  }

  async getDetails(malId: number): Promise<MediaItem | null> {
    if (!malId) return null;

    const [aniRes, shiki, episodesRes] = await Promise.all([
      this.fetchAniList<any>(ANILIST_DETAIL_QUERY, { idMal: malId }, `anilist:detail:${malId}`, 7200),
      this.fetchJson<any>(`${SHIKIMORI_BASE}/api/animes/${malId}`, `shiki:detail:${malId}`, 7200),
      this.fetchJson<any>(
        `https://api.jikan.moe/v4/anime/${malId}/episodes?page=1`,
        `jikan:ep:${malId}:1`,
        7200,
        3500,
      ),
    ]);

    const ani = aniRes?.Media;
    if (!ani && !shiki) return null;

    const format = String(ani?.format || shiki?.kind || 'tv').toUpperCase();
    const type: MediaType = format === 'MOVIE' ? 'movie' : 'tv';
    const title =
      shiki?.russian ||
      ani?.title?.english ||
      ani?.title?.romaji ||
      shiki?.name ||
      `Anime #${malId}`;
    const originalTitle = ani?.title?.romaji || ani?.title?.native || shiki?.name || undefined;

    const shikiDesc = stripHtml(shiki?.description_html || shiki?.description || '').replace(
      /\[[^\]]+\]/g,
      '',
    );
    const overview =
      shikiDesc ||
      stripHtml(ani?.description) ||
      'Описание аниме временно отсутствует.';

    // Always prefer reliable AniList CDN images over Shikimori hotlink-protected URLs
    const posterPath = ani?.coverImage?.extraLarge || ani?.coverImage?.large || null;
    const backdropPath = ani?.bannerImage || posterPath;

    const year =
      Number(ani?.startDate?.year) ||
      (shiki?.aired_on ? new Date(shiki.aired_on).getFullYear() : 2024);

    const score =
      shiki?.score && parseFloat(String(shiki.score)) > 0
        ? parseFloat(String(shiki.score))
        : ani?.averageScore
        ? ani.averageScore / 10
        : 0;

    const genres: Genre[] =
      Array.isArray(shiki?.genres) && shiki.genres.length > 0
        ? shiki.genres.map((g: any, idx: number) => ({
            id: Number(g.id) || 8000 + idx,
            name: g.russian || g.name,
          }))
        : Array.isArray(ani?.genres)
        ? ani.genres.map((g: string, idx: number) => ({
            id: 8000 + idx,
            name: ANILIST_GENRE_RU[g] || g,
          }))
        : [{ id: 16, name: 'Аниме' }];

    const cast = Array.isArray(ani?.characters?.nodes)
      ? ani.characters.nodes.slice(0, 12).map((c: any, idx: number) => ({
          id: Number(c.id) || 90000 + idx,
          name: c.name?.full || 'Персонаж',
          profilePath: c.image?.medium || null,
        }))
      : [];

    const recommendations: MediaItem[] = Array.isArray(ani?.recommendations?.nodes)
      ? ani.recommendations.nodes
          .map((n: any) => this.mapAniListItem(n?.mediaRecommendation))
          .filter(Boolean) as MediaItem[]
      : [];

    const episodeCount = Number(ani?.episodes || shiki?.episodes || 0);
    const episodes: Episode[] = Array.isArray(episodesRes?.data)
      ? episodesRes.data.map((ep: any, idx: number) => ({
          id: `mal-${malId}-e${ep.mal_id || idx + 1}`,
          seasonNumber: 1,
          episodeNumber: Number(ep.mal_id) || idx + 1,
          name: ep.title || `Серия ${ep.mal_id || idx + 1}`,
          airDate: ep.aired ? String(ep.aired).slice(0, 10) : undefined,
          voteAverage: ep.score ? Number(ep.score) : undefined,
          durationMinutes: Number(ani?.duration || shiki?.duration) || 24,
        }))
      : [];

    const seasons: Season[] | undefined =
      type === 'tv' && (episodes.length > 0 || episodeCount > 0)
        ? [
            {
              id: `mal-${malId}-s1`,
              seasonNumber: 1,
              name: 'Сезон 1',
              posterPath,
              episodeCount: episodes.length || episodeCount,
              episodes: episodes.length > 0 ? episodes : undefined,
            },
          ]
        : undefined;

    return {
      id: `mal-${malId}`,
      malId,
      source: 'jikan',
      type,
      title,
      originalTitle,
      overview,
      posterPath,
      backdropPath,
      releaseDate: shiki?.aired_on || (year ? `${year}-01-01` : undefined),
      releaseYear: isNaN(year) ? 2024 : year,
      voteAverage: Number(score.toFixed(1)),
      voteCount: Number(ani?.popularity) || undefined,
      durationMinutes: Number(ani?.duration || shiki?.duration) || (type === 'movie' ? 105 : 24),
      ageRating: this.mapAnimeAgeRating(shiki?.rating),
      genres,
      cast,
      recommendations,
      seasons,
    };
  }

  async getSeason(malId: number, seasonNumber: number): Promise<Season | null> {
    if (!malId || seasonNumber !== 1) return null;
    const episodesRes = await this.fetchJson<any>(
      `https://api.jikan.moe/v4/anime/${malId}/episodes?page=1`,
      `jikan:ep:${malId}:1`,
      7200,
      3500,
    );
    if (!Array.isArray(episodesRes?.data) || episodesRes.data.length === 0) return null;

    const episodes: Episode[] = episodesRes.data.map((ep: any, idx: number) => ({
      id: `mal-${malId}-e${ep.mal_id || idx + 1}`,
      seasonNumber: 1,
      episodeNumber: Number(ep.mal_id) || idx + 1,
      name: ep.title || `Серия ${ep.mal_id || idx + 1}`,
      airDate: ep.aired ? String(ep.aired).slice(0, 10) : undefined,
      voteAverage: ep.score ? Number(ep.score) : undefined,
      durationMinutes: 24,
    }));

    return {
      id: `mal-${malId}-s1`,
      seasonNumber: 1,
      name: 'Сезон 1',
      episodeCount: episodes.length,
      episodes,
    };
  }

  // =========================================================================
  // Internal Combiner: AniList HD posters (s4.anilist.co) + Shikimori RU titles
  // =========================================================================

  private async mergeAniListAndShikimori(aniList: any[], shikiList: any[]): Promise<MediaItem[]> {
    const byMalId = new Map<number, MediaItem>();

    // 1. Add all AniList items first (they ALWAYS have reliable s4.anilist.co posters!)
    for (const raw of aniList) {
      const item = this.mapAniListItem(raw);
      if (item && item.malId && item.posterPath) {
        byMalId.set(item.malId, item);
      }
    }

    // 2. Attach Shikimori Russian titles to matched AniList items, and collect unmatched Shikimori IDs
    const missingMalIds: number[] = [];
    const shikiById = new Map<number, any>();

    for (const s of shikiList) {
      const malId = Number(s?.id);
      if (!malId) continue;
      shikiById.set(malId, s);

      const existing = byMalId.get(malId);
      if (existing) {
        if (s?.russian) {
          existing.title = String(s.russian);
        }
        const shikiScore = parseFloat(String(s?.score || 0));
        if (!existing.voteAverage && shikiScore > 0) {
          existing.voteAverage = Number(shikiScore.toFixed(1));
        }
      } else {
        missingMalIds.push(malId);
      }
    }

    // 3. Batch-fetch reliable AniList HD posters for remaining Shikimori anime in 1 fast GraphQL call
    if (missingMalIds.length > 0) {
      const batchIds = missingMalIds.slice(0, 25);
      const batchRes = await this.fetchAniList<any>(
        ANILIST_BY_MAL_IDS_QUERY,
        { malIds: batchIds },
        `anilist:batch:${batchIds.slice().sort((a, b) => a - b).join(',')}`,
        3600,
        3500,
      );

      for (const raw of batchRes?.Page?.media || []) {
        const item = this.mapAniListItem(raw);
        if (!item || !item.malId || !item.posterPath) continue;
        const shiki = shikiById.get(item.malId);
        if (shiki?.russian) {
          item.title = String(shiki.russian);
        }
        byMalId.set(item.malId, item);
      }
    }

    return Array.from(byMalId.values());
  }

  private mapAniListItem(a: any): MediaItem | null {
    const malId = Number(a?.idMal);
    if (!malId) return null;

    const title = a?.title?.english || a?.title?.romaji || a?.title?.native;
    if (!title) return null;

    const posterPath = a?.coverImage?.extraLarge || a?.coverImage?.large || null;
    if (!posterPath) return null;

    const format = String(a?.format || 'TV').toUpperCase();
    const type: MediaType = format === 'MOVIE' ? 'movie' : 'tv';
    const year = Number(a?.startDate?.year) || 2024;
    const month = String(a?.startDate?.month || 1).padStart(2, '0');
    const day = String(a?.startDate?.day || 1).padStart(2, '0');
    const score = a?.averageScore ? Number((a.averageScore / 10).toFixed(1)) : 0;

    return {
      id: `mal-${malId}`,
      malId,
      source: 'jikan',
      type,
      title: String(title),
      originalTitle: a?.title?.romaji || a?.title?.native || undefined,
      overview: stripHtml(a?.description) || 'Описание аниме временно отсутствует.',
      posterPath,
      backdropPath: a?.bannerImage || posterPath,
      releaseDate: `${year}-${month}-${day}`,
      releaseYear: year,
      voteAverage: score,
      voteCount: Number(a?.popularity) || undefined,
      durationMinutes: Number(a?.duration) || (type === 'movie' ? 105 : 24),
      ageRating: '16+',
      genres: Array.isArray(a?.genres)
        ? a.genres.map((g: string, idx: number) => ({
            id: 8000 + idx,
            name: ANILIST_GENRE_RU[g] || g,
          }))
        : [{ id: 16, name: 'Аниме' }],
    };
  }

  private mapAnimeAgeRating(raw?: string | null): string {
    const r = String(raw || '').toLowerCase();
    if (r.includes('rx') || r.includes('r+') || r.includes('r_plus') || r.includes('17+')) {
      return '18+';
    }
    if (r.includes('pg_13') || r.includes('pg-13')) return '16+';
    if (r.includes('pg')) return '12+';
    if (r === 'g' || r.includes('all ages')) return '6+';
    return '16+';
  }
}

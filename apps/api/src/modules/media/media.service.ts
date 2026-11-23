import { Injectable, Logger } from '@nestjs/common';
import { TmdbService } from './tmdb.service';
import { KinopoiskProviderService } from './providers/kinopoisk.provider';
import { AnimeProviderService } from './providers/anime.provider';
import { TvMazeProviderService } from './providers/tvmaze.provider';
import { OmdbProviderService } from './providers/omdb.provider';
import {
  DiscoverProviderOptions,
  mergeAndDeduplicateMedia,
  parsePrefixedMediaId,
} from './media-aggregator.util';
import { AppCacheService } from '../../common/cache/cache.service';
import { Genre, MediaItem, MediaType, PaginatedResult, Season } from '@cinemaflow/types';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly kpUrlCache = new Map<string, string>();

  constructor(
    private readonly tmdbService: TmdbService,
    private readonly kinopoiskProvider: KinopoiskProviderService,
    private readonly animeProvider: AnimeProviderService,
    private readonly tvMazeProvider: TvMazeProviderService,
    private readonly omdbProvider: OmdbProviderService,
    private readonly cache: AppCacheService,
  ) {}

  private tagTmdb(items: MediaItem[]): MediaItem[] {
    return items.map((item) => (item.source ? item : { ...item, source: 'tmdb' as const }));
  }

  async getTrending(
    mediaType: 'movie' | 'tv' | 'all' = 'all',
    timeWindow: 'day' | 'week' = 'day',
    page = 1,
  ): Promise<PaginatedResult<MediaItem>> {
    return this.cache.wrap(`media:trending:${mediaType}:${timeWindow}:${page}`, 600, async () => {
      const [tmdbRes, kpMovies, kpTv] = await Promise.all([
        this.tmdbService.getTrending(mediaType, timeWindow, page),
        mediaType === 'tv'
          ? Promise.resolve([])
          : this.kinopoiskProvider.getPopular('movie', page).catch(() => []),
        mediaType === 'movie'
          ? Promise.resolve([])
          : this.kinopoiskProvider.getPopular('tv', page).catch(() => []),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [kpMovies, kpTv],
        { maxItems: 30 },
      );

      const extraCount = Math.max(0, merged.length - tmdbRes.items.length);
      return {
        items: merged,
        page: tmdbRes.page,
        totalPages: Math.max(tmdbRes.totalPages, 1),
        totalItems: tmdbRes.totalItems + extraCount,
      };
    });
  }

  async getPopularMovies(page = 1): Promise<PaginatedResult<MediaItem>> {
    return this.cache.wrap(`media:pop:movie:${page}`, 600, async () => {
      const [tmdbRes, kpMovies, animeMovies] = await Promise.all([
        this.tmdbService.getPopularMovies(page),
        this.kinopoiskProvider.getPopular('movie', page).catch(() => []),
        this.animeProvider.getPopular('movie', page).catch(() => []),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [kpMovies, animeMovies.slice(0, 6)],
        { maxItems: 30 },
      );

      const extraCount = Math.max(0, merged.length - tmdbRes.items.length);
      return {
        items: merged,
        page: tmdbRes.page,
        totalPages: Math.max(tmdbRes.totalPages, 1),
        totalItems: tmdbRes.totalItems + extraCount,
      };
    });
  }

  async getPopularTv(page = 1): Promise<PaginatedResult<MediaItem>> {
    return this.cache.wrap(`media:pop:tv:${page}`, 600, async () => {
      const [tmdbRes, kpTv, tvMaze, animeTv] = await Promise.all([
        this.tmdbService.getPopularTv(page),
        this.kinopoiskProvider.getPopular('tv', page).catch(() => []),
        this.tvMazeProvider.getPopular(page).catch(() => []),
        this.animeProvider.getPopular('tv', page).catch(() => []),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [kpTv, tvMaze, animeTv.slice(0, 6)],
        { maxItems: 30 },
      );

      const extraCount = Math.max(0, merged.length - tmdbRes.items.length);
      return {
        items: merged,
        page: tmdbRes.page,
        totalPages: Math.max(tmdbRes.totalPages, 1),
        totalItems: tmdbRes.totalItems + extraCount,
      };
    });
  }

  async getNewMovies(page = 1): Promise<PaginatedResult<MediaItem>> {
    return this.cache.wrap(`media:new:movie:${page}`, 600, async () => {
      const [tmdbRes, kpNewMovies] = await Promise.all([
        this.tmdbService.getNewMovies(page),
        this.kinopoiskProvider.getNew('movie', page).catch(() => []),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [kpNewMovies],
        { maxItems: 30 },
      );

      const extraCount = Math.max(0, merged.length - tmdbRes.items.length);
      return {
        items: merged,
        page: tmdbRes.page,
        totalPages: Math.max(tmdbRes.totalPages, 1),
        totalItems: tmdbRes.totalItems + extraCount,
      };
    });
  }

  async getNewTv(page = 1): Promise<PaginatedResult<MediaItem>> {
    return this.cache.wrap(`media:new:tv:${page}`, 600, async () => {
      const [tmdbRes, kpNewTv, tvMazeNew, animeNew] = await Promise.all([
        this.tmdbService.getNewTv(page),
        this.kinopoiskProvider.getNew('tv', page).catch(() => []),
        this.tvMazeProvider.getNew(page).catch(() => []),
        this.animeProvider.getNew('tv', page).catch(() => []),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [kpNewTv, tvMazeNew, animeNew.slice(0, 6)],
        { maxItems: 30 },
      );

      const extraCount = Math.max(0, merged.length - tmdbRes.items.length);
      return {
        items: merged,
        page: tmdbRes.page,
        totalPages: Math.max(tmdbRes.totalPages, 1),
        totalItems: tmdbRes.totalItems + extraCount,
      };
    });
  }

  async search(query: string, page = 1): Promise<PaginatedResult<MediaItem>> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { items: [], page: 1, totalPages: 1, totalItems: 0 };
    }

    const key = `media:search:${trimmed.toLowerCase()}:${page}`;
    return this.cache.wrap(key, 180, async () => {
      const [tmdbRes, kpItems, animeItems, tvMazeItems, omdbItems] = await Promise.all([
        this.tmdbService.searchMulti(trimmed, page),
        this.kinopoiskProvider.search(trimmed, page).catch(() => []),
        this.animeProvider.search(trimmed, page).catch(() => []),
        page === 1 ? this.tvMazeProvider.search(trimmed).catch(() => []) : Promise.resolve([]),
        this.omdbProvider.search(trimmed, page).catch(() => []),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [kpItems, animeItems, tvMazeItems, omdbItems],
        { query: trimmed, maxItems: 48 },
      );

      const extraCount = Math.max(0, merged.length - tmdbRes.items.length);
      return {
        items: merged,
        page: tmdbRes.page,
        totalPages: Math.max(tmdbRes.totalPages, 1),
        totalItems: Math.max(merged.length, tmdbRes.totalItems + extraCount),
      };
    });
  }

  async getMovieDetails(id: string | number): Promise<MediaItem | null> {
    const idStr = String(id);
    return this.cache.wrap(`media:movie:${idStr}`, 900, () => this.resolveDetailsById(idStr, 'movie'));
  }

  async getTvDetails(id: string | number): Promise<MediaItem | null> {
    const idStr = String(id);
    return this.cache.wrap(`media:tv:${idStr}`, 900, () => this.resolveDetailsById(idStr, 'tv'));
  }

  async getTvSeason(tvId: string | number, seasonNumber: number): Promise<Season | null> {
    const idStr = String(tvId);
    return this.cache.wrap(`media:tv:${idStr}:s:${seasonNumber}`, 900, async () => {
      const parsed = parsePrefixedMediaId(idStr);
      if (parsed.provider === 'kinopoisk') {
        return this.kinopoiskProvider.getTvSeason(parseInt(parsed.rawId, 10), seasonNumber);
      }
      if (parsed.provider === 'anime') {
        return this.animeProvider.getSeason(parseInt(parsed.rawId, 10), seasonNumber);
      }
      if (parsed.provider === 'tvmaze') {
        return this.tvMazeProvider.getSeason(parseInt(parsed.rawId, 10), seasonNumber);
      }
      if (parsed.provider === 'omdb') {
        return null;
      }
      return this.tmdbService.getTvSeason(parsed.rawId, seasonNumber);
    });
  }

  async getGenres(type: MediaType = 'movie'): Promise<Genre[]> {
    return this.cache.wrap(`media:genres:${type}`, 3600, () => this.tmdbService.getGenres(type));
  }

  async getCalendarReleases(year: number, month: number, type: 'all' | 'movie' | 'tv' = 'all') {
    return this.cache.wrap(`media:cal:${year}:${month}:${type}`, 1800, () =>
      this.tmdbService.getCalendarReleases(year, month, type),
    );
  }

  async discoverByGenre(
    type: MediaType = 'movie',
    genreId?: number,
    page = 1,
    sort: 'popularity' | 'rating' | 'date' | 'votes' = 'popularity',
    extra?: {
      category?: string;
      yearFrom?: number;
      yearTo?: number;
      minRating?: number;
      originalLanguage?: string;
    },
  ): Promise<PaginatedResult<MediaItem>> {
    const key = `media:discover:${type}:${genreId || 'all'}:${page}:${sort}:${JSON.stringify(extra || {})}`;
    return this.cache.wrap(key, 300, async () => {
      const category = extra?.category || type;
      const isTv = category === 'tv' || category === 'anime' || category === 'dorama';
      const resolvedType: MediaType = isTv ? 'tv' : 'movie';

      const providerOptions: DiscoverProviderOptions = {
        type: resolvedType,
        category,
        genreId,
        page,
        sort,
        yearFrom: extra?.yearFrom,
        yearTo: extra?.yearTo,
        minRating: extra?.minRating,
        originalLanguage: extra?.originalLanguage,
      };

      const shouldQueryAnime =
        category === 'anime' ||
        category === 'cartoons' ||
        genreId === 16 ||
        extra?.originalLanguage === 'ja';
      const shouldQueryTvMaze = category === 'tv';

      const [tmdbRes, kpItems, animeItems, tvMazeItems] = await Promise.all([
        this.tmdbService.discoverByGenre(type, genreId, page, sort, extra),
        this.kinopoiskProvider.discover(providerOptions).catch(() => []),
        shouldQueryAnime
          ? this.animeProvider.discover(providerOptions).catch(() => [])
          : Promise.resolve([]),
        shouldQueryTvMaze
          ? this.tvMazeProvider.discover(providerOptions).catch(() => [])
          : Promise.resolve([]),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [kpItems, animeItems, tvMazeItems],
        {
          sort: sort === 'popularity' ? undefined : sort,
          maxItems: 36,
        },
      );

      const extraCount = Math.max(0, merged.length - tmdbRes.items.length);
      return {
        items: merged,
        page: tmdbRes.page,
        totalPages: Math.max(tmdbRes.totalPages, 1),
        totalItems: tmdbRes.totalItems + extraCount,
      };
    });
  }

  async getDetails(id: string, type?: MediaType): Promise<MediaItem | null> {
    const key = `media:details:${type || 'any'}:${id}`;
    return this.cache.wrap(key, 900, () => this.resolveDetailsById(id, type));
  }

  private async resolveDetailsById(id: string, type?: MediaType): Promise<MediaItem | null> {
    const parsed = parsePrefixedMediaId(id);

    if (parsed.provider === 'kinopoisk') {
      return this.kinopoiskProvider.getDetails(parseInt(parsed.rawId, 10));
    }
    if (parsed.provider === 'anime') {
      return this.animeProvider.getDetails(parseInt(parsed.rawId, 10));
    }
    if (parsed.provider === 'tvmaze') {
      return this.tvMazeProvider.getDetails(parseInt(parsed.rawId, 10));
    }
    if (parsed.provider === 'omdb') {
      return this.omdbProvider.getDetails(parsed.rawId);
    }

    if (type === 'tv') {
      const tv = await this.tmdbService.getTvDetails(parsed.rawId);
      return tv ? { ...tv, source: 'tmdb' } : null;
    }
    if (type === 'movie') {
      const movie = await this.tmdbService.getMovieDetails(parsed.rawId);
      return movie ? { ...movie, source: 'tmdb' } : null;
    }

    const movie = await this.tmdbService.getMovieDetails(parsed.rawId);
    if (movie) return { ...movie, source: 'tmdb' };
    const tv = await this.tmdbService.getTvDetails(parsed.rawId);
    return tv ? { ...tv, source: 'tmdb' } : null;
  }

  /**
   * Resolves the exact Kinopoisk movie/series page URL:
   * 0. Direct Kinopoisk ID (if known from Kinopoisk API or kp-<id>)
   * 1. Wikidata SPARQL (TMDB ID -> Kinopoisk ID P2603) -> exact /film/<id>/ or /series/<id>/
   * 2. Yandex Kinopoisk Suggest API -> exact /film/<id>/ or /series/<id>/
   * 3. Fallback to official streaming platform (Иви)
   */
  async resolveKinopoiskUrl(params: {
    tmdbId?: string;
    kinopoiskId?: string;
    type?: MediaType;
    title?: string;
    year?: string;
  }): Promise<string> {
    const rawId = (params.tmdbId || '').trim();
    const mediaType: MediaType = params.type === 'tv' ? 'tv' : 'movie';
    const kpPathType = mediaType === 'tv' ? 'series' : 'film';

    // 0. Direct Kinopoisk ID shortcut
    const explicitKp = (params.kinopoiskId || '').replace(/[^\d]/g, '');
    const prefixedKp = /^kp-(\d+)$/i.exec(rawId)?.[1] || '';
    const directKpId = explicitKp || prefixedKp;
    if (directKpId) {
      return `https://www.kinokino.win/${kpPathType}/${directKpId}/`;
    }

    const isPureNumericTmdb = /^\d+$/.test(rawId);
    const cleanTmdbId = isPureNumericTmdb ? rawId : '';
    const title = (params.title || '').trim();
    const year = (params.year || '').trim();
    const cacheKey = `${mediaType}:${cleanTmdbId || title}:${year}`;

    const cached = this.kpUrlCache.get(cacheKey);
    if (cached) return cached;

    // 1. Wikidata SPARQL lookup by TMDB ID (P4947 = TMDB movie ID, P4983 = TMDB TV ID -> P2603 = Kinopoisk ID)
    if (cleanTmdbId) {
      try {
        const tmdbProp = mediaType === 'tv' ? 'P4983' : 'P4947';
        const sparql = `SELECT ?kp WHERE { ?item wdt:${tmdbProp} "${cleanTmdbId}" . ?item wdt:P2603 ?kp . } LIMIT 1`;
        const wdUrl = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        try {
          const res = await fetch(wdUrl, {
            headers: {
              Accept: 'application/sparql-results+json',
              'User-Agent': '67movies/1.0 (https://localhost)',
            },
            signal: controller.signal,
          });
          if (res.ok) {
            const json: any = await res.json();
            const kpId = json?.results?.bindings?.[0]?.kp?.value;
            if (kpId && /^\d+$/.test(kpId)) {
              const directUrl = `https://www.kinokino.win/${kpPathType}/${kpId}/`;
              this.kpUrlCache.set(cacheKey, directUrl);
              this.logger.log(`Resolved Kinopoisk URL via Wikidata: ${directUrl}`);
              return directUrl;
            }
          }
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        this.logger.warn(`Wikidata KP lookup skipped: ${err}`);
      }
    }

    // 2. Yandex Kinopoisk Suggest API fallback
    if (title) {
      try {
        const suggestUrl = `https://suggest.yandex.ru/suggest-kinopoisk.cgi?part=${encodeURIComponent(
          `${title} ${year}`.trim(),
        )}&v=3`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        try {
          const res = await fetch(suggestUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: controller.signal,
          });
          if (res.ok) {
            const rawText = await res.text();
            const pathMatch = rawText.match(/\/(film|series)\/(\d+)/i);
            if (pathMatch) {
              const directUrl = `https://www.kinokino.win/${pathMatch[1].toLowerCase()}/${pathMatch[2]}/`;
              this.kpUrlCache.set(cacheKey, directUrl);
              this.logger.log(`Resolved Kinopoisk URL via Suggest: ${directUrl}`);
              return directUrl;
            }
          }
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        this.logger.warn(`Kinopoisk suggest lookup skipped: ${err}`);
      }
    }

    // 3. Fallback to official streaming platform (Иви) if title is not found on Kinopoisk
    const fallbackQuery = encodeURIComponent(title || cleanTmdbId);
    return `https://www.ivi.ru/search/?q=${fallbackQuery}`;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { TmdbService } from './tmdb.service';
import { KinopoiskProviderService } from './providers/kinopoisk.provider';
import { AnimeProviderService } from './providers/anime.provider';
import { TvMazeProviderService } from './providers/tvmaze.provider';
import { OmdbProviderService } from './providers/omdb.provider';
import { AniLibertyProviderService } from './providers/aniliberty.provider';
import {
  DiscoverProviderOptions,
  mergeAndDeduplicateMedia,
  parsePrefixedMediaId,
} from './media-aggregator.util';
import { AppCacheService } from '../../common/cache/cache.service';
import {
  Genre,
  MediaItem,
  MediaType,
  PaginatedResult,
  Season,
  StreamSourceGroup,
} from '@cinemaflow/types';

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
    private readonly aniLiberty: AniLibertyProviderService,
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
        { maxItems: 30, requirePoster: true },
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
      const [tmdbRes, kpMovies, alMovies] = await Promise.all([
        this.tmdbService.getPopularMovies(page),
        this.kinopoiskProvider.getPopular('movie', page).catch(() => []),
        this.aniLiberty
          .getCatalog({ page, limit: 8, types: ['MOVIE'], sort: 'rating' })
          .then((r) => r?.items || [])
          .catch(() => []),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [kpMovies, alMovies.slice(0, 8)],
        { maxItems: 36, requirePoster: true },
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
      const [tmdbRes, kpTv, tvMaze, alTv] = await Promise.all([
        this.tmdbService.getPopularTv(page),
        this.kinopoiskProvider.getPopular('tv', page).catch(() => []),
        this.tvMazeProvider.getPopular(page).catch(() => []),
        this.aniLiberty
          .getCatalog({ page, limit: 8, types: ['TV'], sort: 'rating' })
          .then((r) => r?.items || [])
          .catch(() => []),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [kpTv, tvMaze, alTv.slice(0, 8)],
        { maxItems: 36, requirePoster: true },
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
        { maxItems: 36, requirePoster: true },
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
      const [tmdbRes, kpNewTv, tvMazeNew, alNew] = await Promise.all([
        this.tmdbService.getNewTv(page),
        this.kinopoiskProvider.getNew('tv', page).catch(() => []),
        this.tvMazeProvider.getNew(page).catch(() => []),
        this.aniLiberty
          .getCatalog({ page, limit: 8, types: ['TV'], sort: 'popularity' })
          .then((r) => r?.items || [])
          .catch(() => []),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [kpNewTv, tvMazeNew, alNew.slice(0, 8)],
        { maxItems: 36, requirePoster: true },
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
      const [tmdbRes, alRes, kpItems, animeItems, tvMazeItems, omdbItems] = await Promise.all([
        this.tmdbService.searchMulti(trimmed, page),
        this.aniLiberty.getCatalog({ page, limit: 12, search: trimmed }).catch(() => null),
        this.kinopoiskProvider.search(trimmed, page).catch(() => []),
        this.animeProvider.search(trimmed, page).catch(() => []),
        page === 1 ? this.tvMazeProvider.search(trimmed).catch(() => []) : Promise.resolve([]),
        this.omdbProvider.search(trimmed, page).catch(() => []),
      ]);

      const merged = mergeAndDeduplicateMedia(
        [...(alRes?.items || []), ...this.tagTmdb(tmdbRes.items)],
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
      if (parsed.provider === 'aniliberty') {
        return this.aniLiberty.getSeason(parseInt(parsed.rawId, 10), seasonNumber);
      }
      return this.tmdbService.getTvSeason(parsed.rawId, seasonNumber);
    });
  }

  async getGenres(type: MediaType = 'movie', category?: string): Promise<Genre[]> {
    if (category === 'anime') {
      return this.cache.wrap('media:genres:anime:al', 3600, async () => {
        const genres = await this.aniLiberty.getGenres();
        return genres.length > 0 ? genres : this.tmdbService.getGenres('tv');
      });
    }
    return this.cache.wrap(`media:genres:${type}`, 3600, () => this.tmdbService.getGenres(type));
  }

  /**
   * HLS stream groups for an anime episode.
   * Supports direct `al-<id>` as well as `mal-<id>` or TMDB anime IDs by resolving the release in AniLiberty.
   */
  async getAnimeStreams(
    id: string,
    episode = 1,
    extra?: { title?: string; originalTitle?: string; malId?: number },
  ): Promise<StreamSourceGroup[]> {
    const parsed = parsePrefixedMediaId(id);
    if (parsed.provider === 'aniliberty') {
      return this.aniLiberty.getStreams(parseInt(parsed.rawId, 10), episode);
    }

    let title = extra?.title;
    let originalTitle = extra?.originalTitle;
    let malId = extra?.malId || (parsed.provider === 'anime' ? parseInt(parsed.rawId, 10) : undefined);

    if (!title && !originalTitle) {
      const details = await this.getDetails(id).catch(() => null);
      if (details?.anilibertyId) {
        return this.aniLiberty.getStreams(details.anilibertyId, episode);
      }
      title = details?.title;
      originalTitle = details?.originalTitle;
      malId = malId || details?.malId;
    }

    const matched = await this.aniLiberty.findMatchingRelease({ title, originalTitle, malId });
    if (matched?.anilibertyId) {
      return this.aniLiberty.getStreams(matched.anilibertyId, episode);
    }
    return [];
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
    sort: 'popularity' | 'rating' | 'date' | 'date_asc' | 'title_asc' | 'title_desc' | 'votes' = 'popularity',
    extra?: {
      category?: string;
      genreIds?: number[];
      yearFrom?: number;
      yearTo?: number;
      minRating?: number;
      originalLanguage?: string;
      countries?: string[];
      runtime?: 'short' | 'medium' | 'long';
      query?: string;
    },
  ): Promise<PaginatedResult<MediaItem>> {
    const key = `media:discover:${type}:${genreId || 'all'}:${page}:${sort}:${JSON.stringify(extra || {})}`;
    return this.cache.wrap(key, 300, async () => {
      const category = extra?.category || type;

      const providerSort: 'popularity' | 'rating' | 'date' | 'votes' =
        sort === 'rating' || sort === 'date' || sort === 'votes' ? sort : 'popularity';

      // «Аниме» tab: AniLiberty is the primary source (falls back to legacy path if unreachable)
      if (category === 'anime') {
        const anime = await this.aniLiberty.getCatalog({
          page,
          search: extra?.query,
          genreId,
          sort: providerSort,
          yearFrom: extra?.yearFrom,
          yearTo: extra?.yearTo,
          minRating: extra?.minRating,
        });
        if (anime) return anime;
      }
      const isTv = category === 'tv' || category === 'anime' || category === 'dorama';
      const resolvedType: MediaType = isTv ? 'tv' : 'movie';

      const providerOptions: DiscoverProviderOptions = {
        type: resolvedType,
        category,
        genreId,
        page,
        sort: providerSort,
        yearFrom: extra?.yearFrom,
        yearTo: extra?.yearTo,
        minRating: extra?.minRating,
        originalLanguage: extra?.originalLanguage,
      };

      const shouldQueryAnime =
        category === 'anime' ||
        category === 'cartoons' ||
        genreId === 16 ||
        extra?.originalLanguage === 'ja' ||
        (category === 'movie' && !extra?.originalLanguage);
      const shouldQueryTvMaze = category === 'tv';

      const [tmdbRes, kpItems, animeItems, tvMazeItems] = await Promise.all([
        this.tmdbService.discoverByGenre(type, genreId, page, sort, extra),
        extra?.countries?.length || extra?.runtime
          ? Promise.resolve([])
          : this.kinopoiskProvider.discover(providerOptions).catch(() => []),
        shouldQueryAnime && !extra?.countries?.length && !extra?.runtime
          ? this.animeProvider.discover(providerOptions).catch(() => [])
          : Promise.resolve([]),
        shouldQueryTvMaze && !extra?.countries?.length && !extra?.runtime
          ? this.tvMazeProvider.discover(providerOptions).catch(() => [])
          : Promise.resolve([]),
      ]);

      const merged = mergeAndDeduplicateMedia(
        this.tagTmdb(tmdbRes.items),
        [
          kpItems,
          category === 'movie' ? animeItems.slice(0, 10) : animeItems,
          tvMazeItems,
        ],
        {
          sort: providerSort === 'popularity' ? undefined : providerSort,
          maxItems: 48,
          requirePoster: true,
        },
      );

      if (sort === 'date_asc') {
        merged.sort((a, b) => (a.releaseYear || 9999) - (b.releaseYear || 9999));
      } else if (sort === 'title_asc') {
        merged.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
      } else if (sort === 'title_desc') {
        merged.sort((a, b) => b.title.localeCompare(a.title, 'ru'));
      }

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
      const animeItem = await this.animeProvider.getDetails(parseInt(parsed.rawId, 10));
      return this.enrichAnimeWithAniLiberty(animeItem);
    }
    if (parsed.provider === 'tvmaze') {
      return this.tvMazeProvider.getDetails(parseInt(parsed.rawId, 10));
    }
    if (parsed.provider === 'omdb') {
      return this.omdbProvider.getDetails(parsed.rawId);
    }
    if (parsed.provider === 'aniliberty') {
      return this.aniLiberty.getDetails(parseInt(parsed.rawId, 10));
    }

    if (type === 'tv') {
      const tv = await this.tmdbService.getTvDetails(parsed.rawId);
      return this.enrichAnimeWithAniLiberty(tv ? { ...tv, source: 'tmdb' } : null);
    }
    if (type === 'movie') {
      const movie = await this.tmdbService.getMovieDetails(parsed.rawId);
      return this.enrichAnimeWithAniLiberty(movie ? { ...movie, source: 'tmdb' } : null);
    }

    const movie = await this.tmdbService.getMovieDetails(parsed.rawId);
    if (movie) return this.enrichAnimeWithAniLiberty({ ...movie, source: 'tmdb' });
    const tv = await this.tmdbService.getTvDetails(parsed.rawId);
    return this.enrichAnimeWithAniLiberty(tv ? { ...tv, source: 'tmdb' } : null);
  }

  private async enrichAnimeWithAniLiberty(item: MediaItem | null): Promise<MediaItem | null> {
    if (!item || item.anilibertyId) return item;
    const isAnime =
      item.source === 'jikan' ||
      item.source === 'shikimori' ||
      item.source === 'aniliberty' ||
      Boolean(item.malId) ||
      Boolean(item.genres?.some((g) => g.id === 16 || /аниме|anime/i.test(g.name))) ||
      Boolean(item.originalTitle && /[\u3040-\u30ff\u4e00-\u9faf]/.test(item.originalTitle));
    if (!isAnime) return item;

    try {
      const alDetail = await this.aniLiberty.findMatchingRelease({
        title: item.title,
        originalTitle: item.originalTitle,
        malId: item.malId,
      });
      if (!alDetail?.anilibertyId) return item;
      return {
        ...item,
        anilibertyId: alDetail.anilibertyId,
        voiceovers: alDetail.voiceovers,
        voiceTeamName: alDetail.voiceTeamName,
        seasons: alDetail.seasons && alDetail.seasons.length > 0 ? alDetail.seasons : item.seasons,
      };
    } catch {
      return item;
    }
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

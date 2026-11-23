import { Injectable, Logger } from '@nestjs/common';
import { TmdbService } from './tmdb.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { Genre, MediaItem, MediaType, PaginatedResult, Season } from '@cinemaflow/types';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly kpUrlCache = new Map<string, string>();

  constructor(
    private readonly tmdbService: TmdbService,
    private readonly cache: AppCacheService,
  ) {}

  async getTrending(mediaType: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'day', page = 1): Promise<PaginatedResult<MediaItem>> {
    return this.cache.wrap(`media:trending:${mediaType}:${timeWindow}:${page}`, 600, () =>
      this.tmdbService.getTrending(mediaType, timeWindow, page),
    );
  }

  async getPopularMovies(page = 1): Promise<PaginatedResult<MediaItem>> {
    return this.cache.wrap(`media:pop:movie:${page}`, 600, () =>
      this.tmdbService.getPopularMovies(page),
    );
  }

  async getPopularTv(page = 1): Promise<PaginatedResult<MediaItem>> {
    return this.cache.wrap(`media:pop:tv:${page}`, 600, () =>
      this.tmdbService.getPopularTv(page),
    );
  }

  async getNewMovies(page = 1): Promise<PaginatedResult<MediaItem>> {
    return this.cache.wrap(`media:new:movie:${page}`, 600, () =>
      this.tmdbService.getNewMovies(page),
    );
  }

  async getNewTv(page = 1): Promise<PaginatedResult<MediaItem>> {
    return this.cache.wrap(`media:new:tv:${page}`, 600, () =>
      this.tmdbService.getNewTv(page),
    );
  }

  async search(query: string, page = 1): Promise<PaginatedResult<MediaItem>> {
    const key = `media:search:${query.trim().toLowerCase()}:${page}`;
    return this.cache.wrap(key, 180, () => this.tmdbService.searchMulti(query, page));
  }

  async getMovieDetails(id: string | number): Promise<MediaItem | null> {
    return this.cache.wrap(`media:movie:${id}`, 900, () => this.tmdbService.getMovieDetails(id));
  }

  async getTvDetails(id: string | number): Promise<MediaItem | null> {
    return this.cache.wrap(`media:tv:${id}`, 900, () => this.tmdbService.getTvDetails(id));
  }

  async getTvSeason(tvId: string | number, seasonNumber: number): Promise<Season | null> {
    return this.cache.wrap(`media:tv:${tvId}:s:${seasonNumber}`, 900, () =>
      this.tmdbService.getTvSeason(tvId, seasonNumber),
    );
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
    }
  ): Promise<PaginatedResult<MediaItem>> {
    const key = `media:discover:${type}:${genreId || 'all'}:${page}:${sort}:${JSON.stringify(extra || {})}`;
    return this.cache.wrap(key, 300, () =>
      this.tmdbService.discoverByGenre(type, genreId, page, sort, extra),
    );
  }

  async getDetails(id: string, type?: MediaType): Promise<MediaItem | null> {
    if (type === 'tv') {
      return this.tmdbService.getTvDetails(id);
    }
    if (type === 'movie') {
      return this.tmdbService.getMovieDetails(id);
    }

    // Try movie first, then TV
    const movie = await this.tmdbService.getMovieDetails(id);
    if (movie) return movie;
    return this.tmdbService.getTvDetails(id);
  }

  /**
   * Resolves the exact Kinopoisk movie/series page URL:
   * 1. Wikidata SPARQL (TMDB ID -> Kinopoisk ID P2603) -> exact /film/<id>/ or /series/<id>/
   * 2. Yandex Kinopoisk Suggest API -> exact /film/<id>/ or /series/<id>/
   * 3. Fallback to Kinopoisk search results page
   */
  async resolveKinopoiskUrl(params: {
    tmdbId?: string;
    type?: MediaType;
    title?: string;
    year?: string;
  }): Promise<string> {
    const cleanTmdbId = (params.tmdbId || '').replace(/[^\d]/g, '');
    const mediaType: MediaType = params.type === 'tv' ? 'tv' : 'movie';
    const title = (params.title || '').trim();
    const year = (params.year || '').trim();
    const cacheKey = `${mediaType}:${cleanTmdbId || title}:${year}`;

    const cached = this.kpUrlCache.get(cacheKey);
    if (cached) return cached;

    const kpPathType = mediaType === 'tv' ? 'series' : 'film';

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
          `${title} ${year}`.trim()
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
            // Extract first Kinopoisk film/series ID from suggest JSON payload (e.g. "/film/4540126/" or "film/4540126")
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

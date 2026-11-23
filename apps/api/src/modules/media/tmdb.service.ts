import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  Genre,
  MediaItem,
  MediaType,
  PaginatedResult,
  Person,
  Season,
  Episode,
} from '@cinemaflow/types';
import {
  TmdbMovieDetailsResponse,
  TmdbTvDetailsResponse,
  TmdbMovieResult,
  TmdbTvResult,
  TmdbPaginatedResponse,
  TmdbMultiSearchResult,
  TmdbSeasonResponse,
  TmdbGenre,
} from './types/tmdb.types';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly imageBaseUrl: string;
  private readonly http: AxiosInstance;
  private genreCache: Map<number, string> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {
    this.apiKey = this.configService.get<string>('TMDB_API_KEY', '').trim();
    this.baseUrl = this.configService.get<string>('TMDB_BASE_URL', 'https://api.themoviedb.org/3');
    this.imageBaseUrl = this.configService.get<string>(
      'TMDB_IMAGE_BASE_URL',
      'https://image.tmdb.org/t/p'
    );

    // Initialize Axios with default configuration
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    // If API key is a v4 Bearer token (starts with eyJ)
    if (this.apiKey.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 8000,
      headers,
    });
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  /**
   * Helper to format full image URL with specified size
   */
  getImageUrl(path: string | null | undefined, size: 'original' | 'w500' | 'w780' | 'w185' = 'original'): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.imageBaseUrl}/${size}${cleanPath}`;
  }

  /**
   * Generic cached HTTP GET request wrapper
   */
  private async fetchTmdb<T>(endpoint: string, params: Record<string, any> = {}, ttlSeconds = 1800): Promise<T | null> {
    const queryParams: Record<string, any> = {
      language: 'ru-RU',
      ...params,
    };

    // If using v3 API key
    if (this.isConfigured && !this.apiKey.startsWith('eyJ')) {
      queryParams['api_key'] = this.apiKey;
    }

    const cacheKey = `tmdb:${endpoint}:${JSON.stringify(queryParams)}`;
    const cached = await this.redisService.get<T>(cacheKey);
    if (cached) return cached;

    if (!this.isConfigured) {
      this.logger.debug(`TMDB API key not set. Using built-in cinema database for endpoint: ${endpoint}`);
      return null;
    }

    try {
      const response = await this.http.get<T>(endpoint, { params: queryParams });
      if (response.data) {
        await this.redisService.set(cacheKey, response.data, ttlSeconds);
        return response.data;
      }
      return null;
    } catch (err: any) {
      this.logger.warn(`TMDB request error [${endpoint}]: ${err.message}`);
      return null;
    }
  }

  // =========================================================================
  // 1. Популярные фильмы (Popular Movies)
  // =========================================================================
  async getPopularMovies(page = 1): Promise<PaginatedResult<MediaItem>> {
    const data = await this.fetchTmdb<TmdbPaginatedResponse<TmdbMovieResult>>(
      '/discover/movie',
      {
        sort_by: 'popularity.desc',
        'vote_count.gte': 300,
        include_adult: false,
        page,
      },
      1800
    );
    if (!data) return this.getFallbackMovies(page);

    const items = await Promise.all(data.results.map((m) => this.mapMovieResultToMediaItem(m)));
    return {
      items,
      page: data.page,
      totalPages: data.total_pages,
      totalItems: data.total_results,
    };
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
    const category = extra?.category || type;
    const isTv = category === 'tv' || category === 'anime' || category === 'dorama';
    const resolvedType: MediaType = isTv ? 'tv' : 'movie';
    const endpoint = isTv ? '/discover/tv' : '/discover/movie';
    const today = new Date().toISOString().split('T')[0];

    const sortByParam =
      sort === 'rating'
        ? 'vote_average.desc'
        : sort === 'votes'
        ? 'vote_count.desc'
        : sort === 'date'
        ? isTv
          ? 'first_air_date.desc'
          : 'primary_release_date.desc'
        : 'popularity.desc';

    const params: Record<string, any> = {
      sort_by: sortByParam,
      include_adult: false,
      page,
    };

    // Combine category-implied genres with user-selected genre
    const genreList: number[] = [];
    if (category === 'cartoons' || category === 'anime') genreList.push(16);
    if (category === 'documentary') genreList.push(99);
    if (genreId && genreId > 0 && !genreList.includes(genreId)) {
      genreList.push(genreId);
    }
    if (genreList.length > 0) {
      params.with_genres = genreList.join(',');
    }

    // Category-implied original language
    if (category === 'anime') {
      params.with_original_language = 'ja';
    } else if (category === 'dorama') {
      params.with_original_language = 'ko';
    } else if (extra?.originalLanguage) {
      params.with_original_language = extra.originalLanguage;
    }

    // Year range filters
    const dateField = isTv ? 'first_air_date' : 'primary_release_date';
    if (extra?.yearFrom && extra.yearFrom >= 1900) {
      params[`${dateField}.gte`] = `${extra.yearFrom}-01-01`;
    }
    if (extra?.yearTo && extra.yearTo >= 1900) {
      params[`${dateField}.lte`] = `${extra.yearTo}-12-31`;
    } else if (sort === 'date') {
      params[`${dateField}.lte`] = today;
    }

    // Rating filter
    if (extra?.minRating && extra.minRating > 0) {
      params['vote_average.gte'] = extra.minRating;
    }

    // Sensible vote_count floor (relaxed so more movies, anime & regional titles appear)
    if (sort === 'rating') {
      params['vote_count.gte'] = isTv ? 50 : 100;
    } else if (sort === 'date') {
      params['vote_count.gte'] = 5;
    } else if (sort === 'popularity') {
      params['vote_count.gte'] =
        category === 'documentary' ||
        category === 'dorama' ||
        category === 'anime' ||
        extra?.originalLanguage === 'ru'
          ? 10
          : isTv
          ? 25
          : 40;
    }

    // Fetch 2 TMDB pages per catalog page in parallel to double catalog density
    const tmdbPage1 = Math.max(1, page * 2 - 1);
    const tmdbPage2 = tmdbPage1 + 1;

    const [data1, data2] = await Promise.all([
      this.fetchTmdb<TmdbPaginatedResponse<any>>(endpoint, { ...params, page: tmdbPage1 }, 1800),
      this.fetchTmdb<TmdbPaginatedResponse<any>>(endpoint, { ...params, page: tmdbPage2 }, 1800),
    ]);

    if (!data1) {
      return isTv ? this.getFallbackSeries(page) : this.getFallbackMovies(page);
    }

    const combinedResults = [
      ...(data1.results || []),
      ...(data2?.results || []),
    ].filter((item) => Boolean(item?.poster_path));

    const items = await Promise.all(
      combinedResults.map((item) =>
        isTv ? this.mapTvResultToMediaItem(item) : this.mapMovieResultToMediaItem(item)
      )
    );

    return {
      items,
      page,
      totalPages: Math.max(1, Math.ceil((data1.total_pages || 1) / 2)),
      totalItems: data1.total_results,
    };
  }

  // =========================================================================
  // 2. Популярные сериалы (Popular TV Shows)
  // =========================================================================
  async getPopularTv(page = 1): Promise<PaginatedResult<MediaItem>> {
    const data = await this.fetchTmdb<TmdbPaginatedResponse<TmdbTvResult>>(
      '/discover/tv',
      {
        sort_by: 'popularity.desc',
        'vote_count.gte': 150,
        include_adult: false,
        page,
      },
      1800
    );
    if (!data) return this.getFallbackSeries(page);

    const items = await Promise.all(data.results.map((tv) => this.mapTvResultToMediaItem(tv)));
    return {
      items,
      page: data.page,
      totalPages: data.total_pages,
      totalItems: data.total_results,
    };
  }

  // =========================================================================
  // 3. Новинки фильмов (Now Playing / New Movies)
  // =========================================================================
  async getNewMovies(page = 1): Promise<PaginatedResult<MediaItem>> {
    const data = await this.fetchTmdb<TmdbPaginatedResponse<TmdbMovieResult>>('/movie/now_playing', { page }, 1800);
    if (!data) return this.getFallbackMovies(page);

    const items = await Promise.all(data.results.map((m) => this.mapMovieResultToMediaItem(m)));
    return {
      items,
      page: data.page,
      totalPages: data.total_pages,
      totalItems: data.total_results,
    };
  }

  // =========================================================================
  // 4. Новинки сериалов (On The Air TV)
  // =========================================================================
  async getNewTv(page = 1): Promise<PaginatedResult<MediaItem>> {
    const data = await this.fetchTmdb<TmdbPaginatedResponse<TmdbTvResult>>('/tv/on_the_air', { page }, 1800);
    if (!data) return this.getFallbackSeries(page);

    const items = await Promise.all(data.results.map((tv) => this.mapTvResultToMediaItem(tv)));
    return {
      items,
      page: data.page,
      totalPages: data.total_pages,
      totalItems: data.total_results,
    };
  }

  // =========================================================================
  // 5. Тренды (Trending: movies, tv, all)
  // =========================================================================
  async getTrending(mediaType: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'day', page = 1): Promise<PaginatedResult<MediaItem>> {
    const data = await this.fetchTmdb<TmdbPaginatedResponse<TmdbMultiSearchResult>>(
      `/trending/${mediaType}/${timeWindow}`,
      { page },
      1800
    );

    if (!data) {
      return mediaType === 'tv' ? this.getFallbackSeries(page) : this.getFallbackMovies(page);
    }

    const items: MediaItem[] = [];
    for (const r of data.results) {
      if (r.media_type === 'movie') {
        items.push(await this.mapMovieResultToMediaItem(r as any));
      } else if (r.media_type === 'tv') {
        items.push(await this.mapTvResultToMediaItem(r as any));
      }
    }

    return {
      items,
      page: data.page,
      totalPages: data.total_pages,
      totalItems: data.total_results,
    };
  }

  // =========================================================================
  // 6. Поиск фильмов и сериалов (Multi Search)
  // =========================================================================
  async searchMulti(query: string, page = 1): Promise<PaginatedResult<MediaItem>> {
    if (!query || !query.trim()) {
      return { items: [], page: 1, totalPages: 1, totalItems: 0 };
    }

    const data = await this.fetchTmdb<TmdbPaginatedResponse<TmdbMultiSearchResult>>(
      '/search/multi',
      { query: query.trim(), page },
      600
    );

    if (!data) {
      // Fallback local search
      const q = query.toLowerCase();
      const all = [...this.getFallbackMovies(1).items, ...this.getFallbackSeries(1).items];
      const filtered = all.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.overview.toLowerCase().includes(q) ||
          (m.originalTitle && m.originalTitle.toLowerCase().includes(q))
      );
      return { items: filtered, page: 1, totalPages: 1, totalItems: filtered.length };
    }

    const items: MediaItem[] = [];
    for (const r of data.results) {
      if (r.media_type === 'movie') {
        items.push(await this.mapMovieResultToMediaItem(r as any));
      } else if (r.media_type === 'tv') {
        items.push(await this.mapTvResultToMediaItem(r as any));
      }
    }

    return {
      items,
      page: data.page,
      totalPages: data.total_pages,
      totalItems: data.total_results,
    };
  }

  // =========================================================================
  // 7. Подробная информация о фильме (Movie Details with Cast, Age & Recs)
  // =========================================================================
  async getMovieDetails(id: string | number): Promise<MediaItem | null> {
    const data = await this.fetchTmdb<TmdbMovieDetailsResponse>(
      `/movie/${id}`,
      { append_to_response: 'credits,release_dates,recommendations,similar' },
      7200
    );

    if (!data) {
      return this.findInFallback(String(id), 'movie');
    }

    return this.mapMovieDetailsToMediaItem(data);
  }

  // =========================================================================
  // 8. Подробная информация о сериале (TV Details with Seasons, Cast & Age)
  // =========================================================================
  async getTvDetails(id: string | number): Promise<MediaItem | null> {
    const data = await this.fetchTmdb<TmdbTvDetailsResponse>(
      `/tv/${id}`,
      { append_to_response: 'credits,content_ratings,recommendations,similar' },
      7200
    );

    if (!data) {
      return this.findInFallback(String(id), 'tv');
    }

    return this.mapTvDetailsToMediaItem(data);
  }

  // =========================================================================
  // 9. Сезоны и эпизоды сериала (TV Season & Episodes)
  // =========================================================================
  async getTvSeason(tvId: string | number, seasonNumber: number): Promise<Season | null> {
    const data = await this.fetchTmdb<TmdbSeasonResponse>(
      `/tv/${tvId}/season/${seasonNumber}`,
      {},
      7200
    );

    if (!data) {
      const tv = this.findInFallback(String(tvId), 'tv');
      return tv?.seasons?.find((s) => s.seasonNumber === seasonNumber) || null;
    }

    const episodes: Episode[] = data.episodes.map((ep) => ({
      id: ep.id,
      seasonNumber: ep.season_number,
      episodeNumber: ep.episode_number,
      name: ep.name || `Серия ${ep.episode_number}`,
      overview: ep.overview,
      stillPath: this.getImageUrl(ep.still_path, 'w500'),
      airDate: ep.air_date,
      voteAverage: Number((ep.vote_average || 0).toFixed(1)),
      durationMinutes: ep.runtime || 45,
    }));

    return {
      id: data.id,
      seasonNumber: data.season_number,
      name: data.name || `Сезон ${data.season_number}`,
      overview: data.overview,
      posterPath: this.getImageUrl(data.poster_path, 'w500'),
      airDate: data.air_date,
      episodeCount: episodes.length,
      episodes,
    };
  }

  // =========================================================================
  // 10. Жанры (Genres List)
  // =========================================================================
  async getCalendarReleases(year: number, month: number, type: 'all' | 'movie' | 'tv' = 'all') {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const tasks: Promise<MediaItem[]>[] = [];

    if (type === 'all' || type === 'movie') {
      tasks.push(
        this.fetchTmdb<TmdbPaginatedResponse<TmdbMovieResult>>(
          '/discover/movie',
          {
            'primary_release_date.gte': startDate,
            'primary_release_date.lte': endDate,
            sort_by: 'popularity.desc',
            include_adult: false,
            page: 1,
          },
          3600
        ).then(async (res) => {
          if (!res?.results) return [];
          return Promise.all(
            res.results
              .filter((m) => m.release_date)
              .map((m) => this.mapMovieResultToMediaItem(m))
          );
        })
      );
    }

    if (type === 'all' || type === 'tv') {
      tasks.push(
        this.fetchTmdb<TmdbPaginatedResponse<TmdbTvResult>>(
          '/discover/tv',
          {
            'first_air_date.gte': startDate,
            'first_air_date.lte': endDate,
            sort_by: 'popularity.desc',
            include_adult: false,
            page: 1,
          },
          3600
        ).then(async (res) => {
          if (!res?.results) return [];
          return Promise.all(
            res.results
              .filter((tv) => tv.first_air_date)
              .map((tv) => this.mapTvResultToMediaItem(tv))
          );
        })
      );
    }

    const combined = (await Promise.all(tasks)).flat();
    const grouped: Record<string, MediaItem[]> = {};

    for (const item of combined) {
      const dateKey = (item.releaseDate || '').slice(0, 10);
      if (!dateKey) continue;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(item);
    }

    const days = Object.keys(grouped)
      .sort()
      .map((date) => ({
        date,
        items: grouped[date].slice(0, 10),
      }));

    return { year, month, days };
  }

  async getGenres(type: MediaType = 'movie'): Promise<Genre[]> {
    const endpoint = type === 'tv' ? '/genre/tv/list' : '/genre/movie/list';
    const data = await this.fetchTmdb<{ genres: TmdbGenre[] }>(endpoint, {}, 86400);

    if (data?.genres) {
      data.genres.forEach((g) => this.genreCache.set(g.id, g.name));
      return data.genres;
    }

    return this.getDefaultGenres();
  }

  // =========================================================================
  // Data Mappers & Formatters
  // =========================================================================

  private async mapMovieResultToMediaItem(m: TmdbMovieResult): Promise<MediaItem> {
    const year = m.release_date ? new Date(m.release_date).getFullYear() : 2024;
    const genres = await this.resolveGenreNames(m.genre_ids || []);

    return {
      id: String(m.id),
      tmdbId: m.id,
      type: 'movie',
      title: m.title || m.original_title,
      originalTitle: m.original_title,
      overview: m.overview || 'Описание фильма временно отсутствует.',
      posterPath: this.getImageUrl(m.poster_path, 'w500'),
      backdropPath: this.getImageUrl(m.backdrop_path, 'original'),
      releaseDate: m.release_date,
      releaseYear: isNaN(year) ? 2024 : year,
      voteAverage: Number((m.vote_average || 0).toFixed(1)),
      voteCount: m.vote_count,
      ageRating: m.adult ? '18+' : '16+',
      genres,
    };
  }

  private async mapTvResultToMediaItem(tv: TmdbTvResult): Promise<MediaItem> {
    const year = tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : 2024;
    const genres = await this.resolveGenreNames(tv.genre_ids || []);

    return {
      id: String(tv.id),
      tmdbId: tv.id,
      type: 'tv',
      title: tv.name || tv.original_name,
      originalTitle: tv.original_name,
      overview: tv.overview || 'Описание сериала временно отсутствует.',
      posterPath: this.getImageUrl(tv.poster_path, 'w500'),
      backdropPath: this.getImageUrl(tv.backdrop_path, 'original'),
      releaseDate: tv.first_air_date,
      releaseYear: isNaN(year) ? 2024 : year,
      voteAverage: Number((tv.vote_average || 0).toFixed(1)),
      voteCount: tv.vote_count,
      ageRating: '16+',
      genres,
    };
  }

  private mapMovieDetailsToMediaItem(d: TmdbMovieDetailsResponse): MediaItem {
    const year = d.release_date ? new Date(d.release_date).getFullYear() : 2024;
    const ageRating = this.extractAgeRatingMovie(d.release_dates);

    const cast: Person[] = d.credits?.cast
      ? d.credits.cast.slice(0, 14).map((c) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profilePath: this.getImageUrl(c.profile_path, 'w185'),
        }))
      : [];

    const recommendations: MediaItem[] = d.recommendations?.results
      ? d.recommendations.results.slice(0, 8).map((r) => ({
          id: String(r.id),
          tmdbId: r.id,
          type: 'movie',
          title: r.title,
          originalTitle: r.original_title,
          overview: r.overview,
          posterPath: this.getImageUrl(r.poster_path, 'w500'),
          backdropPath: this.getImageUrl(r.backdrop_path, 'original'),
          releaseYear: r.release_date ? new Date(r.release_date).getFullYear() : 2024,
          voteAverage: Number((r.vote_average || 0).toFixed(1)),
          genres: [],
        }))
      : [];

    return {
      id: String(d.id),
      tmdbId: d.id,
      imdbId: d.imdb_id || undefined,
      type: 'movie',
      title: d.title || d.original_title,
      originalTitle: d.original_title,
      tagline: d.tagline || undefined,
      overview: d.overview || 'Описание фильма временно отсутствует.',
      posterPath: this.getImageUrl(d.poster_path, 'w500'),
      backdropPath: this.getImageUrl(d.backdrop_path, 'original'),
      releaseDate: d.release_date,
      releaseYear: isNaN(year) ? 2024 : year,
      voteAverage: Number((d.vote_average || 0).toFixed(1)),
      voteCount: d.vote_count,
      durationMinutes: d.runtime || 120,
      ageRating,
      genres: d.genres || [],
      cast,
      recommendations,
    };
  }

  private mapTvDetailsToMediaItem(d: TmdbTvDetailsResponse): MediaItem {
    const year = d.first_air_date ? new Date(d.first_air_date).getFullYear() : 2024;
    const ageRating = this.extractAgeRatingTv(d.content_ratings);

    const cast: Person[] = d.credits?.cast
      ? d.credits.cast.slice(0, 14).map((c) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profilePath: this.getImageUrl(c.profile_path, 'w185'),
        }))
      : [];

    const seasons: Season[] = d.seasons
      ? d.seasons
          .filter((s) => s.season_number > 0) // exclude specials (season 0)
          .map((s) => ({
            id: s.id,
            seasonNumber: s.season_number,
            name: s.name || `Сезон ${s.season_number}`,
            overview: s.overview,
            posterPath: this.getImageUrl(s.poster_path, 'w500'),
            airDate: s.air_date,
            episodeCount: s.episode_count,
          }))
      : [];

    const recommendations: MediaItem[] = d.recommendations?.results
      ? d.recommendations.results.slice(0, 8).map((r) => ({
          id: String(r.id),
          tmdbId: r.id,
          type: 'tv',
          title: r.name,
          originalTitle: r.original_name,
          overview: r.overview,
          posterPath: this.getImageUrl(r.poster_path, 'w500'),
          backdropPath: this.getImageUrl(r.backdrop_path, 'original'),
          releaseYear: r.first_air_date ? new Date(r.first_air_date).getFullYear() : 2024,
          voteAverage: Number((r.vote_average || 0).toFixed(1)),
          genres: [],
        }))
      : [];

    return {
      id: String(d.id),
      tmdbId: d.id,
      type: 'tv',
      title: d.name || d.original_name,
      originalTitle: d.original_name,
      tagline: d.tagline || undefined,
      overview: d.overview || 'Описание сериала временно отсутствует.',
      posterPath: this.getImageUrl(d.poster_path, 'w500'),
      backdropPath: this.getImageUrl(d.backdrop_path, 'original'),
      releaseDate: d.first_air_date,
      releaseYear: isNaN(year) ? 2024 : year,
      voteAverage: Number((d.vote_average || 0).toFixed(1)),
      voteCount: d.vote_count,
      durationMinutes: d.episode_run_time?.[0] || 50,
      ageRating,
      genres: d.genres || [],
      cast,
      seasons,
      recommendations,
    };
  }

  private extractAgeRatingMovie(releaseDates?: { results: any[] }): string {
    if (!releaseDates?.results) return '16+';
    const ru = releaseDates.results.find((r) => r.iso_3166_1 === 'RU');
    if (ru?.release_dates?.[0]?.certification) {
      const c = ru.release_dates[0].certification;
      if (c.includes('18')) return '18+';
      if (c.includes('16')) return '16+';
      if (c.includes('12')) return '12+';
      if (c.includes('6')) return '6+';
      if (c.includes('0')) return '0+';
    }

    const us = releaseDates.results.find((r) => r.iso_3166_1 === 'US');
    if (us?.release_dates?.[0]?.certification) {
      const c = us.release_dates[0].certification;
      if (c === 'R' || c === 'NC-17') return '18+';
      if (c === 'PG-13') return '16+';
      if (c === 'PG') return '12+';
      if (c === 'G') return '0+';
    }
    return '16+';
  }

  private extractAgeRatingTv(contentRatings?: { results: any[] }): string {
    if (!contentRatings?.results) return '16+';
    const ru = contentRatings.results.find((r) => r.iso_3166_1 === 'RU');
    if (ru?.rating) {
      if (ru.rating.includes('18')) return '18+';
      if (ru.rating.includes('16')) return '16+';
      if (ru.rating.includes('12')) return '12+';
    }
    const us = contentRatings.results.find((r) => r.iso_3166_1 === 'US');
    if (us?.rating) {
      if (us.rating === 'TV-MA') return '18+';
      if (us.rating === 'TV-14') return '16+';
      if (us.rating === 'TV-PG') return '12+';
    }
    return '16+';
  }

  private async resolveGenreNames(ids: number[]): Promise<Genre[]> {
    if (this.genreCache.size === 0) {
      this.getDefaultGenres().forEach((g) => this.genreCache.set(g.id, g.name));
    }
    return ids.map((id) => ({
      id,
      name: this.genreCache.get(id) || 'Кино',
    }));
  }

  private getDefaultGenres(): Genre[] {
    return [
      { id: 28, name: 'Боевик' },
      { id: 12, name: 'Приключения' },
      { id: 16, name: 'Мультфильм' },
      { id: 35, name: 'Комедия' },
      { id: 80, name: 'Криминал' },
      { id: 99, name: 'Документальный' },
      { id: 18, name: 'Драма' },
      { id: 10751, name: 'Семейный' },
      { id: 14, name: 'Фэнтези' },
      { id: 36, name: 'История' },
      { id: 27, name: 'Ужасы' },
      { id: 10402, name: 'Музыка' },
      { id: 9648, name: 'Детектив' },
      { id: 10749, name: 'Мелодрама' },
      { id: 878, name: 'Фантастика' },
      { id: 10770, name: 'Телефильм' },
      { id: 53, name: 'Триллер' },
      { id: 10752, name: 'Военный' },
      { id: 37, name: 'Вестерн' },
      { id: 10759, name: 'Боевик и Приключения' },
      { id: 10765, name: 'НФ и Фэнтези' },
    ];
  }

  // =========================================================================
  // Fallback Rich Cinema Database (Active if API key not set or offline)
  // =========================================================================
  private getFallbackMovies(page = 1): PaginatedResult<MediaItem> {
    const list: MediaItem[] = [
      {
        id: '693134',
        tmdbId: 693134,
        type: 'movie',
        title: 'Дюна: Часть вторая',
        originalTitle: 'Dune: Part Two',
        tagline: 'Да пребудет с тобой сила песков',
        overview:
          'Пол Атрейдес объединяется с Чани и фременами, чтобы отомстить заговорщикам, уничтожившим его семью.',
        posterPath: 'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg',
        backdropPath: 'https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s520Wvu.jpg',
        releaseYear: 2024,
        releaseDate: '2024-03-01',
        voteAverage: 8.6,
        voteCount: 4800,
        ageRating: '16+',
        genres: [{ id: 878, name: 'Фантастика' }, { id: 12, name: 'Приключения' }],
      },
      {
        id: '872585',
        tmdbId: 872585,
        type: 'movie',
        title: 'Оппенгеймер',
        originalTitle: 'Oppenheimer',
        tagline: 'Мир изменится навсегда',
        overview:
          'История жизни американского физика-теоретика Роберта Оппенгеймера, который руководил Манхэттенским проектом.',
        posterPath: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
        backdropPath: 'https://image.tmdb.org/t/p/original/rM5Y09xC99JEapXKN508z9BL9eb.jpg',
        releaseYear: 2023,
        releaseDate: '2023-07-21',
        voteAverage: 8.9,
        voteCount: 8200,
        ageRating: '18+',
        genres: [{ id: 18, name: 'Драма' }, { id: 36, name: 'История' }],
      },
      {
        id: '157336',
        tmdbId: 157336,
        type: 'movie',
        title: 'Интерстеллар',
        originalTitle: 'Interstellar',
        tagline: 'Следующий шаг человечества станет величайшим',
        overview:
          'Когда засуха приводит человечество к кризису, группа исследователей отправляется сквозь червоточину в поисках нового дома.',
        posterPath: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
        backdropPath: 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
        releaseYear: 2014,
        releaseDate: '2014-11-05',
        voteAverage: 8.7,
        voteCount: 34500,
        ageRating: '16+',
        genres: [{ id: 878, name: 'Фантастика' }, { id: 18, name: 'Драма' }],
      },
      {
        id: '335984',
        tmdbId: 335984,
        type: 'movie',
        title: 'Бегущий по лезвию 2049',
        originalTitle: 'Blade Runner 2049',
        tagline: 'Ключ к будущему спрятан в прошлом',
        overview:
          'Офицер полиции Лос-Анджелеса Кей обнаруживает погребенную тайну, способную повергнуть общество в хаос.',
        posterPath: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
        backdropPath: 'https://image.tmdb.org/t/p/original/sAtoMqDVhNDQBc3QJL3RF6hlxGq.jpg',
        releaseYear: 2017,
        releaseDate: '2017-10-06',
        voteAverage: 8.1,
        voteCount: 13200,
        ageRating: '18+',
        genres: [{ id: 878, name: 'Фантастика' }, { id: 9648, name: 'Детектив' }],
      },
    ];

    return { items: list, page, totalPages: 1, totalItems: list.length };
  }

  private getFallbackSeries(page = 1): PaginatedResult<MediaItem> {
    const list: MediaItem[] = [
      {
        id: '126308',
        tmdbId: 126308,
        type: 'tv',
        title: 'Сёгун',
        originalTitle: 'Shōgun',
        tagline: 'Борьба за власть в сердце феодальной Японии',
        overview:
          'Япония, 1600 год. Лорд Ёси Торанага борется за жизнь против врагов из Регентского совета.',
        posterPath: 'https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg',
        backdropPath: 'https://image.tmdb.org/t/p/original/zW0v23STNXJ2XfmgY6bU9q81b6N.jpg',
        releaseYear: 2024,
        releaseDate: '2024-02-27',
        voteAverage: 8.8,
        voteCount: 1100,
        ageRating: '18+',
        genres: [{ id: 18, name: 'Драма' }, { id: 36, name: 'История' }],
        seasons: [
          {
            id: 1,
            seasonNumber: 1,
            name: 'Сезон 1',
            episodeCount: 10,
            episodes: [
              { id: 1, seasonNumber: 1, episodeNumber: 1, name: 'Глава первая: Андзин', durationMinutes: 60 },
              { id: 2, seasonNumber: 1, episodeNumber: 2, name: 'Глава вторая: Слуги двух господ', durationMinutes: 58 },
              { id: 3, seasonNumber: 1, episodeNumber: 3, name: 'Глава третья: Завтрашний день', durationMinutes: 62 },
            ],
          },
        ],
      },
      {
        id: '94605',
        tmdbId: 94605,
        type: 'tv',
        title: 'Аркейн',
        originalTitle: 'Arcane',
        tagline: 'Каждая легенда с чего-то начинается',
        overview:
          'История двух сестер Вай и Джинкс, оказавшихся по разные стороны баррикад в конфликте между Пилтовером и Зауном.',
        posterPath: 'https://image.tmdb.org/t/p/w500/fq2yEdfU7ZpB2qf2f8V2i7T3D5F.jpg',
        backdropPath: 'https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
        releaseYear: 2021,
        releaseDate: '2021-11-06',
        voteAverage: 9.0,
        voteCount: 4200,
        ageRating: '16+',
        genres: [{ id: 16, name: 'Мультфильм' }, { id: 878, name: 'Фантастика' }],
        seasons: [
          {
            id: 1,
            seasonNumber: 1,
            name: 'Сезон 1',
            episodeCount: 9,
            episodes: [
              { id: 1, seasonNumber: 1, episodeNumber: 1, name: 'Добро пожаловать в игру', durationMinutes: 43 },
              { id: 2, seasonNumber: 1, episodeNumber: 2, name: 'Некоторые тайны лучше оставить нераскрытыми', durationMinutes: 44 },
            ],
          },
        ],
      },
    ];

    return { items: list, page, totalPages: 1, totalItems: list.length };
  }

  private findInFallback(id: string, type: MediaType): MediaItem | null {
    const list = type === 'movie' ? this.getFallbackMovies().items : this.getFallbackSeries().items;
    return list.find((m) => m.id === id || String(m.tmdbId) === id) || list[0] || null;
  }
}

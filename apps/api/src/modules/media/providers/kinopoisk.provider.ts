import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Episode, Genre, MediaItem, MediaType, Person, Season } from '@cinemaflow/types';
import { RedisService } from '../../../common/redis/redis.service';
import { DiscoverProviderOptions } from '../media-aggregator.util';

const TMDB_TO_KP_DEV_GENRE: Record<number, string> = {
  28: 'боевик',
  12: 'приключения',
  16: 'мультфильм',
  35: 'комедия',
  80: 'криминал',
  99: 'документальный',
  18: 'драма',
  10751: 'семейный',
  14: 'фэнтези',
  36: 'история',
  27: 'ужасы',
  10402: 'музыка',
  9648: 'детектив',
  10749: 'мелодрама',
  878: 'фантастика',
  53: 'триллер',
  10752: 'военный',
  37: 'вестерн',
  10759: 'боевик',
  10765: 'фантастика',
};

const TMDB_TO_KP_UNOFFICIAL_GENRE_ID: Record<number, number> = {
  53: 1,
  18: 2,
  80: 3,
  10749: 4,
  9648: 5,
  878: 6,
  12: 7,
  37: 10,
  28: 11,
  14: 12,
  35: 13,
  10752: 14,
  36: 15,
  10402: 16,
  27: 17,
  16: 18,
  10751: 19,
  99: 22,
  10759: 11,
  10765: 6,
};

const LANG_TO_KP_DEV_COUNTRY: Record<string, string> = {
  ru: 'Россия',
  en: 'США',
  ja: 'Япония',
  ko: 'Корея Южная',
  fr: 'Франция',
  es: 'Испания',
  tr: 'Турция',
};

const LANG_TO_KP_UNOFFICIAL_COUNTRY_ID: Record<string, number> = {
  en: 1,
  fr: 3,
  es: 8,
  ja: 16,
  ru: 34,
  tr: 44,
  ko: 49,
};

@Injectable()
export class KinopoiskProviderService {
  private readonly logger = new Logger(KinopoiskProviderService.name);
  private readonly kpDevKey: string;
  private readonly kpUnofficialKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.kpDevKey = this.configService.get<string>('KINOPOISK_DEV_API_KEY', '').trim();
    this.kpUnofficialKey = this.configService.get<string>('KINOPOISK_UNOFFICIAL_API_KEY', '').trim();
  }

  get isConfigured(): boolean {
    return Boolean(this.kpDevKey || this.kpUnofficialKey);
  }

  private async fetchJson<T>(
    url: string,
    headers: Record<string, string>,
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
          'User-Agent': '67movies/1.0',
          ...headers,
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.debug(`Kinopoisk request ${res.status} for ${url}`);
        return null;
      }
      const data = (await res.json()) as T;
      if (data) {
        await this.redisService.set(cacheKey, data, ttlSeconds);
      }
      return data;
    } catch (err: any) {
      this.logger.debug(`Kinopoisk request error: ${err?.message || err}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // =========================================================================
  // Public Catalog Methods (automatically picks Kinopoisk.dev -> Unofficial)
  // =========================================================================

  async search(query: string, page = 1): Promise<MediaItem[]> {
    const q = query.trim();
    if (!q || !this.isConfigured) return [];

    if (this.kpDevKey) {
      const url = `https://api.kinopoisk.dev/v1.4/movie/search?page=${page}&limit=16&query=${encodeURIComponent(q)}`;
      const data = await this.fetchJson<any>(
        url,
        { 'X-API-KEY': this.kpDevKey },
        `kpdev:search:${q.toLowerCase()}:${page}`,
        600,
      );
      if (Array.isArray(data?.docs) && data.docs.length > 0) {
        return data.docs.map((doc: any) => this.mapKpDevDoc(doc)).filter(Boolean) as MediaItem[];
      }
    }

    if (this.kpUnofficialKey) {
      const url = `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(q)}&page=${page}`;
      const data = await this.fetchJson<any>(
        url,
        { 'X-API-KEY': this.kpUnofficialKey },
        `kpunof:search:${q.toLowerCase()}:${page}`,
        600,
      );
      if (Array.isArray(data?.films) && data.films.length > 0) {
        return data.films
          .map((film: any) => this.mapKpUnofficialFilm(film))
          .filter(Boolean) as MediaItem[];
      }
    }

    return [];
  }

  async getPopular(type: MediaType, page = 1): Promise<MediaItem[]> {
    if (!this.isConfigured) return [];

    if (this.kpDevKey) {
      const kpType = type === 'tv' ? 'tv-series' : 'movie';
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        type: kpType,
        sortField: 'votes.kp',
        sortType: '-1',
        'rating.kp': '6.5-10',
      });
      params.append('notNullFields', 'name');
      params.append('notNullFields', 'poster.url');

      const data = await this.fetchJson<any>(
        `https://api.kinopoisk.dev/v1.4/movie?${params.toString()}`,
        { 'X-API-KEY': this.kpDevKey },
        `kpdev:pop:${type}:${page}`,
        1800,
      );
      if (Array.isArray(data?.docs) && data.docs.length > 0) {
        return data.docs.map((doc: any) => this.mapKpDevDoc(doc, type)).filter(Boolean) as MediaItem[];
      }
    }

    if (this.kpUnofficialKey) {
      const collection = type === 'tv' ? 'POPULAR_SERIES' : 'TOP_POPULAR_MOVIES';
      const data = await this.fetchJson<any>(
        `https://kinopoiskapiunofficial.tech/api/v2.2/films/collections?type=${collection}&page=${page}`,
        { 'X-API-KEY': this.kpUnofficialKey },
        `kpunof:pop:${type}:${page}`,
        1800,
      );
      if (Array.isArray(data?.items) && data.items.length > 0) {
        return data.items
          .map((film: any) => this.mapKpUnofficialFilm(film, type))
          .filter(Boolean) as MediaItem[];
      }
    }

    return [];
  }

  async getNew(type: MediaType, page = 1): Promise<MediaItem[]> {
    if (!this.isConfigured) return [];
    const currentYear = new Date().getFullYear();

    if (this.kpDevKey) {
      const kpType = type === 'tv' ? 'tv-series' : 'movie';
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        type: kpType,
        year: `${currentYear - 1}-${currentYear}`,
        sortField: 'votes.kp',
        sortType: '-1',
      });
      params.append('notNullFields', 'name');
      params.append('notNullFields', 'poster.url');

      const data = await this.fetchJson<any>(
        `https://api.kinopoisk.dev/v1.4/movie?${params.toString()}`,
        { 'X-API-KEY': this.kpDevKey },
        `kpdev:new:${type}:${page}`,
        1800,
      );
      if (Array.isArray(data?.docs) && data.docs.length > 0) {
        return data.docs.map((doc: any) => this.mapKpDevDoc(doc, type)).filter(Boolean) as MediaItem[];
      }
    }

    if (this.kpUnofficialKey) {
      const kpType = type === 'tv' ? 'TV_SERIES' : 'FILM';
      const params = new URLSearchParams({
        type: kpType,
        order: 'YEAR',
        yearFrom: String(currentYear - 1),
        yearTo: String(currentYear),
        ratingFrom: '6',
        page: String(page),
      });
      const data = await this.fetchJson<any>(
        `https://kinopoiskapiunofficial.tech/api/v2.2/films?${params.toString()}`,
        { 'X-API-KEY': this.kpUnofficialKey },
        `kpunof:new:${type}:${page}`,
        1800,
      );
      if (Array.isArray(data?.items) && data.items.length > 0) {
        return data.items
          .map((film: any) => this.mapKpUnofficialFilm(film, type))
          .filter(Boolean) as MediaItem[];
      }
    }

    return [];
  }

  async discover(options: DiscoverProviderOptions): Promise<MediaItem[]> {
    if (!this.isConfigured) return [];

    const category = options.category || options.type;
    const isTv = category === 'tv' || category === 'anime' || category === 'dorama';
    const resolvedType: MediaType = isTv ? 'tv' : 'movie';

    if (this.kpDevKey) {
      const params = new URLSearchParams({
        page: String(options.page),
        limit: '14',
      });
      params.append('notNullFields', 'name');
      params.append('notNullFields', 'poster.url');

      if (category === 'anime') {
        params.append('type', 'anime');
      } else if (category === 'cartoons') {
        params.append('type', 'cartoon');
      } else if (isTv) {
        params.append('type', 'tv-series');
      } else {
        params.append('type', 'movie');
      }

      if (category === 'documentary') {
        params.append('genres.name', 'документальный');
      }
      if (options.genreId && TMDB_TO_KP_DEV_GENRE[options.genreId]) {
        params.append('genres.name', TMDB_TO_KP_DEV_GENRE[options.genreId]);
      }

      if (category === 'dorama') {
        params.append('countries.name', 'Корея Южная');
      } else if (options.originalLanguage && LANG_TO_KP_DEV_COUNTRY[options.originalLanguage]) {
        params.append('countries.name', LANG_TO_KP_DEV_COUNTRY[options.originalLanguage]);
      }

      if (options.yearFrom || options.yearTo) {
        const yFrom = options.yearFrom || 1920;
        const yTo = options.yearTo || new Date().getFullYear();
        params.set('year', `${yFrom}-${yTo}`);
      }

      if (options.minRating && options.minRating > 0) {
        params.set('rating.kp', `${options.minRating}-10`);
      }

      if (options.sort === 'rating') {
        params.set('sortField', 'rating.kp');
        params.set('sortType', '-1');
        params.set('votes.kp', '10000-10000000');
      } else if (options.sort === 'date') {
        params.set('sortField', 'year');
        params.set('sortType', '-1');
      } else {
        params.set('sortField', 'votes.kp');
        params.set('sortType', '-1');
      }

      const data = await this.fetchJson<any>(
        `https://api.kinopoisk.dev/v1.4/movie?${params.toString()}`,
        { 'X-API-KEY': this.kpDevKey },
        `kpdev:discover:${params.toString()}`,
        1200,
      );
      if (Array.isArray(data?.docs) && data.docs.length > 0) {
        return data.docs
          .map((doc: any) => this.mapKpDevDoc(doc, resolvedType))
          .filter(Boolean) as MediaItem[];
      }
    }

    if (this.kpUnofficialKey) {
      const params = new URLSearchParams({
        page: String(options.page),
        type: isTv ? 'TV_SERIES' : 'FILM',
        order:
          options.sort === 'rating'
            ? 'RATING'
            : options.sort === 'date'
            ? 'YEAR'
            : 'NUM_VOTE',
      });

      if (category === 'anime') {
        params.set('genres', '24');
      } else if (category === 'cartoons') {
        params.set('genres', '18');
      } else if (category === 'documentary') {
        params.set('genres', '22');
      } else if (options.genreId && TMDB_TO_KP_UNOFFICIAL_GENRE_ID[options.genreId]) {
        params.set('genres', String(TMDB_TO_KP_UNOFFICIAL_GENRE_ID[options.genreId]));
      }

      if (category === 'dorama') {
        params.set('countries', '49');
      } else if (options.originalLanguage && LANG_TO_KP_UNOFFICIAL_COUNTRY_ID[options.originalLanguage]) {
        params.set('countries', String(LANG_TO_KP_UNOFFICIAL_COUNTRY_ID[options.originalLanguage]));
      }

      if (options.yearFrom) params.set('yearFrom', String(options.yearFrom));
      if (options.yearTo) params.set('yearTo', String(options.yearTo));
      if (options.minRating) params.set('ratingFrom', String(options.minRating));

      const data = await this.fetchJson<any>(
        `https://kinopoiskapiunofficial.tech/api/v2.2/films?${params.toString()}`,
        { 'X-API-KEY': this.kpUnofficialKey },
        `kpunof:discover:${params.toString()}`,
        1200,
      );
      if (Array.isArray(data?.items) && data.items.length > 0) {
        return data.items
          .map((film: any) => this.mapKpUnofficialFilm(film, resolvedType))
          .filter(Boolean) as MediaItem[];
      }
    }

    return [];
  }

  async getDetails(kpId: number): Promise<MediaItem | null> {
    if (!kpId || !this.isConfigured) return null;

    if (this.kpDevKey) {
      const doc = await this.fetchJson<any>(
        `https://api.kinopoisk.dev/v1.4/movie/${kpId}`,
        { 'X-API-KEY': this.kpDevKey },
        `kpdev:detail:${kpId}`,
        7200,
      );
      if (doc && doc.id) {
        return this.mapKpDevDetails(doc);
      }
    }

    if (this.kpUnofficialKey) {
      const [film, staff, seasonsData] = await Promise.all([
        this.fetchJson<any>(
          `https://kinopoiskapiunofficial.tech/api/v2.2/films/${kpId}`,
          { 'X-API-KEY': this.kpUnofficialKey },
          `kpunof:detail:${kpId}`,
          7200,
        ),
        this.fetchJson<any[]>(
          `https://kinopoiskapiunofficial.tech/api/v1/staff?filmId=${kpId}`,
          { 'X-API-KEY': this.kpUnofficialKey },
          `kpunof:staff:${kpId}`,
          7200,
        ),
        this.fetchJson<any>(
          `https://kinopoiskapiunofficial.tech/api/v2.2/films/${kpId}/seasons`,
          { 'X-API-KEY': this.kpUnofficialKey },
          `kpunof:seasons:${kpId}`,
          7200,
        ),
      ]);

      if (film && (film.kinopoiskId || film.filmId)) {
        return this.mapKpUnofficialDetails(film, staff || [], seasonsData);
      }
    }

    return null;
  }

  async getTvSeason(kpId: number, seasonNumber: number): Promise<Season | null> {
    if (!kpId || !this.isConfigured) return null;

    if (this.kpDevKey) {
      const data = await this.fetchJson<any>(
        `https://api.kinopoisk.dev/v1.4/season?movieId=${kpId}&number=${seasonNumber}&limit=1`,
        { 'X-API-KEY': this.kpDevKey },
        `kpdev:season:${kpId}:${seasonNumber}`,
        7200,
      );
      const seasonDoc = data?.docs?.[0];
      if (seasonDoc) {
        const episodes: Episode[] = Array.isArray(seasonDoc.episodes)
          ? seasonDoc.episodes.map((ep: any, idx: number) => ({
              id: `kp-${kpId}-s${seasonNumber}e${ep.number || idx + 1}`,
              seasonNumber,
              episodeNumber: ep.number || idx + 1,
              name: ep.name || ep.enName || `Серия ${ep.number || idx + 1}`,
              overview: ep.description || undefined,
              stillPath: ep.still?.url || ep.still?.previewUrl || null,
              airDate: ep.airDate || undefined,
              durationMinutes: ep.duration || 45,
            }))
          : [];
        return {
          id: `kp-${kpId}-s${seasonNumber}`,
          seasonNumber,
          name: seasonDoc.name || `Сезон ${seasonNumber}`,
          overview: seasonDoc.description || undefined,
          posterPath: seasonDoc.poster?.url || null,
          airDate: seasonDoc.airDate || undefined,
          episodeCount: seasonDoc.episodesCount || episodes.length,
          episodes,
        };
      }
    }

    if (this.kpUnofficialKey) {
      const data = await this.fetchJson<any>(
        `https://kinopoiskapiunofficial.tech/api/v2.2/films/${kpId}/seasons`,
        { 'X-API-KEY': this.kpUnofficialKey },
        `kpunof:seasons:${kpId}`,
        7200,
      );
      const season = Array.isArray(data?.items)
        ? data.items.find((s: any) => Number(s.number) === seasonNumber)
        : null;
      if (season) {
        const episodes: Episode[] = Array.isArray(season.episodes)
          ? season.episodes.map((ep: any, idx: number) => ({
              id: `kp-${kpId}-s${seasonNumber}e${ep.episodeNumber || idx + 1}`,
              seasonNumber,
              episodeNumber: ep.episodeNumber || idx + 1,
              name: ep.nameRu || ep.nameEn || `Серия ${ep.episodeNumber || idx + 1}`,
              overview: ep.synopsis || undefined,
              airDate: ep.releaseDate || undefined,
              durationMinutes: 45,
            }))
          : [];
        return {
          id: `kp-${kpId}-s${seasonNumber}`,
          seasonNumber,
          name: `Сезон ${seasonNumber}`,
          episodeCount: episodes.length,
          episodes,
        };
      }
    }

    return null;
  }

  // =========================================================================
  // Mappers
  // =========================================================================

  private resolveTypeFromKp(rawType?: string, fallback?: MediaType): MediaType {
    const t = String(rawType || '').toLowerCase();
    if (t.includes('series') || t === 'animated-series' || t === 'tv_show' || t === 'mini_series') {
      return 'tv';
    }
    if (t === 'movie' || t === 'film' || t === 'cartoon') {
      return 'movie';
    }
    return fallback || 'movie';
  }

  private mapGenresFromNames(rawGenres: any): Genre[] {
    if (!Array.isArray(rawGenres)) return [];
    return rawGenres
      .map((g: any, idx: number) => {
        const name = typeof g === 'string' ? g : g?.name || g?.genre;
        if (!name) return null;
        const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
        return { id: 9000 + idx, name: capitalized };
      })
      .filter(Boolean) as Genre[];
  }

  private mapKpDevDoc(doc: any, fallbackType?: MediaType): MediaItem | null {
    const kpId = Number(doc?.id);
    const title = doc?.name || doc?.alternativeName || doc?.enName;
    if (!kpId || !title) return null;

    const type = this.resolveTypeFromKp(doc?.type || (doc?.isSeries ? 'tv-series' : 'movie'), fallbackType);
    const ratingRaw = Number(doc?.rating?.kp || doc?.rating?.imdb || 0);
    const votesRaw = Number(doc?.votes?.kp || doc?.votes?.imdb || 0);
    const tmdbId = doc?.externalId?.tmdb ? Number(doc.externalId.tmdb) : undefined;
    const imdbId = doc?.externalId?.imdb ? String(doc.externalId.imdb) : undefined;
    const posterPath = doc?.poster?.previewUrl || doc?.poster?.url || null;
    const backdropPath = doc?.backdrop?.url || doc?.backdrop?.previewUrl || posterPath;
    const year = Number(doc?.year) || 2024;

    return {
      id: `kp-${kpId}`,
      tmdbId: tmdbId && !isNaN(tmdbId) ? tmdbId : undefined,
      imdbId,
      kinopoiskId: kpId,
      source: 'kinopoisk',
      type,
      title: String(title),
      originalTitle: doc?.alternativeName || doc?.enName || undefined,
      tagline: doc?.slogan || undefined,
      overview: doc?.description || doc?.shortDescription || 'Описание фильма временно отсутствует.',
      posterPath,
      backdropPath,
      releaseYear: year,
      releaseDate: `${year}-01-01`,
      voteAverage: Number(ratingRaw.toFixed(1)),
      voteCount: votesRaw || undefined,
      durationMinutes: Number(doc?.movieLength || doc?.seriesLength) || undefined,
      ageRating: doc?.ageRating ? `${doc.ageRating}+` : '16+',
      genres: this.mapGenresFromNames(doc?.genres),
    };
  }

  private mapKpDevDetails(doc: any): MediaItem | null {
    const base = this.mapKpDevDoc(doc);
    if (!base) return null;

    const cast: Person[] = Array.isArray(doc?.persons)
      ? doc.persons
          .filter((p: any) => p?.name || p?.enName)
          .slice(0, 14)
          .map((p: any, idx: number) => ({
            id: Number(p.id) || 50000 + idx,
            name: p.name || p.enName,
            character: p.description || p.profession || undefined,
            profilePath: p.photo || null,
          }))
      : [];

    const recommendations: MediaItem[] = Array.isArray(doc?.similarMovies)
      ? doc.similarMovies
          .slice(0, 8)
          .map((s: any) => this.mapKpDevDoc(s, base.type))
          .filter(Boolean) as MediaItem[]
      : [];

    const seasons: Season[] | undefined =
      base.type === 'tv' && Array.isArray(doc?.seasonsInfo)
        ? doc.seasonsInfo
            .filter((s: any) => Number(s.number) > 0)
            .map((s: any) => ({
              id: `kp-${base.kinopoiskId}-s${s.number}`,
              seasonNumber: Number(s.number),
              name: `Сезон ${s.number}`,
              episodeCount: Number(s.episodesCount) || 0,
            }))
        : undefined;

    return {
      ...base,
      cast,
      recommendations,
      seasons,
    };
  }

  private mapKpUnofficialFilm(film: any, fallbackType?: MediaType): MediaItem | null {
    const kpId = Number(film?.kinopoiskId || film?.filmId);
    const title = film?.nameRu || film?.nameEn || film?.nameOriginal;
    if (!kpId || !title) return null;

    const type = this.resolveTypeFromKp(film?.type, fallbackType);
    const rawRating = parseFloat(String(film?.ratingKinopoisk ?? film?.rating ?? film?.ratingImdb ?? 0));
    const voteAverage = isNaN(rawRating) ? 0 : Number(rawRating.toFixed(1));
    const year = parseInt(String(film?.year || '2024'), 10) || 2024;
    const posterPath = film?.posterUrlPreview || film?.posterUrl || null;
    const backdropPath = film?.coverUrl || film?.posterUrl || posterPath;

    return {
      id: `kp-${kpId}`,
      imdbId: film?.imdbId || undefined,
      kinopoiskId: kpId,
      source: 'kinopoisk',
      type,
      title: String(title),
      originalTitle: film?.nameOriginal || film?.nameEn || undefined,
      tagline: film?.slogan || undefined,
      overview: film?.description || film?.shortDescription || 'Описание фильма временно отсутствует.',
      posterPath,
      backdropPath,
      releaseYear: year,
      releaseDate: `${year}-01-01`,
      voteAverage,
      voteCount: Number(film?.ratingKinopoiskVoteCount || film?.ratingVoteCount) || undefined,
      durationMinutes: Number(film?.filmLength) || undefined,
      ageRating: this.parseAgeLimit(film?.ratingAgeLimits),
      genres: this.mapGenresFromNames(film?.genres),
    };
  }

  private mapKpUnofficialDetails(film: any, staff: any[], seasonsData: any): MediaItem | null {
    const base = this.mapKpUnofficialFilm(film);
    if (!base) return null;

    const cast: Person[] = Array.isArray(staff)
      ? staff
          .filter((p) => p?.nameRu || p?.nameEn)
          .slice(0, 14)
          .map((p, idx) => ({
            id: Number(p.staffId) || 60000 + idx,
            name: p.nameRu || p.nameEn,
            character: p.description || p.professionText || undefined,
            profilePath: p.posterUrl || null,
          }))
      : [];

    const seasons: Season[] | undefined =
      base.type === 'tv' && Array.isArray(seasonsData?.items)
        ? seasonsData.items
            .filter((s: any) => Number(s.number) > 0)
            .map((s: any) => ({
              id: `kp-${base.kinopoiskId}-s${s.number}`,
              seasonNumber: Number(s.number),
              name: `Сезон ${s.number}`,
              episodeCount: Array.isArray(s.episodes) ? s.episodes.length : 0,
              episodes: Array.isArray(s.episodes)
                ? s.episodes.map((ep: any, idx: number) => ({
                    id: `kp-${base.kinopoiskId}-s${s.number}e${ep.episodeNumber || idx + 1}`,
                    seasonNumber: Number(s.number),
                    episodeNumber: ep.episodeNumber || idx + 1,
                    name: ep.nameRu || ep.nameEn || `Серия ${ep.episodeNumber || idx + 1}`,
                    overview: ep.synopsis || undefined,
                    airDate: ep.releaseDate || undefined,
                    durationMinutes: 45,
                  }))
                : undefined,
            }))
        : undefined;

    return {
      ...base,
      cast,
      seasons,
    };
  }

  private parseAgeLimit(raw?: string | null): string {
    if (!raw) return '16+';
    const match = String(raw).match(/(\d+)/);
    return match ? `${match[1]}+` : '16+';
  }
}

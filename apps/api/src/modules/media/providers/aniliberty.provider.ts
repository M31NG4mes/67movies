import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Episode,
  Genre,
  MediaItem,
  MediaType,
  PaginatedResult,
  Season,
  StreamSourceGroup,
  VideoStream,
  VideoQuality,
  VoiceoverMember,
} from '@cinemaflow/types';
import { RedisService } from '../../../common/redis/redis.service';
import { stripHtml } from '../media-aggregator.util';

export interface AniLibertyCatalogOptions {
  page: number;
  limit?: number;
  search?: string;
  genreId?: number;
  sort?: 'popularity' | 'rating' | 'date' | 'votes';
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  types?: string[];
}

const DEFAULT_BASE = 'https://api.anilibria.app';

/**
 * AniLiberty API v1 (https://api.anilibria.app/api/docs/v1/)
 * Public REST API, no API key required.
 */
@Injectable()
export class AniLibertyProviderService {
  private readonly logger = new Logger(AniLibertyProviderService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.baseUrl = this.configService
      .get<string>('ANILIBERTY_BASE_URL', DEFAULT_BASE)
      .replace(/\/+$/, '');
  }

  // ---------------------------------------------------------------------------
  // HTTP
  // ---------------------------------------------------------------------------

  private async fetchJson<T>(
    path: string,
    params: URLSearchParams | null,
    cacheKey: string,
    ttlSeconds: number,
    timeoutMs = 7000,
  ): Promise<T | null> {
    const cached = await this.redisService.get<T>(cacheKey);
    if (cached) return cached;

    const qs = params && Array.from(params.keys()).length > 0 ? `?${params.toString()}` : '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/v1${path}${qs}`, {
        headers: { Accept: 'application/json', 'User-Agent': '67movies/1.0' },
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.debug(`AniLiberty ${res.status} for ${path}`);
        return null;
      }
      const data = (await res.json()) as T;
      if (data) await this.redisService.set(cacheKey, data, ttlSeconds);
      return data;
    } catch (err: any) {
      this.logger.debug(`AniLiberty request failed [${path}]: ${err?.message || err}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private absUrl(path?: string | null): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  // ---------------------------------------------------------------------------
  // Catalog
  // ---------------------------------------------------------------------------

  /** Returns null when AniLiberty is unreachable (so callers can fall back). */
  async getCatalog(opts: AniLibertyCatalogOptions): Promise<PaginatedResult<MediaItem> | null> {
    const limit = opts.limit || 36;
    const sorting =
      opts.sort === 'rating' || opts.sort === 'votes'
        ? 'RATING_DESC'
        : opts.sort === 'date'
        ? 'YEAR_DESC'
        : 'FRESH_AT_DESC';

    const params = new URLSearchParams();
    params.set('page', String(opts.page));
    params.set('limit', String(limit));
    params.set('f[sorting]', sorting);
    if (opts.search?.trim()) params.set('f[search]', opts.search.trim());
    if (opts.genreId && opts.genreId > 0) params.set('f[genres]', String(opts.genreId));
    if (opts.yearFrom) params.set('f[years][from_year]', String(Math.max(1990, opts.yearFrom)));
    if (opts.yearTo) params.set('f[years][to_year]', String(opts.yearTo));
    if (opts.types && opts.types.length > 0) params.set('f[types]', opts.types.join(','));
    params.set(
      'include',
      [
        'id',
        'type',
        'year',
        'name',
        'alias',
        'season',
        'shikimori',
        'mal',
        'rating',
        'poster',
        'is_ongoing',
        'age_rating',
        'description',
        'episodes_total',
        'average_duration_of_episode',
        'genres.id',
        'genres.name',
        'fresh_at',
      ].join(','),
    );

    const key = `al:catalog:${params.toString()}`;
    const data = await this.fetchJson<any>('/anime/catalog/releases', params, key, 600);
    if (!data || !Array.isArray(data.data)) return null;

    let items = data.data.map((r: any) => this.mapRelease(r)).filter(Boolean) as MediaItem[];
    if (opts.minRating && opts.minRating > 0) {
      items = items.filter((i) => i.voteAverage >= (opts.minRating as number));
    }

    const pg = data.meta?.pagination;
    return {
      items,
      page: Number(pg?.current_page) || opts.page,
      totalPages: Number(pg?.total_pages) || 1,
      totalItems: Number(pg?.total) || items.length,
    };
  }

  async getGenres(): Promise<Genre[]> {
    const data = await this.fetchJson<any[]>(
      '/anime/catalog/references/genres',
      null,
      'al:genres',
      86400,
    );
    if (!Array.isArray(data)) return [];
    return data
      .filter((g) => g?.id && g?.name)
      .map((g) => ({ id: Number(g.id), name: String(g.name) }));
  }

  // ---------------------------------------------------------------------------
  // Release details / episodes / streams
  // ---------------------------------------------------------------------------

  private async getRelease(releaseId: number): Promise<any | null> {
    const data = await this.fetchJson<any>(
      `/anime/releases/${releaseId}`,
      null,
      `al:release:${releaseId}`,
      900,
      10000,
    );
    return data?.data && data.data.id ? data.data : data && data.id ? data : null;
  }

  async getDetails(releaseId: number): Promise<MediaItem | null> {
    if (!releaseId) return null;
    const r = await this.getRelease(releaseId);
    if (!r) return null;
    const base = this.mapRelease(r);
    if (!base) return null;

    const voiceovers = this.mapMembers(r.members);
    const episodes = this.mapEpisodes(r);
    const seasons: Season[] | undefined =
      episodes.length > 0
        ? [
            {
              id: `al-${releaseId}-s1`,
              seasonNumber: 1,
              name: 'Эпизоды',
              posterPath: base.posterPath,
              episodeCount: episodes.length,
              episodes,
            },
          ]
        : undefined;

    const backdrop =
      Array.isArray(r.background_covers) && r.background_covers[0]
        ? this.absUrl(r.background_covers[0]?.src || r.background_covers[0]?.preview)
        : null;

    return {
      ...base,
      backdropPath: backdrop || base.backdropPath,
      voiceovers,
      voiceTeamName: 'AniLibria',
      seasons: base.type === 'tv' ? seasons : undefined,
    };
  }

  async getSeason(releaseId: number, seasonNumber: number): Promise<Season | null> {
    if (!releaseId || seasonNumber !== 1) return null;
    const r = await this.getRelease(releaseId);
    if (!r) return null;
    const episodes = this.mapEpisodes(r);
    if (episodes.length === 0) return null;
    return {
      id: `al-${releaseId}-s1`,
      seasonNumber: 1,
      name: 'Эпизоды',
      posterPath: this.absUrl(r.poster?.src),
      episodeCount: episodes.length,
      episodes,
    };
  }

  /** HLS stream groups (one group, one stream per available quality) for an episode. */
  async getStreams(releaseId: number, episodeNumber = 1): Promise<StreamSourceGroup[]> {
    if (!releaseId) return [];
    const r = await this.getRelease(releaseId);
    if (!r || !Array.isArray(r.episodes)) return [];

    const ep =
      r.episodes.find((e: any) => Number(e?.ordinal) === Number(episodeNumber)) ||
      (r.episodes.length === 1 ? r.episodes[0] : null);
    if (!ep) return [];

    const levels: Array<[string, VideoQuality]> = [
      ['hls_1080', '1080p'],
      ['hls_720', '720p'],
      ['hls_480', '480p'],
    ];

    const team = this.mapMembers(r.members)
      .filter((m) => /озвуч|voic/i.test(m.role))
      .map((m) => m.name);
    const voiceActing = team.length > 0 ? `AniLibria: ${team.slice(0, 3).join(', ')}` : 'AniLibria';
    const title = ep.name || `Серия ${ep.ordinal}`;

    const streams: VideoStream[] = levels
      .filter(([field]) => typeof ep[field] === 'string' && ep[field])
      .map(([field, quality]) => ({
        id: `al-${releaseId}-e${ep.ordinal}-${quality}`,
        providerId: 'aniliberty',
        providerName: 'AniLiberty',
        title,
        voiceActing,
        season: 1,
        episode: Number(ep.ordinal),
        quality,
        format: 'hls',
        streamUrl: String(ep[field]),
        audioTracks: [{ id: '0', language: 'ru', label: 'Русский (AniLibria)', isDefault: true }],
      }));

    if (streams.length === 0) return [];
    return [{ providerId: 'aniliberty', providerName: 'AniLiberty', voiceActing, streams }];
  }

  // ---------------------------------------------------------------------------
  // Mappers
  // ---------------------------------------------------------------------------

  private mapMembers(members: any): VoiceoverMember[] {
    if (!Array.isArray(members)) return [];
    return members
      .filter((m) => m?.nickname)
      .map((m) => ({
        name: String(m.nickname),
        role: String(m.role?.description || m.role?.value || 'Участник'),
      }));
  }

  private mapEpisodes(r: any): Episode[] {
    if (!Array.isArray(r?.episodes)) return [];
    return r.episodes
      .map((e: any, idx: number): Episode => {
        const ordinal = Number(e?.ordinal) || idx + 1;
        return {
          id: String(e?.id || `al-${r.id}-e${ordinal}`),
          seasonNumber: 1,
          episodeNumber: ordinal,
          name: e?.name || `Серия ${ordinal}`,
          stillPath: this.absUrl(e?.preview?.src || e?.preview?.preview),
          durationMinutes: e?.duration ? Math.max(1, Math.round(Number(e.duration) / 60)) : undefined,
          airDate: e?.updated_at ? String(e.updated_at).slice(0, 10) : undefined,
        };
      })
      .sort((a: Episode, b: Episode) => a.episodeNumber - b.episodeNumber);
  }

  private mapRelease(r: any): MediaItem | null {
    const id = Number(r?.id);
    const title = r?.name?.main || r?.name?.english;
    if (!id || !title) return null;

    const poster = this.absUrl(r?.poster?.src || r?.poster?.preview);
    const typeValue = String(r?.type?.value || 'TV').toUpperCase();
    const type: MediaType = typeValue === 'MOVIE' ? 'movie' : 'tv';
    const year = Number(r?.year) || new Date().getFullYear();

    const ratingCandidates = [r?.mal?.rating, r?.shikimori?.rating, r?.rating?.average];
    const rating = ratingCandidates.map((v) => Number(v)).find((v) => v > 0) || 0;
    const votes = Number(r?.mal?.votes || r?.shikimori?.votes || r?.rating?.votes) || undefined;

    const age = String(r?.age_rating?.label || '16+');
    const genres: Genre[] = Array.isArray(r?.genres)
      ? r.genres.filter((g: any) => g?.id).map((g: any) => ({ id: Number(g.id), name: String(g.name) }))
      : [];

    return {
      id: `al-${id}`,
      anilibertyId: id,
      malId: Number(r?.mal?.id) || undefined,
      source: 'aniliberty',
      type,
      title: String(title),
      originalTitle: r?.name?.english || undefined,
      overview: stripHtml(r?.description) || 'Описание аниме временно отсутствует.',
      posterPath: poster,
      backdropPath: poster,
      releaseDate: `${year}-01-01`,
      releaseYear: year,
      voteAverage: Number(rating.toFixed(1)),
      voteCount: votes,
      durationMinutes: Number(r?.average_duration_of_episode) || (type === 'movie' ? 100 : 24),
      ageRating: age,
      genres,
      isOngoing: Boolean(r?.is_ongoing),
      episodesTotal: Number(r?.episodes_total) || undefined,
    };
  }
}

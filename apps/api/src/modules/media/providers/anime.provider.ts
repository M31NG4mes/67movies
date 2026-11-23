import { Injectable, Logger } from '@nestjs/common';
import { Episode, Genre, MediaItem, MediaType, Season } from '@cinemaflow/types';
import { RedisService } from '../../../common/redis/redis.service';
import { DiscoverProviderOptions, stripHtml } from '../media-aggregator.util';

const SHIKIMORI_BASE = 'https://shikimori.one';

const TMDB_TO_JIKAN_GENRE_ID: Record<number, number> = {
  28: 1, // Action
  12: 2, // Adventure
  35: 4, // Comedy
  18: 8, // Drama
  14: 10, // Fantasy
  27: 14, // Horror
  9648: 7, // Mystery
  10749: 22, // Romance
  878: 24, // Sci-Fi
  53: 41, // Suspense
  36: 13, // Historical
  10402: 19, // Music
  10759: 1,
  10765: 24,
};

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

  // =========================================================================
  // Public Catalog Methods (Shikimori RU + Jikan/MyAnimeList — 100% free)
  // =========================================================================

  async search(query: string, page = 1): Promise<MediaItem[]> {
    const q = query.trim();
    if (!q) return [];

    const [shikiRaw, jikanRaw] = await Promise.all([
      this.fetchJson<any[]>(
        `${SHIKIMORI_BASE}/api/animes?search=${encodeURIComponent(q)}&limit=10&page=${page}&censored=true`,
        `shiki:search:${q.toLowerCase()}:${page}`,
        600,
      ),
      this.fetchJson<any>(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=10&page=${page}&sfw=true`,
        `jikan:search:${q.toLowerCase()}:${page}`,
        600,
      ),
    ]);

    return this.combineShikiAndJikan(shikiRaw || [], jikanRaw?.data || []);
  }

  async getPopular(type: MediaType, page = 1): Promise<MediaItem[]> {
    const shikiKind = type === 'movie' ? 'movie' : 'tv';
    const jikanType = type === 'movie' ? 'movie' : 'tv';

    const [shikiRaw, jikanRaw] = await Promise.all([
      this.fetchJson<any[]>(
        `${SHIKIMORI_BASE}/api/animes?order=popularity&kind=${shikiKind}&limit=12&page=${page}&censored=true`,
        `shiki:pop:${type}:${page}`,
        1800,
      ),
      this.fetchJson<any>(
        `https://api.jikan.moe/v4/top/anime?type=${jikanType}&filter=bypopularity&limit=12&page=${page}&sfw=true`,
        `jikan:pop:${type}:${page}`,
        1800,
      ),
    ]);

    return this.combineShikiAndJikan(shikiRaw || [], jikanRaw?.data || []);
  }

  async getNew(type: MediaType, page = 1): Promise<MediaItem[]> {
    const shikiKind = type === 'movie' ? 'movie' : 'tv';

    const [shikiRaw, jikanRaw] = await Promise.all([
      this.fetchJson<any[]>(
        `${SHIKIMORI_BASE}/api/animes?order=aired_on&status=ongoing,released&kind=${shikiKind}&score=6&limit=10&page=${page}&censored=true`,
        `shiki:new:${type}:${page}`,
        1800,
      ),
      type === 'tv'
        ? this.fetchJson<any>(
            `https://api.jikan.moe/v4/seasons/now?limit=10&page=${page}&sfw=true`,
            `jikan:new:tv:${page}`,
            1800,
          )
        : Promise.resolve(null),
    ]);

    return this.combineShikiAndJikan(shikiRaw || [], jikanRaw?.data || []);
  }

  async discover(options: DiscoverProviderOptions): Promise<MediaItem[]> {
    const isMovie = options.category === 'cartoons' || options.type === 'movie';
    const shikiOrder =
      options.sort === 'rating'
        ? 'ranked'
        : options.sort === 'date'
        ? 'aired_on'
        : 'popularity';

    const shikiParams = new URLSearchParams({
      order: shikiOrder,
      kind: isMovie ? 'movie' : 'tv',
      limit: '14',
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

    const jikanParams = new URLSearchParams({
      type: isMovie ? 'movie' : 'tv',
      limit: '14',
      page: String(options.page),
      sfw: 'true',
      order_by:
        options.sort === 'rating'
          ? 'score'
          : options.sort === 'date'
          ? 'start_date'
          : options.sort === 'votes'
          ? 'scored_by'
          : 'members',
      sort: 'desc',
    });
    if (options.minRating && options.minRating > 0) {
      jikanParams.set('min_score', String(options.minRating));
    }
    if (options.yearFrom) {
      jikanParams.set('start_date', `${options.yearFrom}-01-01`);
    }
    if (options.yearTo) {
      jikanParams.set('end_date', `${options.yearTo}-12-31`);
    }
    if (options.genreId && TMDB_TO_JIKAN_GENRE_ID[options.genreId]) {
      jikanParams.set('genres', String(TMDB_TO_JIKAN_GENRE_ID[options.genreId]));
    }

    const [shikiRaw, jikanRaw] = await Promise.all([
      this.fetchJson<any[]>(
        `${SHIKIMORI_BASE}/api/animes?${shikiParams.toString()}`,
        `shiki:disc:${shikiParams.toString()}`,
        1200,
      ),
      this.fetchJson<any>(
        `https://api.jikan.moe/v4/anime?${jikanParams.toString()}`,
        `jikan:disc:${jikanParams.toString()}`,
        1200,
      ),
    ]);

    return this.combineShikiAndJikan(shikiRaw || [], jikanRaw?.data || []);
  }

  async getDetails(malId: number): Promise<MediaItem | null> {
    if (!malId) return null;

    const [shiki, jikan, episodesRes] = await Promise.all([
      this.fetchJson<any>(`${SHIKIMORI_BASE}/api/animes/${malId}`, `shiki:detail:${malId}`, 7200),
      this.fetchJson<any>(`https://api.jikan.moe/v4/anime/${malId}/full`, `jikan:detail:${malId}`, 7200),
      this.fetchJson<any>(`https://api.jikan.moe/v4/anime/${malId}/episodes?page=1`, `jikan:ep:${malId}:1`, 7200),
    ]);

    const jData = jikan?.data;
    if (!shiki && !jData) return null;

    const kind = String(shiki?.kind || jData?.type || 'tv').toLowerCase();
    const type: MediaType = kind === 'movie' ? 'movie' : 'tv';
    const title = shiki?.russian || shiki?.name || jData?.title || `Anime #${malId}`;
    const originalTitle = shiki?.name || jData?.title_japanese || jData?.title || undefined;

    const shikiDesc = stripHtml(shiki?.description_html || shiki?.description || '').replace(
      /\[[^\]]+\]/g,
      '',
    );
    const overview =
      shikiDesc ||
      stripHtml(jData?.synopsis) ||
      'Описание аниме временно отсутствует.';

    const posterPath = this.resolveShikiImage(shiki?.image?.original) ||
      jData?.images?.jpg?.large_image_url ||
      jData?.images?.jpg?.image_url ||
      null;

    const backdropPath =
      (Array.isArray(shiki?.screenshots) && shiki.screenshots[0]?.original
        ? this.resolveShikiImage(shiki.screenshots[0].original)
        : null) ||
      jData?.trailer?.images?.maximum_image_url ||
      posterPath;

    const airedStr = shiki?.aired_on || jData?.aired?.from || '';
    const year = airedStr ? new Date(airedStr).getFullYear() : 2024;
    const score = parseFloat(String(shiki?.score || jData?.score || 0)) || 0;

    const genres: Genre[] = Array.isArray(shiki?.genres) && shiki.genres.length > 0
      ? shiki.genres.map((g: any, idx: number) => ({
          id: Number(g.id) || 8000 + idx,
          name: g.russian || g.name,
        }))
      : Array.isArray(jData?.genres)
      ? jData.genres.map((g: any, idx: number) => ({
          id: Number(g.mal_id) || 8000 + idx,
          name: g.name,
        }))
      : [{ id: 16, name: 'Аниме' }];

    const episodeCount = Number(shiki?.episodes || jData?.episodes || 0);
    const episodes: Episode[] = Array.isArray(episodesRes?.data)
      ? episodesRes.data.map((ep: any, idx: number) => ({
          id: `mal-${malId}-e${ep.mal_id || idx + 1}`,
          seasonNumber: 1,
          episodeNumber: Number(ep.mal_id) || idx + 1,
          name: ep.title || `Серия ${ep.mal_id || idx + 1}`,
          airDate: ep.aired ? String(ep.aired).slice(0, 10) : undefined,
          voteAverage: ep.score ? Number(ep.score) : undefined,
          durationMinutes: Number(shiki?.duration) || 24,
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
      source: shiki ? 'shikimori' : 'jikan',
      type,
      title,
      originalTitle,
      overview,
      posterPath,
      backdropPath,
      releaseDate: airedStr ? String(airedStr).slice(0, 10) : undefined,
      releaseYear: isNaN(year) ? 2024 : year,
      voteAverage: Number(score.toFixed(1)),
      voteCount: Number(jData?.scored_by) || undefined,
      durationMinutes: Number(shiki?.duration) || (type === 'movie' ? 105 : 24),
      ageRating: this.mapAnimeAgeRating(shiki?.rating || jData?.rating),
      genres,
      seasons,
    };
  }

  async getSeason(malId: number, seasonNumber: number): Promise<Season | null> {
    if (!malId || seasonNumber !== 1) return null;
    const episodesRes = await this.fetchJson<any>(
      `https://api.jikan.moe/v4/anime/${malId}/episodes?page=1`,
      `jikan:ep:${malId}:1`,
      7200,
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
  // Internal Mappers & Combiners
  // =========================================================================

  private combineShikiAndJikan(shikiList: any[], jikanList: any[]): MediaItem[] {
    const byMalId = new Map<number, MediaItem>();

    for (const s of shikiList) {
      const item = this.mapShikiItem(s);
      if (item && item.malId) {
        byMalId.set(item.malId, item);
      }
    }

    for (const j of jikanList) {
      const item = this.mapJikanItem(j);
      if (!item || !item.malId) continue;

      const existing = byMalId.get(item.malId);
      if (existing) {
        // Enrich Shikimori Russian entry with Jikan synopsis/votes/genres
        if (existing.overview.includes('временно отсутствует') && item.overview) {
          existing.overview = item.overview;
        }
        if (!existing.voteCount && item.voteCount) existing.voteCount = item.voteCount;
        if (!existing.posterPath && item.posterPath) existing.posterPath = item.posterPath;
        if (!existing.backdropPath && item.backdropPath) existing.backdropPath = item.backdropPath;
        if ((!existing.genres || existing.genres.length <= 1) && item.genres.length > 0) {
          existing.genres = item.genres;
        }
      } else {
        byMalId.set(item.malId, item);
      }
    }

    return Array.from(byMalId.values());
  }

  private resolveShikiImage(path?: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${SHIKIMORI_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private mapShikiItem(s: any): MediaItem | null {
    const malId = Number(s?.id);
    const title = s?.russian || s?.name;
    if (!malId || !title) return null;

    const type: MediaType = String(s?.kind || '').toLowerCase() === 'movie' ? 'movie' : 'tv';
    const aired = s?.aired_on || '';
    const year = aired ? new Date(aired).getFullYear() : 2024;
    const score = parseFloat(String(s?.score || 0)) || 0;
    const posterPath = this.resolveShikiImage(s?.image?.original || s?.image?.preview);

    return {
      id: `mal-${malId}`,
      malId,
      source: 'shikimori',
      type,
      title: String(title),
      originalTitle: s?.name || undefined,
      overview: 'Описание аниме временно отсутствует.',
      posterPath,
      backdropPath: posterPath,
      releaseDate: aired || undefined,
      releaseYear: isNaN(year) ? 2024 : year,
      voteAverage: Number(score.toFixed(1)),
      ageRating: '16+',
      genres: [{ id: 16, name: 'Аниме' }],
    };
  }

  private mapJikanItem(j: any): MediaItem | null {
    const malId = Number(j?.mal_id);
    const title = j?.title || j?.title_english;
    if (!malId || !title) return null;

    const type: MediaType = String(j?.type || '').toLowerCase() === 'movie' ? 'movie' : 'tv';
    const aired = j?.aired?.from ? String(j.aired.from).slice(0, 10) : undefined;
    const year = Number(j?.year) || (aired ? new Date(aired).getFullYear() : 2024);
    const posterPath = j?.images?.jpg?.large_image_url || j?.images?.jpg?.image_url || null;
    const backdropPath = j?.trailer?.images?.maximum_image_url || posterPath;

    return {
      id: `mal-${malId}`,
      malId,
      source: 'jikan',
      type,
      title: String(title),
      originalTitle: j?.title_japanese || j?.title || undefined,
      overview: stripHtml(j?.synopsis) || 'Описание аниме временно отсутствует.',
      posterPath,
      backdropPath,
      releaseDate: aired,
      releaseYear: isNaN(year) ? 2024 : year,
      voteAverage: Number((Number(j?.score) || 0).toFixed(1)),
      voteCount: Number(j?.scored_by) || undefined,
      ageRating: this.mapAnimeAgeRating(j?.rating),
      genres: Array.isArray(j?.genres)
        ? j.genres.map((g: any, idx: number) => ({
            id: Number(g.mal_id) || 8000 + idx,
            name: g.name,
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

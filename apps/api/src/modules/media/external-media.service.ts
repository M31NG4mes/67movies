import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';

export interface TrailerItem {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  language: string;
  embedUrl: string;
}

export interface OmdbExtra {
  imdbRating?: string;
  rottenTomatoes?: string;
  metacritic?: string;
  awards?: string;
  boxOffice?: string;
}

export interface KinopoiskExtra {
  kpId?: number;
  kpRating?: number;
  imdbRating?: number;
  facts?: string[];
  budget?: string;
}

export interface AnimeExtra {
  malId: number;
  score?: number;
  studios: string[];
  status?: string;
  episodes?: number;
  broadcast?: string;
  url: string;
}

export interface TvMazeEpisodeItem {
  id: number;
  showName: string;
  episodeName: string;
  season: number;
  number: number;
  airdate: string;
  airtime: string;
  network?: string;
  poster?: string | null;
}

@Injectable()
export class ExternalMediaService {
  private readonly logger = new Logger(ExternalMediaService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  private async fetchJson<T>(url: string, headers: Record<string, string> = {}, timeoutMs = 4000): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': '67movies/1.0', ...headers },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 1. Official YouTube Trailers from TMDB (Russian first, English fallback)
   */
  async getTrailers(tmdbId: string, type: 'movie' | 'tv' = 'movie'): Promise<TrailerItem[]> {
    if (!/^\d+$/.test(String(tmdbId || '').trim())) return [];

    const cacheKey = `ext:trailers:${type}:${tmdbId}`;
    const cached = await this.redisService.get<TrailerItem[]>(cacheKey);
    if (cached) return cached;

    const apiKey = this.configService.get<string>('TMDB_API_KEY', '');
    if (!apiKey) return [];

    const pathType = type === 'tv' ? 'tv' : 'movie';
    const [ruRes, enRes] = await Promise.all([
      this.fetchJson<any>(
        `https://api.themoviedb.org/3/${pathType}/${tmdbId}/videos?api_key=${apiKey}&language=ru-RU`,
      ),
      this.fetchJson<any>(
        `https://api.themoviedb.org/3/${pathType}/${tmdbId}/videos?api_key=${apiKey}&language=en-US`,
      ),
    ]);

    const seen = new Set<string>();
    const combined: TrailerItem[] = [];

    const collect = (list: any[] | undefined, lang: string) => {
      if (!Array.isArray(list)) return;
      for (const v of list) {
        if (v.site !== 'YouTube' || !v.key || seen.has(v.key)) continue;
        if (!['Trailer', 'Teaser'].includes(v.type)) continue;
        seen.add(v.key);
        combined.push({
          id: v.id || v.key,
          key: v.key,
          name: v.name || 'Трейлер',
          site: v.site,
          type: v.type,
          language: lang,
          embedUrl: `https://www.youtube.com/embed/${v.key}?autoplay=1&rel=0`,
        });
      }
    };

    collect(ruRes?.results, 'ru');
    collect(enRes?.results, 'en');

    const result = combined.slice(0, 4);
    await this.redisService.set(cacheKey, result, 3600);
    return result;
  }

  /**
   * 2. OMDb API (IMDb, Rotten Tomatoes, Metacritic, Oscars/Awards)
   * Requires optional OMDB_API_KEY in .env (free at omdbapi.com)
   */
  async getOmdbMeta(imdbId?: string, title?: string, year?: string): Promise<OmdbExtra | null> {
    const apiKey = this.configService.get<string>('OMDB_API_KEY', '').trim();
    if (!apiKey || (!imdbId && !title)) return null;

    const cacheKey = `ext:omdb:${imdbId || title}:${year || ''}`;
    const cached = await this.redisService.get<OmdbExtra>(cacheKey);
    if (cached) return cached;

    const sp = new URLSearchParams({ apikey: apiKey });
    if (imdbId) sp.set('i', imdbId);
    else if (title) sp.set('t', title);
    if (year) sp.set('y', year);

    const data = await this.fetchJson<any>(`https://www.omdbapi.com/?${sp.toString()}`);
    if (!data || data.Response === 'False') return null;

    const rt = Array.isArray(data.Ratings)
      ? data.Ratings.find((r: any) => r.Source === 'Rotten Tomatoes')?.Value
      : undefined;

    const extra: OmdbExtra = {
      imdbRating: data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : undefined,
      rottenTomatoes: rt,
      metacritic: data.Metascore && data.Metascore !== 'N/A' ? `${data.Metascore}/100` : undefined,
      awards: data.Awards && data.Awards !== 'N/A' ? data.Awards : undefined,
      boxOffice: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : undefined,
    };

    await this.redisService.set(cacheKey, extra, 86400);
    return extra;
  }

  /**
   * 3. Kinopoisk API (Kinopoisk.dev v1.4 or Kinopoisk Unofficial API v2.2 fallback)
   * Requires optional KINOPOISK_DEV_API_KEY or KINOPOISK_UNOFFICIAL_API_KEY in .env
   */
  async getKinopoiskDevMeta(title?: string, year?: string): Promise<KinopoiskExtra | null> {
    const kpDevKey = this.configService.get<string>('KINOPOISK_DEV_API_KEY', '').trim();
    const kpUnofficialKey = this.configService.get<string>('KINOPOISK_UNOFFICIAL_API_KEY', '').trim();
    if ((!kpDevKey && !kpUnofficialKey) || !title) return null;

    const cacheKey = `ext:kpdev:${title}:${year || ''}`;
    const cached = await this.redisService.get<KinopoiskExtra>(cacheKey);
    if (cached) return cached;

    if (kpDevKey) {
      const data = await this.fetchJson<any>(
        `https://api.kinopoisk.dev/v1.4/movie/search?page=1&limit=1&query=${encodeURIComponent(title)}`,
        { 'X-API-KEY': kpDevKey },
      );

      const doc = data?.docs?.[0];
      if (doc) {
        const extra: KinopoiskExtra = {
          kpId: doc.id,
          kpRating: doc.rating?.kp ? Math.round(doc.rating.kp * 10) / 10 : undefined,
          imdbRating: doc.rating?.imdb ? Math.round(doc.rating.imdb * 10) / 10 : undefined,
          facts: Array.isArray(doc.facts)
            ? doc.facts
                .filter((f: any) => !f.spoiler && f.value)
                .slice(0, 3)
                .map((f: any) => String(f.value).replace(/<[^>]+>/g, ''))
            : undefined,
        };

        await this.redisService.set(cacheKey, extra, 86400);
        return extra;
      }
    }

    if (kpUnofficialKey) {
      const data = await this.fetchJson<any>(
        `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(title)}&page=1`,
        { 'X-API-KEY': kpUnofficialKey },
      );
      const film = data?.films?.[0];
      if (film) {
        const kpRating = parseFloat(String(film.rating || 0));
        const extra: KinopoiskExtra = {
          kpId: Number(film.filmId) || undefined,
          kpRating: !isNaN(kpRating) && kpRating > 0 ? Math.round(kpRating * 10) / 10 : undefined,
        };
        await this.redisService.set(cacheKey, extra, 86400);
        return extra;
      }
    }

    return null;
  }

  /**
   * 4. Jikan (MyAnimeList) API — 100% free, no API key required
   */
  async getAnimeInfo(title?: string): Promise<AnimeExtra | null> {
    if (!title) return null;
    const cacheKey = `ext:jikan:${title.toLowerCase()}`;
    const cached = await this.redisService.get<AnimeExtra>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchJson<any>(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`,
    );
    const anime = data?.data?.[0];
    if (!anime) return null;

    const extra: AnimeExtra = {
      malId: anime.mal_id,
      score: anime.score ?? undefined,
      studios: Array.isArray(anime.studios) ? anime.studios.map((s: any) => s.name) : [],
      status: anime.status ?? undefined,
      episodes: anime.episodes ?? undefined,
      broadcast: anime.broadcast?.string ?? undefined,
      url: anime.url,
    };

    await this.redisService.set(cacheKey, extra, 86400);
    return extra;
  }

  /**
   * 5. TVMaze Live Episode Airing Schedule — 100% free, no API key required
   */
  async getTvMazeSchedule(dateStr?: string): Promise<TvMazeEpisodeItem[]> {
    const date = dateStr || new Date().toISOString().split('T')[0];
    const cacheKey = `ext:tvmaze:${date}`;
    const cached = await this.redisService.get<TvMazeEpisodeItem[]>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchJson<any[]>(
      `https://api.tvmaze.com/schedule?country=US&date=${encodeURIComponent(date)}`,
    );
    if (!Array.isArray(data)) return [];

    const items: TvMazeEpisodeItem[] = data
      .filter((ep) => ep?.show?.name && ep?.name)
      .slice(0, 12)
      .map((ep) => ({
        id: ep.id,
        showName: ep.show.name,
        episodeName: ep.name,
        season: ep.season || 1,
        number: ep.number || 1,
        airdate: ep.airdate || date,
        airtime: ep.airtime || '20:00',
        network: ep.show.network?.name || ep.show.webChannel?.name,
        poster: ep.show.image?.medium || null,
      }));

    await this.redisService.set(cacheKey, items, 3600);
    return items;
  }

  /**
   * 6. Live GIF Search (Tenor public API) — thousands of GIFs for chat
   */
  async searchGifs(query?: string, limit = 32): Promise<Array<{ id: string; title: string; url: string; preview: string }>> {
    const q = (query || '').trim();
    const safeLimit = Math.min(40, Math.max(8, Number(limit) || 32));
    const cacheKey = `ext:gifs:${q.toLowerCase() || 'trending'}:${safeLimit}`;
    const cached = await this.redisService.get<any[]>(cacheKey);
    if (cached && cached.length > 0) return cached;

    const apiKey = this.configService.get<string>('TENOR_API_KEY') || 'LIVDSRZULELA';
    const endpoint = q
      ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${apiKey}&limit=${safeLimit}&contentfilter=medium`
      : `https://g.tenor.com/v1/trending?key=${apiKey}&limit=${safeLimit}&contentfilter=medium`;

    const data = await this.fetchJson<any>(endpoint);
    const results = Array.isArray(data?.results) ? data.results : [];
    const mapped = results
      .map((item: any) => {
        const media = item?.media?.[0];
        const url = media?.gif?.url || media?.mediumgif?.url || media?.tinygif?.url;
        const preview = media?.tinygif?.url || media?.nanogif?.url || url;
        if (!url) return null;
        return {
          id: String(item.id),
          title: item.content_description || item.title || 'GIF',
          url,
          preview,
        };
      })
      .filter(Boolean);

    if (mapped.length > 0) {
      await this.redisService.set(cacheKey, mapped, 600);
    }
    return mapped;
  }

  /**
   * Combined enrichment endpoint for /movie/[id]
   */
  async getAllExtras(params: {
    tmdbId: string;
    type: 'movie' | 'tv';
    title?: string;
    originalTitle?: string;
    year?: string;
    imdbId?: string;
    isAnime?: boolean;
  }) {
    const searchTitle = params.originalTitle || params.title;
    const [trailers, omdb, kinopoisk, anime] = await Promise.all([
      this.getTrailers(params.tmdbId, params.type),
      this.getOmdbMeta(params.imdbId, searchTitle, params.year),
      this.getKinopoiskDevMeta(params.title || searchTitle, params.year),
      params.isAnime ? this.getAnimeInfo(searchTitle) : Promise.resolve(null),
    ]);

    return { trailers, omdb, kinopoisk, anime };
  }
}

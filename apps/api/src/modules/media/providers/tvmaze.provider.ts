import { Injectable, Logger } from '@nestjs/common';
import { Episode, Genre, MediaItem, Person, Season } from '@cinemaflow/types';
import { RedisService } from '../../../common/redis/redis.service';
import { DiscoverProviderOptions, stripHtml } from '../media-aggregator.util';

const TMDB_TO_TVMAZE_GENRE: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Anime',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science-Fiction',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action',
  10765: 'Science-Fiction',
};

const LANG_TO_TVMAZE_LANGUAGE: Record<string, string> = {
  en: 'english',
  ru: 'russian',
  ja: 'japanese',
  ko: 'korean',
  fr: 'french',
  es: 'spanish',
  tr: 'turkish',
};

@Injectable()
export class TvMazeProviderService {
  private readonly logger = new Logger(TvMazeProviderService.name);

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
        headers: { Accept: 'application/json', 'User-Agent': '67movies/1.0' },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as T;
      if (data) {
        await this.redisService.set(cacheKey, data, ttlSeconds);
      }
      return data;
    } catch (err: any) {
      this.logger.debug(`TVMaze fetch skipped [${url}]: ${err?.message || err}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async search(query: string): Promise<MediaItem[]> {
    const q = query.trim();
    if (!q) return [];

    const data = await this.fetchJson<any[]>(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`,
      `tvmaze:search:${q.toLowerCase()}`,
      600,
    );
    if (!Array.isArray(data)) return [];

    return data
      .slice(0, 12)
      .map((entry) => this.mapShow(entry?.show))
      .filter(Boolean) as MediaItem[];
  }

  async getPopular(page = 1): Promise<MediaItem[]> {
    const indexPage = Math.max(0, Math.floor((page - 1) / 3));
    const shows = await this.fetchJson<any[]>(
      `https://api.tvmaze.com/shows?page=${indexPage}`,
      `tvmaze:shows:p:${indexPage}`,
      3600,
    );
    if (!Array.isArray(shows)) return [];

    const sorted = [...shows]
      .filter((s) => s?.image?.medium && (s?.rating?.average || 0) >= 6.5)
      .sort((a, b) => (b.weight || 0) - (a.weight || 0));

    const sliceStart = ((page - 1) % 3) * 10;
    return sorted
      .slice(sliceStart, sliceStart + 10)
      .map((s) => this.mapShow(s))
      .filter(Boolean) as MediaItem[];
  }

  async getNew(page = 1): Promise<MediaItem[]> {
    const today = new Date().toISOString().split('T')[0];
    const schedule = await this.fetchJson<any[]>(
      `https://api.tvmaze.com/schedule?country=US&date=${today}`,
      `tvmaze:sched:catalog:${today}`,
      1800,
    );
    if (!Array.isArray(schedule)) return [];

    const seen = new Set<number>();
    const items: MediaItem[] = [];
    for (const ep of schedule) {
      const show = ep?.show;
      if (!show?.id || seen.has(show.id) || !show?.image?.medium) continue;
      seen.add(show.id);
      const mapped = this.mapShow(show);
      if (mapped) items.push(mapped);
    }

    const start = (page - 1) * 10;
    return items.slice(start, start + 10);
  }

  async discover(options: DiscoverProviderOptions): Promise<MediaItem[]> {
    if (options.type !== 'tv') return [];

    const indexPage = Math.max(0, Math.floor((options.page - 1) / 2));
    const shows = await this.fetchJson<any[]>(
      `https://api.tvmaze.com/shows?page=${indexPage}`,
      `tvmaze:shows:p:${indexPage}`,
      3600,
    );
    if (!Array.isArray(shows)) return [];

    const targetGenre = options.genreId ? TMDB_TO_TVMAZE_GENRE[options.genreId] : undefined;
    const targetLang = options.originalLanguage
      ? LANG_TO_TVMAZE_LANGUAGE[options.originalLanguage]
      : undefined;

    let filtered = shows.filter((s) => {
      if (!s?.name || !s?.image?.medium) return false;
      if (targetGenre && (!Array.isArray(s.genres) || !s.genres.includes(targetGenre))) {
        return false;
      }
      if (targetLang && String(s.language || '').toLowerCase() !== targetLang) {
        return false;
      }
      const year = s.premiered ? parseInt(String(s.premiered).slice(0, 4), 10) : 0;
      if (options.yearFrom && year && year < options.yearFrom) return false;
      if (options.yearTo && year && year > options.yearTo) return false;
      const rating = Number(s.rating?.average || 0);
      if (options.minRating && rating < options.minRating) return false;
      return true;
    });

    if (options.sort === 'rating') {
      filtered.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));
    } else if (options.sort === 'date') {
      filtered.sort((a, b) => String(b.premiered || '').localeCompare(String(a.premiered || '')));
    } else {
      filtered.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    }

    const sliceStart = ((options.page - 1) % 2) * 10;
    return filtered
      .slice(sliceStart, sliceStart + 10)
      .map((s) => this.mapShow(s))
      .filter(Boolean) as MediaItem[];
  }

  async getDetails(tvMazeId: number): Promise<MediaItem | null> {
    if (!tvMazeId) return null;

    const show = await this.fetchJson<any>(
      `https://api.tvmaze.com/shows/${tvMazeId}?embed[]=cast&embed[]=seasons`,
      `tvmaze:detail:${tvMazeId}`,
      7200,
    );
    if (!show || !show.id) return null;

    const base = this.mapShow(show);
    if (!base) return null;

    const cast: Person[] = Array.isArray(show._embedded?.cast)
      ? show._embedded.cast.slice(0, 14).map((entry: any, idx: number) => ({
          id: Number(entry?.person?.id) || 70000 + idx,
          name: entry?.person?.name || 'Актёр',
          character: entry?.character?.name || undefined,
          profilePath: entry?.person?.image?.medium || null,
        }))
      : [];

    const seasons: Season[] = Array.isArray(show._embedded?.seasons)
      ? show._embedded.seasons
          .filter((s: any) => Number(s.number) > 0)
          .map((s: any) => ({
            id: Number(s.id),
            seasonNumber: Number(s.number),
            name: s.name || `Сезон ${s.number}`,
            overview: stripHtml(s.summary) || undefined,
            posterPath: s.image?.medium || base.posterPath || null,
            airDate: s.premiereDate || undefined,
            episodeCount: Number(s.episodeOrder) || 0,
          }))
      : [];

    return {
      ...base,
      cast,
      seasons,
    };
  }

  async getSeason(tvMazeId: number, seasonNumber: number): Promise<Season | null> {
    if (!tvMazeId) return null;

    const seasons = await this.fetchJson<any[]>(
      `https://api.tvmaze.com/shows/${tvMazeId}/seasons`,
      `tvmaze:seasons:${tvMazeId}`,
      7200,
    );
    const target = Array.isArray(seasons)
      ? seasons.find((s) => Number(s.number) === seasonNumber)
      : null;
    if (!target?.id) return null;

    const rawEpisodes = await this.fetchJson<any[]>(
      `https://api.tvmaze.com/seasons/${target.id}/episodes`,
      `tvmaze:season:eps:${target.id}`,
      7200,
    );
    const episodes: Episode[] = Array.isArray(rawEpisodes)
      ? rawEpisodes.map((ep: any, idx: number) => ({
          id: Number(ep.id) || `tvmaze-${tvMazeId}-s${seasonNumber}e${idx + 1}`,
          seasonNumber,
          episodeNumber: Number(ep.number) || idx + 1,
          name: ep.name || `Серия ${ep.number || idx + 1}`,
          overview: stripHtml(ep.summary) || undefined,
          stillPath: ep.image?.medium || ep.image?.original || null,
          airDate: ep.airdate || undefined,
          voteAverage: ep.rating?.average ? Number(ep.rating.average) : undefined,
          durationMinutes: Number(ep.runtime) || 45,
        }))
      : [];

    return {
      id: Number(target.id),
      seasonNumber,
      name: target.name || `Сезон ${seasonNumber}`,
      overview: stripHtml(target.summary) || undefined,
      posterPath: target.image?.medium || null,
      airDate: target.premiereDate || undefined,
      episodeCount: episodes.length || Number(target.episodeOrder) || 0,
      episodes,
    };
  }

  private mapShow(show: any): MediaItem | null {
    const id = Number(show?.id);
    if (!id || !show?.name) return null;

    const premiered = show?.premiered || '';
    const year = premiered ? parseInt(String(premiered).slice(0, 4), 10) : 2024;
    const posterPath = show?.image?.original || show?.image?.medium || null;
    const genres: Genre[] = Array.isArray(show?.genres)
      ? show.genres.map((g: string, idx: number) => ({
          id: 7000 + idx,
          name: g,
        }))
      : [];

    return {
      id: `tvmaze-${id}`,
      tvmazeId: id,
      imdbId: show?.externals?.imdb || undefined,
      source: 'tvmaze',
      type: 'tv',
      title: String(show.name),
      originalTitle: String(show.name),
      overview: stripHtml(show.summary) || 'Описание сериала временно отсутствует.',
      posterPath,
      backdropPath: posterPath,
      releaseDate: premiered || undefined,
      releaseYear: isNaN(year) ? 2024 : year,
      voteAverage: Number((Number(show?.rating?.average) || 0).toFixed(1)),
      durationMinutes: Number(show?.averageRuntime || show?.runtime) || 45,
      ageRating: '16+',
      genres,
    };
  }
}

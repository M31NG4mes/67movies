import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Genre, MediaItem, MediaType, Person } from '@cinemaflow/types';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class OmdbProviderService {
  private readonly logger = new Logger(OmdbProviderService.name);
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.apiKey = this.configService.get<string>('OMDB_API_KEY', '').trim();
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async fetchJson<T>(url: string, cacheKey: string, ttlSeconds = 1800): Promise<T | null> {
    const cached = await this.redisService.get<T>(cacheKey);
    if (cached) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': '67movies/1.0' },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      if (!data || data.Response === 'False') return null;
      await this.redisService.set(cacheKey, data, ttlSeconds);
      return data as T;
    } catch (err: any) {
      this.logger.debug(`OMDb fetch skipped: ${err?.message || err}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async search(query: string, page = 1): Promise<MediaItem[]> {
    const q = query.trim();
    if (!q || !this.isConfigured) return [];

    const sp = new URLSearchParams({
      apikey: this.apiKey,
      s: q,
      page: String(page),
    });

    const data = await this.fetchJson<any>(
      `https://www.omdbapi.com/?${sp.toString()}`,
      `omdb:search:${q.toLowerCase()}:${page}`,
      600,
    );
    if (!Array.isArray(data?.Search)) return [];

    return data.Search.filter((item: any) => item.Type === 'movie' || item.Type === 'series')
      .map((item: any): MediaItem | null => {
        const imdbId = item.imdbID ? String(item.imdbID) : '';
        if (!imdbId || !item.Title) return null;
        const type: MediaType = item.Type === 'series' ? 'tv' : 'movie';
        const yearMatch = String(item.Year || '').match(/\d{4}/);
        const year = yearMatch ? parseInt(yearMatch[0], 10) : 2024;
        const posterPath = item.Poster && item.Poster !== 'N/A' ? String(item.Poster) : null;

        return {
          id: `omdb-${imdbId}`,
          imdbId,
          source: 'omdb',
          type,
          title: String(item.Title),
          originalTitle: String(item.Title),
          overview: 'Описание фильма временно отсутствует.',
          posterPath,
          backdropPath: posterPath,
          releaseYear: year,
          voteAverage: 0,
          ageRating: '16+',
          genres: [],
        };
      })
      .filter(Boolean) as MediaItem[];
  }

  async getDetails(imdbId: string): Promise<MediaItem | null> {
    if (!imdbId || !this.isConfigured) return null;
    const cleanImdb = imdbId.replace(/^omdb-/i, '');

    const sp = new URLSearchParams({
      apikey: this.apiKey,
      i: cleanImdb,
      plot: 'full',
    });

    const d = await this.fetchJson<any>(
      `https://www.omdbapi.com/?${sp.toString()}`,
      `omdb:detail:${cleanImdb}`,
      7200,
    );
    if (!d || !d.Title) return null;

    const type: MediaType = d.Type === 'series' ? 'tv' : 'movie';
    const yearMatch = String(d.Year || '').match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : 2024;
    const rating = parseFloat(String(d.imdbRating || 0));
    const votes = parseInt(String(d.imdbVotes || '0').replace(/,/g, ''), 10);
    const runtimeMatch = String(d.Runtime || '').match(/\d+/);
    const posterPath = d.Poster && d.Poster !== 'N/A' ? String(d.Poster) : null;

    const genres: Genre[] =
      d.Genre && d.Genre !== 'N/A'
        ? String(d.Genre)
            .split(',')
            .map((name, idx) => ({ id: 6000 + idx, name: name.trim() }))
        : [];

    const cast: Person[] =
      d.Actors && d.Actors !== 'N/A'
        ? String(d.Actors)
            .split(',')
            .map((name, idx) => ({ id: 80000 + idx, name: name.trim() }))
        : [];

    const rated = String(d.Rated || '');
    const ageRating =
      rated === 'R' || rated === 'NC-17' || rated === 'TV-MA'
        ? '18+'
        : rated === 'PG-13' || rated === 'TV-14'
        ? '16+'
        : rated === 'PG' || rated === 'TV-PG'
        ? '12+'
        : rated === 'G'
        ? '0+'
        : '16+';

    return {
      id: `omdb-${cleanImdb}`,
      imdbId: cleanImdb,
      source: 'omdb',
      type,
      title: String(d.Title),
      originalTitle: String(d.Title),
      overview: d.Plot && d.Plot !== 'N/A' ? String(d.Plot) : 'Описание фильма временно отсутствует.',
      posterPath,
      backdropPath: posterPath,
      releaseYear: year,
      voteAverage: isNaN(rating) ? 0 : Number(rating.toFixed(1)),
      voteCount: isNaN(votes) ? undefined : votes,
      durationMinutes: runtimeMatch ? parseInt(runtimeMatch[0], 10) : undefined,
      ageRating,
      genres,
      cast,
    };
  }
}

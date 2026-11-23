export type MediaType = 'movie' | 'tv';
export type MediaSourceProvider = 'tmdb' | 'kinopoisk' | 'shikimori' | 'jikan' | 'tvmaze' | 'omdb';

export interface Genre {
  id: number;
  name: string;
}

export interface Person {
  id: number;
  name: string;
  character?: string;
  role?: string;
  profilePath?: string | null;
}

export interface Episode {
  id: number | string;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview?: string;
  stillPath?: string | null;
  airDate?: string;
  voteAverage?: number;
  durationMinutes?: number;
}

export interface Season {
  id: number | string;
  seasonNumber: number;
  name: string;
  overview?: string;
  posterPath?: string | null;
  airDate?: string;
  episodeCount: number;
  episodes?: Episode[];
}

export interface MediaItem {
  id: string; // Internal string ID, numeric TMDB ID, or prefixed ID (kp-*, mal-*, tvmaze-*, omdb-*)
  tmdbId?: number;
  imdbId?: string;
  kinopoiskId?: number;
  malId?: number;
  tvmazeId?: number;
  source?: MediaSourceProvider;
  type: MediaType;
  title: string;
  originalTitle?: string;
  tagline?: string;
  overview: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string;
  releaseYear: number;
  voteAverage: number;
  voteCount?: number;
  durationMinutes?: number;
  ageRating?: string; // 18+, 16+, 12+, 6+, 0+
  genres: Genre[];
  cast?: Person[];
  seasons?: Season[];
  isFeatured?: boolean;
  recommendations?: MediaItem[];
  similar?: MediaItem[];
}

export interface CatalogFilterQuery {
  type?: MediaType;
  genreId?: number;
  year?: number;
  sortBy?: 'popular' | 'top_rated' | 'newest';
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
}

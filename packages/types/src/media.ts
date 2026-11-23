export type MediaType = 'movie' | 'tv';
export type MediaSourceProvider =
  | 'tmdb'
  | 'kinopoisk'
  | 'shikimori'
  | 'jikan'
  | 'tvmaze'
  | 'omdb'
  | 'aniliberty'
  | 'hdrezka';

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

export interface VoiceoverMember {
  name: string;
  role: string; // e.g. 'Озвучка', 'Тайминг', 'Звукорежиссёр'
}

export interface MediaItem {
  id: string; // Internal string ID, numeric TMDB ID, or prefixed ID (kp-*, mal-*, tvmaze-*, omdb-*, al-*)
  tmdbId?: number;
  imdbId?: string;
  kinopoiskId?: number;
  malId?: number;
  tvmazeId?: number;
  anilibertyId?: number;
  rezkaUrl?: string;
  source?: MediaSourceProvider;
  voiceovers?: VoiceoverMember[]; // AniLiberty dubbing team
  voiceTeamName?: string;
  isOngoing?: boolean;
  episodesTotal?: number;
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

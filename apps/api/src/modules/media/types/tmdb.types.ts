export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbMovieResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  genre_ids: number[];
  popularity: number;
  vote_average: number;
  vote_count: number;
  adult: boolean;
  video: boolean;
}

export interface TmdbTvResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  genre_ids: number[];
  popularity: number;
  vote_average: number;
  vote_count: number;
  origin_country: string[];
}

export interface TmdbMultiSearchResult {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  profile_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
}

export interface TmdbPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  original_name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TmdbCredits {
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

export interface TmdbReleaseDateItem {
  certification: string;
  iso_639_1: string;
  note: string;
  release_date: string;
  type: number;
}

export interface TmdbReleaseDatesResult {
  iso_3166_1: string;
  release_dates: TmdbReleaseDateItem[];
}

export interface TmdbContentRatingItem {
  iso_3166_1: string;
  rating: string;
}

export interface TmdbEpisodeResponse {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  air_date: string;
  vote_average: number;
  vote_count: number;
  runtime?: number;
}

export interface TmdbSeasonResponse {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  poster_path: string | null;
  air_date: string;
  episodes: TmdbEpisodeResponse[];
}

export interface TmdbMovieDetailsResponse {
  id: number;
  imdb_id: string | null;
  title: string;
  original_title: string;
  tagline: string | null;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  genres: TmdbGenre[];
  vote_average: number;
  vote_count: number;
  status: string;
  budget: number;
  revenue: number;
  credits?: TmdbCredits;
  release_dates?: {
    results: TmdbReleaseDatesResult[];
  };
  recommendations?: TmdbPaginatedResponse<TmdbMovieResult>;
  similar?: TmdbPaginatedResponse<TmdbMovieResult>;
}

export interface TmdbTvDetailsResponse {
  id: number;
  name: string;
  original_name: string;
  tagline: string | null;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string;
  episode_run_time: number[];
  number_of_seasons: number;
  number_of_episodes: number;
  genres: TmdbGenre[];
  vote_average: number;
  vote_count: number;
  status: string;
  seasons: Array<{
    id: number;
    name: string;
    overview: string;
    season_number: number;
    episode_count: number;
    poster_path: string | null;
    air_date: string;
  }>;
  credits?: TmdbCredits;
  content_ratings?: {
    results: TmdbContentRatingItem[];
  };
  recommendations?: TmdbPaginatedResponse<TmdbTvResult>;
  similar?: TmdbPaginatedResponse<TmdbTvResult>;
}

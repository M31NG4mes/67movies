import { MediaType } from './media';

export type VideoQuality = '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p' | '4K' | 'auto';

export type StreamFormat = 'hls' | 'dash' | 'mp4' | 'torrent';

export interface VideoAudioTrack {
  id: string;
  language: string; // ISO 639-1 code (e.g. 'ru', 'en')
  label: string;    // Display name (e.g. 'Русский (Дубляж)', 'English (Original)')
  isDefault?: boolean;
}

export interface VideoSubtitle {
  id: string;
  language: string;
  label: string;
  url: string;
  format: 'vtt' | 'srt';
  isDefault?: boolean;
}

export interface VideoStream {
  id: string;
  providerId: string;
  providerName: string;
  title: string;
  voiceActing?: string; // Перевод или студия озвучки (e.g., 'LostFilm', 'Дубляж', 'Кубик в Кубе')
  season?: number;
  episode?: number;
  quality: VideoQuality;
  format: StreamFormat;
  streamUrl: string; // Direct URL or Proxied URL
  isProxyRequired?: boolean;
  headers?: Record<string, string>; // Referer, Origin, User-Agent, etc.
  audioTracks?: VideoAudioTrack[];
  subtitles?: VideoSubtitle[];
}

export interface StreamSourceGroup {
  providerId: string;
  providerName: string;
  voiceActing?: string;
  streams: VideoStream[];
}

export interface SourceSearchQuery {
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  year: number;
  tmdbId?: number;
  imdbId?: string;
  kinopoiskId?: number;
  season?: number;
  episode?: number;
}

export interface ISourceProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportsMedia: MediaType[];
  readonly isEnabled: boolean;

  searchStreams(query: SourceSearchQuery): Promise<VideoStream[]>;
}

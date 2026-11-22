import { VideoAudioTrack, VideoQuality, VideoStream, VideoSubtitle } from './source';

export interface PlayerQualityOption {
  quality: VideoQuality;
  height: number;
  bitrate?: number;
}

export interface PlayerState {
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  bufferedPercentage: number;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  isFullscreen: boolean;
  isPiP: boolean;
  playbackRate: number; // 0.5, 1.0, 1.25, 1.5, 2.0
  activeQuality: VideoQuality;
  availableQualities: PlayerQualityOption[];
  activeAudioTrackId?: string;
  availableAudioTracks: VideoAudioTrack[];
  activeSubtitleId?: string | null;
  availableSubtitles: VideoSubtitle[];
  error?: string | null;
}

export interface PlaybackSyncPayload {
  mediaId: string;
  seasonNumber?: number;
  episodeNumber?: number;
  currentTime: number;
  duration: number;
  completed?: boolean;
}

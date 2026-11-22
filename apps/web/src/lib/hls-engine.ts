import Hls from 'hls.js';
import { PlayerQualityOption, VideoAudioTrack, VideoQuality } from '@cinemaflow/types';

export interface HlsEngineCallbacks {
  onQualitiesLoaded: (qualities: PlayerQualityOption[]) => void;
  onAudioTracksLoaded: (tracks: VideoAudioTrack[]) => void;
  onBuffering: (isBuffering: boolean) => void;
  onError: (errorMessage: string) => void;
}

export class HlsEngine {
  private hls: Hls | null = null;
  private videoElement: HTMLVideoElement | null = null;

  init(
    video: HTMLVideoElement,
    streamUrl: string,
    callbacks: HlsEngineCallbacks
  ) {
    this.videoElement = video;
    this.destroy();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
      });

      this.hls = hls;
      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(streamUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const qualities: PlayerQualityOption[] = [
          { quality: 'auto', height: 0 },
          ...data.levels.map((level, idx) => {
            const h = level.height;
            let q: VideoQuality = 'auto';
            if (h >= 2160) q = '2160p';
            else if (h >= 1440) q = '1440p';
            else if (h >= 1080) q = '1080p';
            else if (h >= 720) q = '720p';
            else if (h >= 480) q = '480p';
            else q = '360p';
            return {
              quality: q,
              height: level.height,
              bitrate: level.bitrate,
            };
          }),
        ];
        callbacks.onQualitiesLoaded(qualities);
        callbacks.onBuffering(false);
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        const tracks: VideoAudioTrack[] = data.audioTracks.map((t, idx) => ({
          id: String(idx),
          language: t.lang || 'und',
          label: t.name || `Аудиодорожка ${idx + 1}`,
          isDefault: t.default,
        }));
        callbacks.onAudioTracksLoaded(tracks);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[HLS] Network error, recovering...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[HLS] Media error, recovering...');
              hls.recoverMediaError();
              break;
            default:
              this.destroy();
              callbacks.onError('Не удалось воспроизвести поток');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari HLS support
      video.src = streamUrl;
      callbacks.onQualitiesLoaded([{ quality: 'auto', height: 0 }]);
      callbacks.onBuffering(false);
    } else {
      // Direct video playback
      video.src = streamUrl;
      callbacks.onBuffering(false);
    }
  }

  setQuality(height: number) {
    if (!this.hls) return;
    if (height === 0) {
      this.hls.currentLevel = -1; // Auto ABR
    } else {
      const idx = this.hls.levels.findIndex((l) => l.height === height);
      if (idx !== -1) {
        this.hls.currentLevel = idx;
      }
    }
  }

  setAudioTrack(trackId: string) {
    if (!this.hls) return;
    const id = parseInt(trackId, 10);
    if (!isNaN(id)) {
      this.hls.audioTrack = id;
    }
  }

  destroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.videoElement) {
      this.videoElement.removeAttribute('src');
      this.videoElement.load();
    }
  }
}

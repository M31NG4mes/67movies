import Hls from 'hls.js';
import { PlayerQualityOption, VideoAudioTrack, VideoQuality } from '@cinemaflow/types';

export interface HlsEngineCallbacks {
  onQualitiesLoaded: (qualities: PlayerQualityOption[]) => void;
  onAudioTracksLoaded: (tracks: VideoAudioTrack[]) => void;
  onBuffering: (isBuffering: boolean) => void;
  onError: (errorMessage: string) => void;
  onProxyModeChange?: (isUsingProxy: boolean) => void;
}

export function toHttpsUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed.replace(/^http:\/\//i, 'https://');
}

export function buildSameOriginProxyUrl(rawUrl: string): string {
  if (!rawUrl || rawUrl.startsWith('/api/stream')) return rawUrl;
  const httpsUrl = toHttpsUrl(rawUrl);
  return `/api/stream?url=${encodeURIComponent(httpsUrl)}`;
}

export function isMicrosoftEdgeBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Edg\//i.test(navigator.userAgent);
}

export class HlsEngine {
  private hls: Hls | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private hasTriedFallback = false;

  init(
    video: HTMLVideoElement,
    streamUrl: string,
    callbacks: HlsEngineCallbacks,
    preferSafeProxy?: boolean
  ) {
    this.videoElement = video;
    this.hasTriedFallback = false;
    this.destroy();

    const cleanHttpsUrl = toHttpsUrl(streamUrl);
    const shouldStartWithProxy =
      typeof preferSafeProxy === 'boolean'
        ? preferSafeProxy
        : isMicrosoftEdgeBrowser() && /\.fun\b/i.test(cleanHttpsUrl);

    this.loadWithMode(video, cleanHttpsUrl, callbacks, shouldStartWithProxy);
  }

  private loadWithMode(
    video: HTMLVideoElement,
    cleanHttpsUrl: string,
    callbacks: HlsEngineCallbacks,
    useProxy: boolean
  ) {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    const effectiveUrl = useProxy ? buildSameOriginProxyUrl(cleanHttpsUrl) : cleanHttpsUrl;
    callbacks.onProxyModeChange?.(useProxy);

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
        hls.loadSource(effectiveUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        // Filter to minimum 720p when HD levels exist
        const hdLevels = data.levels.filter((l) => !l.height || l.height >= 720);
        const effectiveLevels = hdLevels.length > 0 ? hdLevels : data.levels;

        // Lock HLS ABR minimum level to 720p if available
        const min720Idx = data.levels.findIndex((l) => l.height >= 720);
        if (min720Idx !== -1) {
          hls.autoLevelCapping = -1;
          const highestIdx = data.levels.reduce(
            (best, l, idx) => (l.height >= (data.levels[best]?.height || 0) ? idx : best),
            min720Idx
          );
          hls.currentLevel = highestIdx;
        }

        const qualities: PlayerQualityOption[] = [
          { quality: 'auto', height: 0 },
          ...effectiveLevels.map((level) => {
            const h = level.height;
            let q: VideoQuality = 'auto';
            if (h >= 2160) q = '2160p';
            else if (h >= 1440) q = '1440p';
            else if (h >= 1080) q = '1080p';
            else q = '720p';
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
              if (!this.hasTriedFallback) {
                this.hasTriedFallback = true;
                console.warn(
                  `[HLS] Network error in ${useProxy ? 'proxy' : 'direct'} mode, switching to ${
                    !useProxy ? 'safe HTTPS proxy' : 'direct HTTPS'
                  }...`
                );
                this.loadWithMode(video, cleanHttpsUrl, callbacks, !useProxy);
                const playPromise = video.play();
                if (playPromise !== undefined) {
                  playPromise.catch(() => {});
                }
              } else {
                console.warn('[HLS] Network error, recovering...');
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[HLS] Media error, recovering...');
              hls.recoverMediaError();
              break;
            default:
              if (!this.hasTriedFallback) {
                this.hasTriedFallback = true;
                this.loadWithMode(video, cleanHttpsUrl, callbacks, !useProxy);
                return;
              }
              this.destroy();
              callbacks.onError('Не удалось воспроизвести поток');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari HLS support
      video.src = effectiveUrl;
      callbacks.onQualitiesLoaded([{ quality: 'auto', height: 0 }]);
      callbacks.onBuffering(false);
    } else {
      // Direct video playback
      video.src = effectiveUrl;
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

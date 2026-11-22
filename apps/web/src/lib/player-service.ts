import Hls from 'hls.js';
import {
  PlayerQualityOption,
  VideoAudioTrack,
  VideoQuality,
  VideoStream,
  VideoSubtitle,
} from '@cinemaflow/types';

export interface PlayerServiceCallbacks {
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number, bufferedEnd: number) => void;
  onBuffering?: (isBuffering: boolean) => void;
  onQualitiesLoaded?: (qualities: PlayerQualityOption[]) => void;
  onAudioTracksLoaded?: (tracks: VideoAudioTrack[]) => void;
  onSubtitlesLoaded?: (subtitles: VideoSubtitle[]) => void;
  onEnded?: () => void;
  onError?: (errorMessage: string) => void;
}

/**
 * Unified Player Service:
 * Handles format negotiation (HLS, DASH, MP4), stream attachment,
 * quality switching, audio track selection, and subtitle tracks.
 */
export class PlayerService {
  private hls: Hls | null = null;
  private video: HTMLVideoElement | null = null;
  private activeStream: VideoStream | null = null;
  private callbacks: PlayerServiceCallbacks = {};
  private activeSubtitleTrackElement: HTMLTrackElement | null = null;

  constructor(callbacks: PlayerServiceCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: PlayerServiceCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Initializes playback of a normalized VideoStream object
   */
  public async attach(
    videoElement: HTMLVideoElement,
    stream: VideoStream,
    startTime = 0
  ): Promise<void> {
    this.detach();
    this.video = videoElement;
    this.activeStream = stream;

    const streamUrl = stream.streamUrl || (stream as any).url || '';
    const fmt = stream.format || (stream as any).type || '';
    const isHls = fmt === 'hls' || streamUrl.includes('.m3u8');
    const isDash = fmt === 'dash' || streamUrl.includes('.mpd');
    const isMp4 = fmt === 'mp4' || streamUrl.includes('.mp4');

    this.bindVideoEvents(videoElement, startTime);

    // 1. HLS Stream Handling (HLS.js or Safari Native)
    if (isHls) {
      if (Hls.isSupported()) {
        this.initHlsJs(videoElement, streamUrl, startTime);
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari HLS
        videoElement.src = streamUrl;
        this.emitDefaultQualities();
        if (startTime > 0) {
          videoElement.currentTime = startTime;
        }
      } else {
        videoElement.src = streamUrl;
      }
    }
    // 2. DASH Stream Handling (with MP4 fallback)
    else if (isDash) {
      // Direct media source or HTML5 fallback for DASH
      videoElement.src = streamUrl;
      this.emitDefaultQualities();
      if (startTime > 0) {
        videoElement.currentTime = startTime;
      }
    }
    // 3. Direct Progressive MP4 Handling
    else {
      videoElement.src = streamUrl;
      this.emitDefaultQualities();
      if (startTime > 0) {
        videoElement.currentTime = startTime;
      }
    }

    // Pass static subtitles if provided in normalized stream
    if (stream.subtitles && stream.subtitles.length > 0) {
      this.callbacks.onSubtitlesLoaded?.(stream.subtitles);
    }

    // Pass static audio tracks if provided in normalized stream
    if (stream.audioTracks && stream.audioTracks.length > 0) {
      this.callbacks.onAudioTracksLoaded?.(stream.audioTracks);
    }
  }

  private initHlsJs(video: HTMLVideoElement, url: string, startTime: number) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 90,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
      startPosition: startTime > 0 ? startTime : -1,
    });

    this.hls = hls;
    hls.attachMedia(video);

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(url);
    });

    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      const qualities: PlayerQualityOption[] = [
        { quality: 'auto', height: 0 },
        ...data.levels.map((level) => {
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

      this.callbacks.onQualitiesLoaded?.(qualities);
      this.callbacks.onBuffering?.(false);
      this.callbacks.onReady?.();
    });

    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
      if (data.audioTracks && data.audioTracks.length > 0) {
        const tracks: VideoAudioTrack[] = data.audioTracks.map((t, idx) => ({
          id: String(idx),
          language: t.lang || 'und',
          label: t.name || `Дорожка ${idx + 1}`,
          isDefault: t.default,
        }));
        this.callbacks.onAudioTracksLoaded?.(tracks);
      }
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            this.callbacks.onError?.('Ошибка воспроизведения видеопотока');
            break;
        }
      }
    });
  }

  private bindVideoEvents(video: HTMLVideoElement, startTime: number) {
    video.onplay = () => this.callbacks.onPlay?.();
    video.onpause = () => this.callbacks.onPause?.();
    video.onwaiting = () => this.callbacks.onBuffering?.(true);
    video.onplaying = () => this.callbacks.onBuffering?.(false);
    video.onended = () => this.callbacks.onEnded?.();

    video.ontimeupdate = () => {
      const bufferedEnd =
        video.buffered.length > 0
          ? video.buffered.end(video.buffered.length - 1)
          : 0;
      this.callbacks.onTimeUpdate?.(video.currentTime, video.duration || 0, bufferedEnd);
    };

    video.onloadedmetadata = () => {
      if (startTime > 0 && Math.abs(video.currentTime - startTime) > 2) {
        video.currentTime = startTime;
      }
      this.callbacks.onBuffering?.(false);
      this.callbacks.onReady?.();
    };
  }

  private emitDefaultQualities() {
    this.callbacks.onQualitiesLoaded?.([
      { quality: 'auto', height: 0 },
      { quality: '1080p', height: 1080 },
      { quality: '720p', height: 720 },
      { quality: '480p', height: 480 },
    ]);
  }

  // =========================================================================
  // Control Methods
  // =========================================================================

  public async play(): Promise<void> {
    if (this.video) {
      return this.video.play();
    }
  }

  public pause(): void {
    if (this.video && !this.video.paused) {
      this.video.pause();
    }
  }

  public togglePlay(): void {
    if (!this.video) return;
    if (this.video.paused) {
      this.play().catch(() => {});
    } else {
      this.pause();
    }
  }

  public seek(seconds: number): void {
    if (this.video) {
      const target = Math.max(0, Math.min(this.video.duration || 0, seconds));
      this.video.currentTime = target;
    }
  }

  public skip(seconds: number): void {
    if (this.video) {
      this.seek(this.video.currentTime + seconds);
    }
  }

  public setVolume(volume: number): void {
    if (this.video) {
      this.video.volume = Math.max(0, Math.min(1, volume));
      if (volume > 0 && this.video.muted) {
        this.video.muted = false;
      }
    }
  }

  public toggleMute(): void {
    if (this.video) {
      this.video.muted = !this.video.muted;
    }
  }

  public setQuality(height: number): void {
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

  public setAudioTrack(trackId: string): void {
    if (!this.hls) return;
    const id = parseInt(trackId, 10);
    if (!isNaN(id)) {
      this.hls.audioTrack = id;
    }
  }

  public setSubtitle(sub: VideoSubtitle | null): void {
    if (!this.video) return;

    // Remove existing track element
    if (this.activeSubtitleTrackElement) {
      this.video.removeChild(this.activeSubtitleTrackElement);
      this.activeSubtitleTrackElement = null;
    }

    if (!sub || !sub.url) return;

    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = sub.label;
    track.srclang = sub.language;
    track.src = sub.url;
    track.default = true;

    this.video.appendChild(track);
    this.activeSubtitleTrackElement = track;
    track.track.mode = 'showing';
  }

  public setPlaybackRate(rate: number): void {
    if (this.video) {
      this.video.playbackRate = rate;
    }
  }

  public async toggleFullscreen(container: HTMLElement): Promise<void> {
    if (!document.fullscreenElement) {
      return container.requestFullscreen();
    } else {
      return document.exitFullscreen();
    }
  }

  public async togglePiP(): Promise<void> {
    if (!this.video) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      await this.video.requestPictureInPicture();
    }
  }

  public detach(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.activeSubtitleTrackElement && this.video) {
      try {
        this.video.removeChild(this.activeSubtitleTrackElement);
      } catch (e) {}
      this.activeSubtitleTrackElement = null;
    }
    if (this.video) {
      this.video.onplay = null;
      this.video.onpause = null;
      this.video.onwaiting = null;
      this.video.onplaying = null;
      this.video.onended = null;
      this.video.ontimeupdate = null;
      this.video.onloadedmetadata = null;
      this.video.removeAttribute('src');
      this.video.load();
      this.video = null;
    }
  }
}

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, SkipForward, ShieldCheck, X } from 'lucide-react';
import { HlsEngine } from '../../lib/hls-engine';
import { PlayerControls } from './PlayerControls';
import { TrackSelectorModal } from './TrackSelectorModal';
import { SourceSelectorModal, QualitySelectorModal } from './SourceSelectorModal';
import { EpisodePicker } from '../media/EpisodePicker';
import { usePlayerStore } from '../../stores/player.store';
import { usePlayerHotkeys } from '../../hooks/use-hotkeys';
import { usePlayerSync } from '../../hooks/use-player-sync';
import { Season, StreamSourceGroup, VideoStream } from '@cinemaflow/types';

interface VideoPlayerProps {
  mediaId: string;
  title: string;
  subtitle?: string;
  sourceGroups: StreamSourceGroup[];
  initialStream?: VideoStream;
  seasonNumber?: number;
  episodeNumber?: number;
  seasons?: Season[];
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  nextEpisodeLabel?: string;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  onSelectSeason?: (seasonNum: number) => void;
  onSelectEpisode?: (seasonNum: number, episodeNum: number) => void;
}

export function VideoPlayer({
  mediaId,
  title,
  subtitle,
  sourceGroups,
  initialStream,
  seasonNumber,
  episodeNumber,
  seasons = [],
  hasPrevEpisode = false,
  hasNextEpisode = false,
  nextEpisodeLabel,
  onPrevEpisode,
  onNextEpisode,
  onSelectSeason,
  onSelectEpisode,
}: VideoPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsEngineRef = useRef<HlsEngine | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Web Audio API refs for Audio Boost (up to 200%)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaSourceConnectedRef = useRef<boolean>(false);

  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  // Zustand Store
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const audioBoost = usePlayerStore((s) => s.audioBoost);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const autoPlayNext = usePlayerStore((s) => s.autoPlayNext);
  const useSafeProxy = usePlayerStore((s) => s.useSafeProxy);
  const osdMessage = usePlayerStore((s) => s.osdMessage);
  const centerActionIcon = usePlayerStore((s) => s.centerActionIcon);
  const activeStream = usePlayerStore((s) => s.activeStream);
  const activeQuality = usePlayerStore((s) => s.activeQuality);
  const isControlsVisible = usePlayerStore((s) => s.isControlsVisible);
  const isAudioSubsModalOpen = usePlayerStore((s) => s.isAudioSubsModalOpen);
  const isSourceModalOpen = usePlayerStore((s) => s.isSourceModalOpen);
  const isQualityModalOpen = usePlayerStore((s) => s.isQualityModalOpen);
  const error = usePlayerStore((s) => s.error);

  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setIsBuffering = usePlayerStore((s) => s.setIsBuffering);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setBufferedEnd = usePlayerStore((s) => s.setBufferedEnd);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen);
  const setIsControlsVisible = usePlayerStore((s) => s.setIsControlsVisible);
  const setUseSafeProxy = usePlayerStore((s) => s.setUseSafeProxy);
  const setIsUsingProxy = usePlayerStore((s) => s.setIsUsingProxy);
  const showOsd = usePlayerStore((s) => s.showOsd);
  const flashCenterIcon = usePlayerStore((s) => s.flashCenterIcon);
  const setActiveStream = usePlayerStore((s) => s.setActiveStream);
  const setActiveQuality = usePlayerStore((s) => s.setActiveQuality);
  const setAvailableQualities = usePlayerStore((s) => s.setAvailableQualities);
  const setAvailableAudioTracks = usePlayerStore((s) => s.setAvailableAudioTracks);
  const setActiveAudioTrackId = usePlayerStore((s) => s.setActiveAudioTrackId);
  const setAvailableSubtitles = usePlayerStore((s) => s.setAvailableSubtitles);
  const setActiveSubtitleId = usePlayerStore((s) => s.setActiveSubtitleId);
  const openAudioSubsModal = usePlayerStore((s) => s.openAudioSubsModal);
  const openSourceModal = usePlayerStore((s) => s.openSourceModal);
  const openQualityModal = usePlayerStore((s) => s.openQualityModal);
  const setError = usePlayerStore((s) => s.setError);
  const reset = usePlayerStore((s) => s.reset);

  // Fullscreen handler (targets player container so overlays, episodes, and controls stay visible)
  const handleToggleFullscreen = useCallback(async () => {
    try {
      const doc = document as any;
      const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (!isFs) {
        const container = containerRef.current as any;
        const video = videoRef.current as any;
        if (container?.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container?.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (video?.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        }
        setIsFullscreen(true);
        showOsd('⛶ Полноэкранный режим');
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        }
        setIsFullscreen(false);
        showOsd('⛶ Обычный режим');
      }
    } catch {
      // ignore fullscreen permission errors
    }
  }, [setIsFullscreen, showOsd]);

  // Keep fullscreen state synced with browser fullscreenchange event (e.g., when user presses Esc)
  useEffect(() => {
    const onFsChange = () => {
      const doc = document as any;
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [setIsFullscreen]);

  // Keyboard hotkeys (Left/Right arrows to seek ±10s, Up/Down arrows for volume, F for fullscreen, N/P for episodes)
  usePlayerHotkeys(videoRef, {
    onToggleFullscreen: handleToggleFullscreen,
    onPrevEpisode: hasPrevEpisode ? onPrevEpisode : undefined,
    onNextEpisode: hasNextEpisode ? onNextEpisode : undefined,
  });

  // History sync
  usePlayerSync({
    mediaId,
    seasonNumber,
    episodeNumber,
    currentTime,
    duration,
    isPlaying,
  });

  // Sync volume, mute, and playbackRate from store to HTMLVideoElement
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
    video.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  // Sync Web Audio API GainNode when audioBoost > 1
  useEffect(() => {
    if (audioBoost > 1 && !useSafeProxy) {
      // Ensure CORS-safe same-origin stream proxy is active when boosting audio via Web Audio API
      setUseSafeProxy(true);
    }
    const video = videoRef.current;
    if (!video) return;

    if (audioBoost > 1 && !mediaSourceConnectedRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaElementSource(video);
          const gain = ctx.createGain();
          gain.gain.value = audioBoost;
          source.connect(gain);
          gain.connect(ctx.destination);
          audioCtxRef.current = ctx;
          gainNodeRef.current = gain;
          mediaSourceConnectedRef.current = true;
        }
      } catch {
        // Fallback smoothly if MediaElementSource cannot attach
      }
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = audioBoost;
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    }
  }, [audioBoost, useSafeProxy, setUseSafeProxy]);

  // Pick stream
  useEffect(() => {
    setAutoNextCountdown(null);
    if (initialStream) {
      setActiveStream(initialStream);
    } else if (sourceGroups.length > 0 && sourceGroups[0].streams.length > 0) {
      setActiveStream(sourceGroups[0].streams[0]);
    }
  }, [initialStream, sourceGroups, setActiveStream]);

  // Stream loader (preserves playback position when switching quality or voiceover on same episode)
  const lastEpisodeRef = useRef<number | undefined>(undefined);
  const pendingResumeTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!videoRef.current || !activeStream) return;

    const resumeTime =
      lastEpisodeRef.current !== undefined &&
      lastEpisodeRef.current === activeStream.episode &&
      videoRef.current.currentTime > 2
        ? videoRef.current.currentTime
        : 0;
    lastEpisodeRef.current = activeStream.episode;
    pendingResumeTimeRef.current = resumeTime;

    reset();
    setIsBuffering(true);

    if (activeStream.audioTracks) {
      setAvailableAudioTracks(activeStream.audioTracks);
      const defaultTrack =
        activeStream.audioTracks.find((t) => t.isDefault) || activeStream.audioTracks[0];
      if (defaultTrack) setActiveAudioTrackId(defaultTrack.id);
    }

    if (activeStream.subtitles) {
      setAvailableSubtitles(activeStream.subtitles);
    }

    const engine = new HlsEngine();
    hlsEngineRef.current = engine;

    engine.init(
      videoRef.current,
      activeStream.streamUrl,
      {
        onQualitiesLoaded: (qualities) => {
          setAvailableQualities(qualities);
          if (videoRef.current) {
            const st = usePlayerStore.getState();
            videoRef.current.volume = st.isMuted ? 0 : st.volume;
            videoRef.current.muted = st.isMuted;
            videoRef.current.playbackRate = st.playbackRate;
            if (resumeTime > 0) {
              videoRef.current.currentTime = resumeTime;
            }
          }
        },
        onAudioTracksLoaded: (tracks) => setAvailableAudioTracks(tracks),
        onBuffering: (buffering) => setIsBuffering(buffering),
        onError: (err) => setError(err),
        onProxyModeChange: (proxied) => setIsUsingProxy(proxied),
      },
      useSafeProxy
    );

    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
        });
    }

    return () => {
      engine.destroy();
    };
  }, [
    activeStream,
    useSafeProxy,
    reset,
    setIsBuffering,
    setIsPlaying,
    setIsUsingProxy,
    setAvailableQualities,
    setAvailableAudioTracks,
    setActiveAudioTrackId,
    setAvailableSubtitles,
    setError,
  ]);

  // Auto-Next Episode Countdown Timer
  useEffect(() => {
    if (autoNextCountdown === null) return;
    if (autoNextCountdown <= 0) {
      setAutoNextCountdown(null);
      if (hasNextEpisode && onNextEpisode) {
        onNextEpisode();
        showOsd('⏭️ Включаем следующую серию');
      }
      return;
    }
    const timer = setTimeout(() => {
      setAutoNextCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoNextCountdown, hasNextEpisode, onNextEpisode, showOsd]);

  // Video event listeners
  const onTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.buffered.length > 0) {
        setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
      }
    }
  };

  const onLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.muted = isMuted;
      videoRef.current.playbackRate = playbackRate;
      if (pendingResumeTimeRef.current > 0) {
        videoRef.current.currentTime = pendingResumeTimeRef.current;
        pendingResumeTimeRef.current = 0;
      }
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (hasNextEpisode && onNextEpisode && autoPlayNext) {
      setAutoNextCountdown(5);
    }
  };

  // Cursor & Controls Auto-hide
  const showControlsTemporarily = useCallback(() => {
    setIsControlsVisible(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying && !isAudioSubsModalOpen && !isSourceModalOpen && !showEpisodesDrawer) {
        setIsControlsVisible(false);
      }
    }, 3500);
  }, [
    isPlaying,
    isAudioSubsModalOpen,
    isSourceModalOpen,
    showEpisodesDrawer,
    setIsControlsVisible,
  ]);

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      flashCenterIcon('play');
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      flashCenterIcon('pause');
    }
  };

  const handleSkip = (seconds: number) => {
    if (videoRef.current) {
      const maxDur =
        Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0
          ? videoRef.current.duration
          : videoRef.current.currentTime + Math.abs(seconds);
      const nextTime = Math.max(0, Math.min(maxDur, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      showOsd(seconds > 0 ? `⏩ +${seconds} сек` : `⏪ ${seconds} сек`);
    }
  };

  // Mouse wheel volume adjustment
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isAudioSubsModalOpen || isSourceModalOpen || showEpisodesDrawer) return;
    showControlsTemporarily();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const currentEffective = isMuted ? 0 : volume;
    const nextVol = Math.max(0, Math.min(1, Math.round((currentEffective + delta) * 100) / 100));
    setVolume(nextVol);
    if (videoRef.current) {
      videoRef.current.muted = nextVol === 0;
      videoRef.current.volume = nextVol;
    }
    showOsd(
      nextVol === 0
        ? '🔇 Без звука (0%)'
        : `${delta > 0 ? '🔊' : '🔉'} Громкость: ${Math.round(nextVol * 100)}%`
    );
  };

  const activeSeasonObj =
    seasons.find((s) => s.seasonNumber === (seasonNumber || 1)) || seasons[0];
  const episodeCount =
    activeSeasonObj?.episodes?.length || activeSeasonObj?.episodeCount || 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={showControlsTemporarily}
      onClick={showControlsTemporarily}
      onWheel={handleWheel}
      className={`relative w-screen h-screen bg-black overflow-hidden select-none ${
        !isControlsVisible && isPlaying ? 'cursor-none' : 'cursor-default'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={handleVideoEnded}
      />

      {/* Center Play / Pause Icon Indicator */}
      {centerActionIcon && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-40">
          <div className="w-20 h-20 rounded-full bg-black/65 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-2xl animate-scaleIn">
            {centerActionIcon === 'play' ? (
              <Play className="w-9 h-9 ml-1 fill-white text-white" />
            ) : (
              <Pause className="w-9 h-9 fill-white text-white" />
            )}
          </div>
        </div>
      )}

      {/* On-Screen Display (OSD) Feedback Pill for Volume / Seek / Fullscreen */}
      {osdMessage && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-2xl bg-black/80 border border-white/20 text-white text-sm font-bold shadow-2xl backdrop-blur-md animate-fadeIn">
          {osdMessage}
        </div>
      )}

      {/* Auto-Next Episode Countdown Card */}
      {autoNextCountdown !== null && hasNextEpisode && onNextEpisode && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-28 right-6 z-40 w-80 bg-cinema-surface/95 border border-brand-main/60 rounded-2xl p-4 text-white shadow-2xl backdrop-blur-xl space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-light">
              Автопереключение серии
            </span>
            <button
              type="button"
              onClick={() => setAutoNextCountdown(null)}
              className="text-cinema-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm font-bold text-white">
            {nextEpisodeLabel || 'Следующая серия'} начнётся через{' '}
            <span className="text-brand-light text-base">{autoNextCountdown}</span> сек.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAutoNextCountdown(null);
                onNextEpisode();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-main hover:bg-brand-light text-white text-xs font-bold shadow-brand-glow transition-all"
            >
              <SkipForward className="w-4 h-4" />
              <span>Включить сейчас</span>
            </button>
            <button
              type="button"
              onClick={() => setAutoNextCountdown(null)}
              className="px-3 py-2 rounded-xl bg-cinema-card hover:bg-cinema-border text-xs font-semibold text-cinema-muted hover:text-white transition-all"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-40 p-6 text-center"
        >
          <p className="text-xl font-bold text-red-400 mb-2">Ошибка воспроизведения потока</p>
          <p className="text-slate-300 mb-6 max-w-md text-sm">
            {error}. Если браузер Microsoft Edge блокирует прямой CDN, включите безопасный
            HTTPS-прокси или выберите другую студию озвучки.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setUseSafeProxy(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all text-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Включить безопасный поток (для Edge)</span>
            </button>
            <button
              type="button"
              onClick={() => openSourceModal(true)}
              className="px-5 py-2.5 bg-brand-main hover:bg-brand-light font-semibold rounded-xl shadow-brand-glow transition-all text-sm"
            >
              Выбрать другую озвучку
            </button>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`transition-opacity duration-300 ${
          isControlsVisible ||
          isAudioSubsModalOpen ||
          isSourceModalOpen ||
          isQualityModalOpen ||
          showEpisodesDrawer
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <PlayerControls
          title={title}
          subtitle={subtitle}
          onBack={() => router.back()}
          onSeek={handleSeek}
          onTogglePlay={handleTogglePlay}
          onSkip={handleSkip}
          onToggleFullscreen={handleToggleFullscreen}
          hasPrevEpisode={hasPrevEpisode}
          hasNextEpisode={hasNextEpisode}
          onPrevEpisode={onPrevEpisode}
          onNextEpisode={onNextEpisode}
          episodeCount={episodeCount}
          showEpisodesDrawer={showEpisodesDrawer}
          onToggleEpisodesDrawer={() => setShowEpisodesDrawer((v) => !v)}
        />
      </div>

      {/* In-Player Episodes Drawer (works inside Fullscreen too!) */}
      {showEpisodesDrawer && seasons.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-24 left-4 right-4 z-40 p-5 bg-cinema-surface/95 border border-cinema-border rounded-2xl max-h-72 overflow-y-auto shadow-2xl backdrop-blur-xl animate-fadeIn"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Выбор серии ({episodeCount})
            </h3>
            <button
              type="button"
              onClick={() => setShowEpisodesDrawer(false)}
              className="p-1.5 rounded-lg bg-cinema-card hover:bg-cinema-border text-cinema-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <EpisodePicker
            seasons={seasons}
            activeSeason={seasonNumber || 1}
            activeEpisode={episodeNumber || 1}
            onSelectSeason={(s) => onSelectSeason?.(s)}
            onSelectEpisode={(s, ep) => {
              onSelectEpisode?.(s, ep);
              setShowEpisodesDrawer(false);
            }}
          />
        </div>
      )}

      {/* Audio, Boost, Speed & Subtitle Modal */}
      <TrackSelectorModal
        isOpen={isAudioSubsModalOpen}
        onClose={() => openAudioSubsModal(false)}
        onSelectAudio={(id) => {
          setActiveAudioTrackId(id);
          hlsEngineRef.current?.setAudioTrack(id);
        }}
        onSelectSubtitle={(id) => setActiveSubtitleId(id)}
      />

      {/* Separate Voiceover Selector Modal */}
      <SourceSelectorModal
        isOpen={isSourceModalOpen}
        onClose={() => openSourceModal(false)}
        sourceGroups={sourceGroups}
        activeStream={activeStream}
        onSelectStream={(stream) => {
          setActiveStream(stream);
          setActiveQuality(stream.quality);
          showOsd(`🎙️ ${stream.providerName}`);
        }}
      />

      {/* Separate Quality Selector Modal */}
      <QualitySelectorModal
        isOpen={isQualityModalOpen}
        onClose={() => openQualityModal(false)}
        sourceGroups={sourceGroups}
        activeStream={activeStream}
        activeQuality={activeQuality}
        onSelectStreamQuality={(stream, quality, height) => {
          setActiveQuality(quality);
          if (stream.id !== activeStream?.id) {
            setActiveStream(stream);
          } else {
            hlsEngineRef.current?.setQuality(height);
          }
          showOsd(`✨ Качество: ${quality}`);
        }}
      />
    </div>
  );
}

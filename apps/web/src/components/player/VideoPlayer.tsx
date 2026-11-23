'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, SkipForward, ShieldCheck, X, ExternalLink, Copy, Smartphone } from 'lucide-react';
import { HlsEngine, isIosDevice, isAndroidDevice, toHttpsUrl } from '../../lib/hls-engine';
import {
  EpisodeSkipSegments,
  SkipInterval,
  fetchAniSkipTimestamps,
  resolveMalId,
} from '../../lib/aniskip';
import { PlayerControls } from './PlayerControls';
import { TrackSelectorModal } from './TrackSelectorModal';
import { SourceSelectorModal, QualitySelectorModal } from './SourceSelectorModal';
import { EpisodePicker } from '../media/EpisodePicker';
import { usePlayerStore } from '../../stores/player.store';
import { useLibraryStore } from '../../stores/library.store';
import { usePlayerHotkeys } from '../../hooks/use-hotkeys';
import { usePlayerSync } from '../../hooks/use-player-sync';
import { Season, StreamSourceGroup, VideoStream } from '@cinemaflow/types';

interface VideoPlayerProps {
  mediaId: string;
  title: string;
  subtitle?: string;
  posterPath?: string | null;
  mediaType?: 'movie' | 'tv';
  isAnime?: boolean;
  malId?: number;
  originalTitle?: string;
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
  posterPath,
  mediaType,
  isAnime = false,
  malId,
  originalTitle,
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
  const [isExternalPlayerModalOpen, setIsExternalPlayerModalOpen] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [failedVoiceKeys, setFailedVoiceKeys] = useState<string[]>([]);
  const [skipSegments, setSkipSegments] = useState<EpisodeSkipSegments>({ op: null, ed: null });
  const autoTriggeredSkipRef = useRef<Set<string>>(new Set());
  const lastHistorySavedRef = useRef<{ time: number; ep?: number; season?: number }>({ time: 0 });

  // Zustand Store
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const audioBoost = usePlayerStore((s) => s.audioBoost);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const autoPlayNext = usePlayerStore((s) => s.autoPlayNext);
  const autoSkipIntro = usePlayerStore((s) => s.autoSkipIntro);
  const autoSkipOutro = usePlayerStore((s) => s.autoSkipOutro);
  const showManualSkipButtons = usePlayerStore((s) => s.showManualSkipButtons);
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

  const lockLandscapeOrientation = useCallback(async () => {
    try {
      const orientation = (window.screen as any)?.orientation;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
      }
    } catch {
      // Orientation lock is unsupported or disallowed by browser (e.g. iOS Safari / desktop)
    }
  }, []);

  const unlockOrientation = useCallback(() => {
    try {
      const orientation = (window.screen as any)?.orientation;
      if (orientation && typeof orientation.unlock === 'function') {
        orientation.unlock();
      }
    } catch {
      // Ignore unlock errors
    }
  }, []);

  // Fullscreen handler (targets player container so overlays, episodes, and controls stay visible)
  const handleToggleFullscreen = useCallback(async () => {
    try {
      const doc = document as any;
      const isFs = Boolean(
        doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement
      );
      if (!isFs) {
        const container = containerRef.current as any;
        const video = videoRef.current as any;
        if (container?.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container?.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (container?.msRequestFullscreen) {
          container.msRequestFullscreen();
        } else if (video?.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        }
        setIsFullscreen(true);
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          await lockLandscapeOrientation();
        }
        showOsd('⛶ Полноэкранный режим');
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
        unlockOrientation();
        setIsFullscreen(false);
        showOsd('⛶ Обычный режим');
      }
    } catch {
      // ignore fullscreen permission errors
    }
  }, [lockLandscapeOrientation, unlockOrientation, setIsFullscreen, showOsd]);

  // Keep fullscreen state synced with browser fullscreenchange & iOS webkitbeginfullscreen/webkitendfullscreen
  useEffect(() => {
    const onFsChange = () => {
      const doc = document as any;
      const fsActive = Boolean(
        doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement
      );
      setIsFullscreen(fsActive);
      if (!fsActive) {
        unlockOrientation();
      }
    };
    const onIosBeginFs = () => setIsFullscreen(true);
    const onIosEndFs = () => {
      setIsFullscreen(false);
      unlockOrientation();
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    const videoEl = videoRef.current;
    videoEl?.addEventListener('webkitbeginfullscreen', onIosBeginFs);
    videoEl?.addEventListener('webkitendfullscreen', onIosEndFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      videoEl?.removeEventListener('webkitbeginfullscreen', onIosBeginFs);
      videoEl?.removeEventListener('webkitendfullscreen', onIosEndFs);
      unlockOrientation();
    };
  }, [setIsFullscreen, unlockOrientation]);

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
    setFailedVoiceKeys([]);
    if (initialStream) {
      setActiveStream(initialStream);
    } else if (sourceGroups.length > 0 && sourceGroups[0].streams.length > 0) {
      setActiveStream(sourceGroups[0].streams[0]);
    }
  }, [initialStream, sourceGroups, setActiveStream]);

  const workingSourceGroups = React.useMemo(
    () =>
      sourceGroups.filter(
        (g) =>
          g.streams.length > 0 &&
          !failedVoiceKeys.includes(`${g.providerId}:${g.voiceActing || g.providerName}`)
      ),
    [sourceGroups, failedVoiceKeys]
  );

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
        onError: (err) => {
          const failedKey = `${activeStream.providerId}:${
            activeStream.voiceActing || activeStream.providerName
          }`;
          setFailedVoiceKeys((prev) =>
            prev.includes(failedKey) ? prev : [...prev, failedKey]
          );
          const nextGroup = sourceGroups.find(
            (g) =>
              g.streams.length > 0 &&
              `${g.providerId}:${g.voiceActing || g.providerName}` !== failedKey &&
              !failedVoiceKeys.includes(
                `${g.providerId}:${g.voiceActing || g.providerName}`
              )
          );
          if (nextGroup && nextGroup.streams[0]) {
            setActiveStream(nextGroup.streams[0]);
          } else {
            setError(err);
          }
        },
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

  // Load AniSkip OP/ED timestamps per anime episode
  useEffect(() => {
    setSkipSegments({ op: null, ed: null });
    autoTriggeredSkipRef.current.clear();

    const effectiveEpisode = episodeNumber || activeStream?.episode || 1;
    const looksLikeAnime =
      isAnime ||
      Boolean(malId) ||
      /^al-\d+$/i.test(mediaId) ||
      /^mal-\d+$/i.test(mediaId) ||
      activeStream?.providerId === 'aniliberty';

    if (!looksLikeAnime || !effectiveEpisode) return;

    let cancelled = false;
    (async () => {
      const resolvedMalId = await resolveMalId({
        malId,
        title,
        originalTitle,
      });
      if (cancelled || !resolvedMalId) return;

      const segments = await fetchAniSkipTimestamps(resolvedMalId, effectiveEpisode);
      if (!cancelled) {
        setSkipSegments(segments);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAnime, malId, mediaId, title, originalTitle, episodeNumber, activeStream?.episode, activeStream?.providerId]);

  // Active OP/ED segment based on real video currentTime
  const activeSkipSegment: SkipInterval | null =
    skipSegments.op &&
    currentTime >= skipSegments.op.startTime &&
    currentTime < skipSegments.op.endTime - 0.5
      ? skipSegments.op
      : skipSegments.ed &&
        currentTime >= skipSegments.ed.startTime &&
        currentTime < skipSegments.ed.endTime - 0.5
      ? skipSegments.ed
      : null;

  const handleSkipSegment = useCallback(
    (segment: SkipInterval) => {
      if (!videoRef.current) return;
      const targetTime = Math.min(
        Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0
          ? videoRef.current.duration
          : segment.endTime,
        segment.endTime
      );
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      autoTriggeredSkipRef.current.add(segment.skipId);
      showOsd(segment.skipType === 'op' ? '⏭️ Опенинг пропущен' : '⏭️ Эндинг пропущен');
    },
    [setCurrentTime, showOsd]
  );

  // Record to local watch history ONLY when user actually plays video (>= 3s) and track stopped episode
  useEffect(() => {
    if (!mediaId || !title || duration <= 0 || currentTime < 3) return;
    const ep = episodeNumber || activeStream?.episode;
    const season = seasonNumber || activeStream?.season;
    const prev = lastHistorySavedRef.current;
    const episodeChanged = prev.ep !== ep || prev.season !== season;

    if (!episodeChanged && isPlaying && Math.abs(currentTime - prev.time) < 8) {
      return;
    }

    lastHistorySavedRef.current = { time: currentTime, ep, season };
    useLibraryStore.getState().addToHistory({
      id: mediaId,
      routeId: mediaId,
      type: mediaType || (ep ? 'tv' : 'movie'),
      title,
      posterPath: posterPath || null,
      seasonNumber: season,
      episodeNumber: ep,
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
    });
  }, [
    mediaId,
    title,
    posterPath,
    mediaType,
    seasonNumber,
    episodeNumber,
    activeStream?.episode,
    activeStream?.season,
    currentTime,
    duration,
    isPlaying,
  ]);

  // Auto-Skip OP / ED when enabled in settings (once per segment per episode)
  useEffect(() => {
    if (!activeSkipSegment || !videoRef.current) return;
    const shouldAuto =
      (activeSkipSegment.skipType === 'op' && autoSkipIntro) ||
      (activeSkipSegment.skipType === 'ed' && autoSkipOutro);
    if (!shouldAuto) return;
    if (autoTriggeredSkipRef.current.has(activeSkipSegment.skipId)) return;

    handleSkipSegment(activeSkipSegment);
  }, [activeSkipSegment, autoSkipIntro, autoSkipOutro, handleSkipSegment]);

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

  const handleCenterAreaClick = () => {
    const isTouchDevice =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
    if (isTouchDevice) {
      if (isControlsVisible && isPlaying) {
        setIsControlsVisible(false);
      } else {
        showControlsTemporarily();
      }
      return;
    }
    handleTogglePlay();
  };

  const getAbsoluteStreamUrl = useCallback(() => {
    if (!activeStream?.streamUrl) return '';
    const raw = activeStream.streamUrl.trim();
    if (raw.startsWith('/')) {
      return typeof window !== 'undefined' ? `${window.location.origin}${raw}` : raw;
    }
    return toHttpsUrl(raw);
  }, [activeStream]);

  const handleOpenAppleNativePlayer = () => {
    const video = videoRef.current as any;
    if (video) {
      video.play?.().catch(() => {});
      if (typeof video.webkitEnterFullscreen === 'function') {
        try {
          video.webkitEnterFullscreen();
          setIsExternalPlayerModalOpen(false);
          return;
        } catch {
          // fallback below
        }
      }
    }
    const url = getAbsoluteStreamUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setIsExternalPlayerModalOpen(false);
  };

  const handleOpenAndroidChooser = () => {
    const url = getAbsoluteStreamUrl();
    if (!url) return;
    const withoutScheme = url.replace(/^https?:\/\//i, '');
    const scheme = url.startsWith('http://') ? 'http' : 'https';
    const intentUrl = `intent://${withoutScheme}#Intent;scheme=${scheme};type=video/*;action=android.intent.action.VIEW;S.title=${encodeURIComponent(
      title
    )};end`;
    window.location.href = intentUrl;
    setIsExternalPlayerModalOpen(false);
  };

  const handleOpenVlcPlayer = () => {
    const url = getAbsoluteStreamUrl();
    if (!url) return;
    if (isIosDevice()) {
      window.location.href = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`;
    } else if (isAndroidDevice()) {
      const withoutScheme = url.replace(/^https?:\/\//i, '');
      const scheme = url.startsWith('http://') ? 'http' : 'https';
      window.location.href = `intent://${withoutScheme}#Intent;scheme=${scheme};package=org.videolan.vlc;type=video/*;S.title=${encodeURIComponent(
        title
      )};end`;
    } else {
      window.location.href = `vlc://${url}`;
    }
    setIsExternalPlayerModalOpen(false);
  };

  const handleCopyStreamUrl = async () => {
    const url = getAbsoluteStreamUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showOsd('🔗 Ссылка на поток скопирована');
    } catch {
      showOsd('⚠️ Не удалось скопировать ссылку');
    }
    setIsExternalPlayerModalOpen(false);
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
      className={`fixed inset-0 w-full h-[100dvh] bg-black overflow-hidden select-none ${
        !isControlsVisible && isPlaying ? 'cursor-none' : 'cursor-default'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        x-webkit-airplay="allow"
        crossOrigin={audioBoost > 1 ? 'anonymous' : undefined}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
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

      {/* AniSkip OP / ED Manual Skip Button (Bottom-Right, Netflix-style, Android TV & Mobile friendly) */}
      {showManualSkipButtons && activeSkipSegment && autoNextCountdown === null && !error && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-24 sm:bottom-28 right-4 sm:right-6 z-40 animate-fadeIn"
        >
          <button
            type="button"
            tabIndex={0}
            data-nav-item="true"
            onClick={(e) => {
              e.stopPropagation();
              handleSkipSegment(activeSkipSegment);
            }}
            className="flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-[#111119]/90 hover:bg-brand-main border border-brand-main/70 text-white text-xs sm:text-sm font-bold shadow-2xl backdrop-blur-xl transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-light"
          >
            <SkipForward className="w-4 h-4 text-brand-light shrink-0" />
            <span>
              {activeSkipSegment.skipType === 'op'
                ? 'Пропустить опенинг'
                : 'Пропустить эндинг'}
            </span>
          </button>
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
            <button
              type="button"
              onClick={() => setIsExternalPlayerModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 font-semibold rounded-xl transition-all text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Открыть во внешнем плеере</span>
            </button>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`transition-opacity duration-300 ${
          isControlsVisible ||
          !isPlaying ||
          isAudioSubsModalOpen ||
          isSourceModalOpen ||
          isQualityModalOpen ||
          isExternalPlayerModalOpen ||
          showEpisodesDrawer
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <PlayerControls
          title={title}
          subtitle={subtitle}
          onBack={async () => {
            try {
              const doc = document as any;
              if (doc.fullscreenElement && doc.exitFullscreen) {
                await doc.exitFullscreen();
              } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
                doc.webkitExitFullscreen();
              }
            } catch {}
            unlockOrientation();
            router.back();
          }}
          onSeek={handleSeek}
          onTogglePlay={handleTogglePlay}
          onSkip={handleSkip}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenExternalPlayer={() => setIsExternalPlayerModalOpen(true)}
          onCenterAreaClick={handleCenterAreaClick}
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

      {/* Separate Voiceover Selector Modal (only shows working voiceovers) */}
      <SourceSelectorModal
        isOpen={isSourceModalOpen}
        onClose={() => openSourceModal(false)}
        sourceGroups={workingSourceGroups}
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
        sourceGroups={workingSourceGroups}
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

      {/* External Player Picker Modal (Apple AVPlayer / Android Intent / VLC / Direct Link) */}
      {isExternalPlayerModalOpen && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsExternalPlayerModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-cinema-surface border border-cinema-border rounded-2xl p-5 text-white shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-brand-light" />
                <h3 className="text-base font-bold">Внешний плеер</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExternalPlayerModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Если встроенный плеер тормозит на телефоне, откройте серию через системный или сторонний плеер:
            </p>

            <div className="space-y-2 pt-1">
              {(isIosDevice() || (typeof (videoRef.current as any)?.webkitEnterFullscreen === 'function')) && (
                <button
                  type="button"
                  onClick={handleOpenAppleNativePlayer}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-brand-main hover:bg-brand-light text-white font-semibold text-sm shadow-brand-glow transition-all"
                >
                  <span>Плеер Apple (iOS / AirPlay)</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}

              {isAndroidDevice() && (
                <button
                  type="button"
                  onClick={handleOpenAndroidChooser}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-brand-main hover:bg-brand-light text-white font-semibold text-sm shadow-brand-glow transition-all"
                >
                  <span>Выбрать плеер Android (MX / системный)</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenVlcPlayer}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold text-sm transition-all"
              >
                <span>Открыть в VLC Media Player</span>
                <ExternalLink className="w-4 h-4 text-orange-400" />
              </button>

              <button
                type="button"
                onClick={handleCopyStreamUrl}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-medium text-sm transition-all"
              >
                <span>Скопировать прямую ссылку (.m3u8 / .mp4)</span>
                <Copy className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

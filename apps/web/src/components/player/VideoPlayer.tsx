'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { HlsEngine } from '../../lib/hls-engine';
import { PlayerControls } from './PlayerControls';
import { TrackSelectorModal } from './TrackSelectorModal';
import { SourceSelectorModal } from './SourceSelectorModal';
import { usePlayerStore } from '../../stores/player.store';
import { usePlayerHotkeys } from '../../hooks/use-hotkeys';
import { usePlayerSync } from '../../hooks/use-player-sync';
import { useSpatialNav } from '../../hooks/use-spatial-nav';
import { StreamSourceGroup, VideoStream } from '@cinemaflow/types';

interface VideoPlayerProps {
  mediaId: string;
  title: string;
  subtitle?: string;
  sourceGroups: StreamSourceGroup[];
  initialStream?: VideoStream;
  seasonNumber?: number;
  episodeNumber?: number;
}

export function VideoPlayer({
  mediaId,
  title,
  subtitle,
  sourceGroups,
  initialStream,
  seasonNumber,
  episodeNumber,
}: VideoPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsEngineRef = useRef<HlsEngine | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Zustand Store
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const activeStream = usePlayerStore((s) => s.activeStream);
  const isControlsVisible = usePlayerStore((s) => s.isControlsVisible);
  const isAudioSubsModalOpen = usePlayerStore((s) => s.isAudioSubsModalOpen);
  const isSourceModalOpen = usePlayerStore((s) => s.isSourceModalOpen);
  const error = usePlayerStore((s) => s.error);

  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setIsBuffering = usePlayerStore((s) => s.setIsBuffering);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setBufferedEnd = usePlayerStore((s) => s.setBufferedEnd);
  const setIsControlsVisible = usePlayerStore((s) => s.setIsControlsVisible);
  const setActiveStream = usePlayerStore((s) => s.setActiveStream);
  const setAvailableQualities = usePlayerStore((s) => s.setAvailableQualities);
  const setAvailableAudioTracks = usePlayerStore((s) => s.setAvailableAudioTracks);
  const setActiveAudioTrackId = usePlayerStore((s) => s.setActiveAudioTrackId);
  const setAvailableSubtitles = usePlayerStore((s) => s.setAvailableSubtitles);
  const setActiveSubtitleId = usePlayerStore((s) => s.setActiveSubtitleId);
  const openAudioSubsModal = usePlayerStore((s) => s.openAudioSubsModal);
  const openSourceModal = usePlayerStore((s) => s.openSourceModal);
  const setError = usePlayerStore((s) => s.setError);
  const reset = usePlayerStore((s) => s.reset);

  // Keyboard hotkeys
  usePlayerHotkeys(videoRef);

  // Smart TV spatial navigation
  useSpatialNav({ itemSelector: '[data-nav-item="true"]' });

  // History sync
  usePlayerSync({
    mediaId,
    seasonNumber,
    episodeNumber,
    currentTime,
    duration,
    isPlaying,
  });

  // Pick stream
  useEffect(() => {
    if (initialStream) {
      setActiveStream(initialStream);
    } else if (sourceGroups.length > 0 && sourceGroups[0].streams.length > 0) {
      setActiveStream(sourceGroups[0].streams[0]);
    }
  }, [initialStream, sourceGroups, setActiveStream]);

  // Stream loader
  useEffect(() => {
    if (!videoRef.current || !activeStream) return;

    reset();
    setIsBuffering(true);

    if (activeStream.audioTracks) {
      setAvailableAudioTracks(activeStream.audioTracks);
      const defaultTrack = activeStream.audioTracks.find((t) => t.isDefault) || activeStream.audioTracks[0];
      if (defaultTrack) setActiveAudioTrackId(defaultTrack.id);
    }

    if (activeStream.subtitles) {
      setAvailableSubtitles(activeStream.subtitles);
    }

    const engine = new HlsEngine();
    hlsEngineRef.current = engine;

    engine.init(videoRef.current, activeStream.streamUrl, {
      onQualitiesLoaded: (qualities) => setAvailableQualities(qualities),
      onAudioTracksLoaded: (tracks) => setAvailableAudioTracks(tracks),
      onBuffering: (buffering) => setIsBuffering(buffering),
      onError: (err) => setError(err),
    });

    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay policy prevented playback, wait for user gesture
          setIsPlaying(false);
        });
    }

    return () => {
      engine.destroy();
    };
  }, [
    activeStream,
    reset,
    setIsBuffering,
    setIsPlaying,
    setAvailableQualities,
    setAvailableAudioTracks,
    setActiveAudioTrackId,
    setAvailableSubtitles,
    setError,
  ]);

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
    }
  };

  // Cursor & Controls Auto-hide
  const showControlsTemporarily = useCallback(() => {
    setIsControlsVisible(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying && !isAudioSubsModalOpen && !isSourceModalOpen) {
        setIsControlsVisible(false);
      }
    }, 3500);
  }, [isPlaying, isAudioSubsModalOpen, isSourceModalOpen, setIsControlsVisible]);

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSkip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(
        0,
        Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds)
      );
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={showControlsTemporarily}
      onClick={showControlsTemporarily}
      className={`relative w-screen h-screen bg-black overflow-hidden select-none ${
        !isControlsVisible && isPlaying ? 'cursor-none' : 'cursor-default'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-40 p-6 text-center">
          <p className="text-xl font-bold text-red-500 mb-2">Ошибка воспроизведения</p>
          <p className="text-slate-300 mb-6">{error}</p>
          <button
            onClick={() => openSourceModal(true)}
            data-nav-item="true"
            className="px-6 py-2.5 bg-cinema-accent hover:bg-red-700 font-semibold rounded-lg shadow-cinema-glow transition-all"
          >
            Выбрать другой источник
          </button>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`transition-opacity duration-300 ${
          isControlsVisible || isAudioSubsModalOpen || isSourceModalOpen
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
        />
      </div>

      {/* Audio & Subtitle Modal */}
      <TrackSelectorModal
        isOpen={isAudioSubsModalOpen}
        onClose={() => openAudioSubsModal(false)}
        onSelectAudio={(id) => {
          setActiveAudioTrackId(id);
          hlsEngineRef.current?.setAudioTrack(id);
        }}
        onSelectSubtitle={(id) => setActiveSubtitleId(id)}
      />

      {/* Source & Scraper Modal */}
      <SourceSelectorModal
        isOpen={isSourceModalOpen}
        onClose={() => openSourceModal(false)}
        sourceGroups={sourceGroups}
        activeStream={activeStream}
        onSelectStream={(stream) => setActiveStream(stream)}
      />
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Sliders,
  Mic,
  Sparkles,
  ArrowLeft,
  ListVideo,
  FastForward,
} from 'lucide-react';
import { TimelineScrubber } from './TimelineScrubber';
import { usePlayerStore } from '../../stores/player.store';

interface PlayerControlsProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onSkip: (seconds: number) => void;
  onToggleFullscreen: () => void;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  episodeCount?: number;
  showEpisodesDrawer?: boolean;
  onToggleEpisodesDrawer?: () => void;
}

export function PlayerControls({
  title,
  subtitle,
  onBack,
  onSeek,
  onTogglePlay,
  onSkip,
  onToggleFullscreen,
  hasPrevEpisode = false,
  hasNextEpisode = false,
  onPrevEpisode,
  onNextEpisode,
  episodeCount = 0,
  showEpisodesDrawer = false,
  onToggleEpisodesDrawer,
}: PlayerControlsProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const bufferedEnd = usePlayerStore((s) => s.bufferedEnd);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const activeStream = usePlayerStore((s) => s.activeStream);
  const activeQuality = usePlayerStore((s) => s.activeQuality);
  const autoPlayNext = usePlayerStore((s) => s.autoPlayNext);
  const setAutoPlayNext = usePlayerStore((s) => s.setAutoPlayNext);
  const showOsd = usePlayerStore((s) => s.showOsd);
  const openAudioSubsModal = usePlayerStore((s) => s.openAudioSubsModal);
  const openSourceModal = usePlayerStore((s) => s.openSourceModal);
  const openQualityModal = usePlayerStore((s) => s.openQualityModal);

  const [isVolumeHovered, setIsVolumeHovered] = useState(false);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const effectiveVol = isMuted ? 0 : volume;
  const showEpisodeButtons = hasPrevEpisode || hasNextEpisode || episodeCount > 1;
  const currentQualityLabel =
    activeStream?.quality ||
    (activeQuality && activeQuality !== 'auto' ? activeQuality : '1080p');

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-0 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-t from-cinema-dark/95 via-cinema-dark/15 to-cinema-dark/80 pointer-events-auto transition-opacity duration-300"
    >
      {/* Top Header (Minimalist: only Back icon + Title/Subtitle) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад"
            title="Назад"
            className="p-2.5 text-white/85 hover:text-white bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-white drop-shadow-md truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-white/70 drop-shadow truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Center Click Area (Play/Pause on click, Fullscreen on double click) */}
      <div
        onClick={onTogglePlay}
        onDoubleClick={onToggleFullscreen}
        className="flex-1 w-full flex items-center justify-center cursor-pointer"
      >
        {isBuffering && (
          <div className="w-14 h-14 border-4 border-brand-main border-t-transparent rounded-full animate-spin shadow-brand-glow pointer-events-none" />
        )}
      </div>

      {/* Bottom Controls (Minimalist Icon-Only Bar) */}
      <div className="space-y-3">
        {/* Scrubber */}
        <TimelineScrubber
          currentTime={currentTime}
          duration={duration}
          bufferedEnd={bufferedEnd}
          onSeek={onSeek}
        />

        {/* Icon Buttons Row */}
        <div className="flex items-center justify-between gap-2 text-white">
          {/* Left Controls: [Prev Ep] [Rewind -10s] [Play/Pause] [Forward +10s] [Next Ep] [Hover Volume] [Time] */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* 1. Previous Episode */}
            {showEpisodeButtons && (
              <button
                type="button"
                onClick={onPrevEpisode}
                disabled={!hasPrevEpisode}
                aria-label="Предыдущая серия"
                title="Предыдущая серия (P или Shift + ←)"
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <SkipBack className="w-5 h-5" />
              </button>
            )}

            {/* 2. Rewind 10s (Left of Play/Pause) */}
            <button
              type="button"
              onClick={() => onSkip(-10)}
              aria-label="Перемотать назад 10 секунд"
              title="Назад 10 сек (←)"
              className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* 3. Play / Pause (Center of transport buttons) */}
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
              title={isPlaying ? 'Пауза (Space)' : 'Воспроизведение (Space)'}
              className="p-3 text-white bg-brand-main hover:bg-brand-light rounded-full shadow-brand-glow transition-all transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5 fill-white" />
              )}
            </button>

            {/* 4. Forward 10s (Right of Play/Pause) */}
            <button
              type="button"
              onClick={() => onSkip(10)}
              aria-label="Перемотать вперед 10 секунд"
              title="Вперёд 10 сек (→)"
              className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* 5. Next Episode */}
            {showEpisodeButtons && (
              <button
                type="button"
                onClick={onNextEpisode}
                disabled={!hasNextEpisode}
                aria-label="Следующая серия"
                title="Следующая серия (N или Shift + →)"
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            )}

            {/* 6. Minimalist Volume (Speaker icon + hidden slider expanding on hover, no percentages) */}
            <div
              className="flex items-center"
              onMouseEnter={() => setIsVolumeHovered(true)}
              onMouseLeave={() => setIsVolumeHovered(false)}
            >
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
                title="Звук (M / Колёсико мыши / ↑↓)"
                className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 flex items-center ${
                  isVolumeHovered ? 'w-20 ml-1.5 opacity-100' : 'w-0 ml-0 opacity-0'
                }`}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  aria-label="Громкость"
                  value={effectiveVol}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-white/25 rounded-lg appearance-none cursor-pointer accent-brand-main"
                />
              </div>
            </div>

            {/* 7. Minimalist Timestamps */}
            <div className="text-xs font-medium text-white/65 font-mono tracking-tight pl-1">
              <span className="text-white/95">{formatTime(currentTime)}</span>
              <span className="mx-1 text-white/40">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls: Icon-Only [Auto-Next] [Episodes] [Voiceover] [Quality] [Audio Settings] [Fullscreen] */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Auto-Next Episode Icon Toggle */}
            {showEpisodeButtons && (
              <button
                type="button"
                onClick={() => {
                  const nextState = !autoPlayNext;
                  setAutoPlayNext(nextState);
                  showOsd(
                    nextState
                      ? '⏭️ Автопереключение серий: ВКЛ'
                      : '⏸️ Автопереключение серий: ВЫКЛ'
                  );
                }}
                aria-label="Автопереключение серий"
                title={
                  autoPlayNext
                    ? 'Автопереключение серий: ВКЛ'
                    : 'Автопереключение серий: ВЫКЛ'
                }
                className={`p-2.5 rounded-full transition-all ${
                  autoPlayNext
                    ? 'text-brand-light bg-brand-main/25 hover:bg-brand-main/35'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <FastForward className="w-5 h-5" />
              </button>
            )}

            {/* Episodes List Drawer Icon Button */}
            {episodeCount > 0 && onToggleEpisodesDrawer && (
              <button
                type="button"
                onClick={onToggleEpisodesDrawer}
                aria-label="Список серий"
                title={`Список серий (${episodeCount})`}
                className={`p-2.5 rounded-full transition-all ${
                  showEpisodesDrawer
                    ? 'text-white bg-brand-main shadow-brand-glow'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <ListVideo className="w-5 h-5" />
              </button>
            )}

            {/* Separate Voiceover Selector Icon Button */}
            <button
              type="button"
              onClick={() => openSourceModal(true)}
              aria-label="Выбор озвучки"
              title="Выбор озвучки"
              className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Separate Quality Selector Badge Button (1080p / 720p) */}
            <button
              type="button"
              onClick={() => openQualityModal(true)}
              aria-label="Выбор качества"
              title={`Качество видео: ${currentQualityLabel}`}
              className="px-2.5 py-1.5 text-xs font-extrabold tracking-tight text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all"
            >
              {currentQualityLabel}
            </button>

            {/* Sound Settings, Boost & Speed Icon Button */}
            <button
              type="button"
              onClick={() => openAudioSubsModal(true)}
              aria-label="Настройки звука и скорости"
              title="Настройки звука, усиление и скорость"
              className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              <Sliders className="w-5 h-5" />
            </button>

            {/* Fullscreen Icon Button */}
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label="Полноэкранный режим"
              title={isFullscreen ? 'Выйти из полного экрана (F)' : 'Полный экран (F)'}
              className="p-2.5 text-white/85 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

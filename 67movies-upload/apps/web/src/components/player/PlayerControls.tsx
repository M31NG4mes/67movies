'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  MessageSquare,
  Radio,
  ArrowLeft,
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
}

export function PlayerControls({
  title,
  subtitle,
  onBack,
  onSeek,
  onTogglePlay,
  onSkip,
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
  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen);
  const activeStream = usePlayerStore((s) => s.activeStream);
  const openAudioSubsModal = usePlayerStore((s) => s.openAudioSubsModal);
  const openSourceModal = usePlayerStore((s) => s.openSourceModal);

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col justify-between p-6 bg-gradient-to-t from-cinema-dark/95 via-cinema-dark/25 to-cinema-dark/85 pointer-events-auto transition-opacity duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            data-nav-item="true"
            aria-label="Назад к каталогу"
            className="p-3 text-white/80 hover:text-white bg-cinema-card/70 hover:bg-cinema-card border border-cinema-border rounded-full backdrop-blur-md transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white drop-shadow-md">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm font-medium text-cinema-muted drop-shadow">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Source & Quality Badges */}
        {activeStream && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => openSourceModal(true)}
              data-nav-item="true"
              className="flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold uppercase bg-cinema-card/80 hover:bg-cinema-card border border-cinema-border hover:border-brand-main text-white rounded-full backdrop-blur-md transition-all"
            >
              <Radio className="w-3.5 h-3.5 text-brand-main animate-pulse" />
              <span>{activeStream.providerName}</span>
              <span className="text-brand-light font-bold">[{activeStream.quality}]</span>
            </button>
          </div>
        )}
      </div>

      {/* Middle Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 border-4 border-brand-main border-t-transparent rounded-full animate-spin shadow-brand-glow" />
        </div>
      )}

      {/* Bottom Controls */}
      <div className="space-y-3">
        {/* Scrubber */}
        <TimelineScrubber
          currentTime={currentTime}
          duration={duration}
          bufferedEnd={bufferedEnd}
          onSeek={onSeek}
        />

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white">
          {/* Left Controls */}
          <div className="flex items-center space-x-3 md:space-x-4">
            {/* Play/Pause */}
            <button
              onClick={onTogglePlay}
              data-nav-item="true"
              aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
              className="p-3 text-white bg-brand-main hover:bg-brand-light rounded-full shadow-brand-glow transition-all transform hover:scale-110 active:scale-95"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5 fill-white" />}
            </button>

            {/* Rewind 10s */}
            <button
              onClick={() => onSkip(-10)}
              data-nav-item="true"
              aria-label="Перемотать назад 10 секунд"
              className="p-2 text-white/80 hover:text-white transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => onSkip(10)}
              data-nav-item="true"
              aria-label="Перемотать вперед 10 секунд"
              className="p-2 text-white/80 hover:text-white transition-colors"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Volume with expander */}
            <div
              className="flex items-center space-x-2"
              onMouseEnter={() => setIsVolumeHovered(true)}
              onMouseLeave={() => setIsVolumeHovered(false)}
            >
              <button
                onClick={toggleMute}
                data-nav-item="true"
                aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
                className="p-2 text-white/80 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 flex items-center ${
                  isVolumeHovered ? 'w-24 opacity-100' : 'w-0 opacity-0'
                }`}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1.5 bg-cinema-border rounded-lg appearance-none cursor-pointer accent-brand-main"
                />
              </div>
            </div>

            {/* Timestamps */}
            <div className="text-xs md:text-sm font-medium text-cinema-muted font-mono tracking-tight">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-cinema-muted/60">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2 md:space-x-3">
            {/* Audio & Subtitles button */}
            <button
              onClick={() => openAudioSubsModal(true)}
              data-nav-item="true"
              aria-label="Выбор аудио и субтитров"
              className="flex items-center space-x-1.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-cinema-card border border-transparent hover:border-cinema-border rounded-lg transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="hidden sm:inline">Аудио</span>
            </button>

            {/* Sources button */}
            <button
              onClick={() => openSourceModal(true)}
              data-nav-item="true"
              aria-label="Выбор источника"
              className="flex items-center space-x-1.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-cinema-card border border-transparent hover:border-cinema-border rounded-lg transition-colors"
            >
              <Radio className="w-5 h-5" />
              <span className="hidden sm:inline">Источники</span>
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              data-nav-item="true"
              aria-label="Полноэкранный режим"
              className="p-2 text-white/80 hover:text-white hover:bg-cinema-card border border-transparent hover:border-cinema-border rounded-lg transition-colors"
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

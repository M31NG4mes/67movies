'use client';

import React from 'react';
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
  Radio,
  ArrowLeft,
  ListVideo,
  ShieldCheck,
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
  const audioBoost = usePlayerStore((s) => s.audioBoost);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const activeStream = usePlayerStore((s) => s.activeStream);
  const autoPlayNext = usePlayerStore((s) => s.autoPlayNext);
  const setAutoPlayNext = usePlayerStore((s) => s.setAutoPlayNext);
  const isUsingProxy = usePlayerStore((s) => s.isUsingProxy);
  const setUseSafeProxy = usePlayerStore((s) => s.setUseSafeProxy);
  const showOsd = usePlayerStore((s) => s.showOsd);
  const openAudioSubsModal = usePlayerStore((s) => s.openAudioSubsModal);
  const openSourceModal = usePlayerStore((s) => s.openSourceModal);

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
  const volPercent = Math.round(effectiveVol * 100);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-0 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-t from-cinema-dark/95 via-cinema-dark/20 to-cinema-dark/85 pointer-events-auto transition-opacity duration-300"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад к каталогу"
            className="p-2.5 sm:p-3 text-white/90 hover:text-white bg-cinema-card/80 hover:bg-cinema-card border border-cinema-border rounded-full backdrop-blur-md transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white drop-shadow-md truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm font-medium text-cinema-muted drop-shadow truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Top-Right Quick Toggles: Auto-Next, Safe HTTPS Proxy, Voiceover/Quality Badge */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-Next Toggle (shown when series/episodes exist) */}
          {(hasPrevEpisode || hasNextEpisode || episodeCount > 1) && (
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
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border backdrop-blur-md transition-all ${
                autoPlayNext
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-cinema-card/80 border-cinema-border text-cinema-muted hover:text-white'
              }`}
              title="Автоматически включать следующую серию после завершения текущей"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Автосерия: {autoPlayNext ? 'ВКЛ' : 'ВЫКЛ'}</span>
            </button>
          )}

          {/* Edge HTTPS Safe Proxy Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextProxy = !isUsingProxy;
              setUseSafeProxy(nextProxy);
              showOsd(
                nextProxy
                  ? '🛡️ Защищённый HTTPS-прокси включён (для Edge)'
                  : '⚡ Прямой поток CDN включён'
              );
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border backdrop-blur-md transition-all ${
              isUsingProxy
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-cinema-card/80 border-cinema-border text-cinema-muted hover:text-white'
            }`}
            title="Если браузер Edge блокирует прямой CDN-поток, включите защищённый HTTPS-прокси"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">
              {isUsingProxy ? 'Защита Edge: ВКЛ' : 'Защита Edge'}
            </span>
          </button>

          {/* Active Voiceover & Quality Badge */}
          {activeStream && (
            <button
              type="button"
              onClick={() => openSourceModal(true)}
              className="flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold uppercase bg-cinema-card/80 hover:bg-cinema-card border border-cinema-border hover:border-brand-main text-white rounded-full backdrop-blur-md transition-all"
            >
              <Radio className="w-3.5 h-3.5 text-brand-main animate-pulse" />
              <span className="max-w-[140px] sm:max-w-[220px] truncate">
                {activeStream.voiceActing || activeStream.providerName}
              </span>
              <span className="text-brand-light font-bold">[{activeStream.quality}]</span>
            </button>
          )}
        </div>
      </div>

      {/* Center Click Area (Play/Pause on click, Fullscreen on double click) */}
      <div
        onClick={onTogglePlay}
        onDoubleClick={onToggleFullscreen}
        className="flex-1 w-full flex items-center justify-center cursor-pointer"
      >
        {isBuffering && (
          <div className="w-16 h-16 border-4 border-brand-main border-t-transparent rounded-full animate-spin shadow-brand-glow pointer-events-none" />
        )}
      </div>

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
        <div className="flex flex-wrap items-center justify-between gap-2 text-white">
          {/* Left Controls */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 md:gap-3">
            {/* Previous Episode */}
            {(hasPrevEpisode || hasNextEpisode || episodeCount > 1) && (
              <button
                type="button"
                onClick={onPrevEpisode}
                disabled={!hasPrevEpisode}
                aria-label="Предыдущая серия"
                title="Предыдущая серия (P или Shift + ←)"
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-cinema-card/80 hover:bg-cinema-card border border-cinema-border text-white/90 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-all text-xs font-semibold"
              >
                <SkipBack className="w-4 h-4" />
                <span className="hidden lg:inline">Пред.</span>
              </button>
            )}

            {/* Play/Pause */}
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
              title={isPlaying ? 'Пауза (Space)' : 'Воспроизведение (Space)'}
              className="p-3 text-white bg-brand-main hover:bg-brand-light rounded-full shadow-brand-glow transition-all transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5 fill-white" />
              )}
            </button>

            {/* Next Episode */}
            {(hasPrevEpisode || hasNextEpisode || episodeCount > 1) && (
              <button
                type="button"
                onClick={onNextEpisode}
                disabled={!hasNextEpisode}
                aria-label="Следующая серия"
                title="Следующая серия (N или Shift + →)"
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-cinema-card/80 hover:bg-cinema-card border border-cinema-border text-white/90 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-all text-xs font-semibold"
              >
                <span className="hidden lg:inline">След.</span>
                <SkipForward className="w-4 h-4" />
              </button>
            )}

            {/* Rewind 10s */}
            <button
              type="button"
              onClick={() => onSkip(-10)}
              aria-label="Перемотать назад 10 секунд"
              title="Назад 10 сек (←)"
              className="flex items-center gap-1 px-2 py-1.5 text-white/85 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs font-bold"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">-10с</span>
            </button>

            {/* Forward 10s */}
            <button
              type="button"
              onClick={() => onSkip(10)}
              aria-label="Перемотать вперед 10 секунд"
              title="Вперёд 10 сек (→)"
              className="flex items-center gap-1 px-2 py-1.5 text-white/85 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs font-bold"
            >
              <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">+10с</span>
            </button>

            {/* Always-Visible Volume Slider & Mute */}
            <div className="flex items-center gap-2 bg-cinema-card/75 border border-cinema-border/80 rounded-xl px-2.5 py-1.5">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
                title="Вкл/Выкл звук (M или Колёсико мыши / Стрелки ↑↓)"
                className="text-white/90 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                aria-label="Громкость"
                value={effectiveVol}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 sm:w-24 h-1.5 bg-cinema-border rounded-lg appearance-none cursor-pointer accent-brand-main"
              />

              <span className="text-[11px] font-mono font-bold text-white/90 min-w-[34px] text-right">
                {volPercent}%
              </span>
            </div>

            {/* Timestamps */}
            <div className="text-xs md:text-sm font-medium text-cinema-muted font-mono tracking-tight pl-1">
              <span className="text-white">{formatTime(currentTime)}</span>
              <span className="mx-1 text-cinema-muted/60">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Episodes List Drawer Button */}
            {episodeCount > 0 && onToggleEpisodesDrawer && (
              <button
                type="button"
                onClick={onToggleEpisodesDrawer}
                aria-label="Список серий"
                className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all ${
                  showEpisodesDrawer
                    ? 'bg-brand-main border-brand-main text-white shadow-brand-glow'
                    : 'bg-cinema-card/80 hover:bg-cinema-card border-cinema-border text-white/90 hover:text-white'
                }`}
              >
                <ListVideo className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Серии ({episodeCount})</span>
              </button>
            )}

            {/* Sound Settings, Boost & Speed button */}
            <button
              type="button"
              onClick={() => openAudioSubsModal(true)}
              aria-label="Настройки звука и скорости"
              title="Настройки звука, усиление громкости (до 200%), скорость и субтитры"
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-white/90 hover:text-white bg-cinema-card/80 hover:bg-cinema-card border border-cinema-border rounded-xl transition-colors"
            >
              <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-brand-light" />
              <span className="hidden md:inline">Звук</span>
              {audioBoost > 1 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                  x{audioBoost}
                </span>
              )}
            </button>

            {/* Sources / Voiceovers button */}
            <button
              type="button"
              onClick={() => openSourceModal(true)}
              aria-label="Выбор озвучки и качества"
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-white/90 hover:text-white bg-cinema-card/80 hover:bg-cinema-card border border-cinema-border rounded-xl transition-colors"
            >
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-brand-main" />
              <span className="hidden sm:inline">Озвучка</span>
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label="Полноэкранный режим"
              title="Полноэкранный режим (F или двойной клик)"
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-white bg-brand-main/20 hover:bg-brand-main border border-brand-main/50 rounded-xl transition-all"
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden lg:inline">Обычный</span>
                </>
              ) : (
                <>
                  <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden lg:inline">Полный экран</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

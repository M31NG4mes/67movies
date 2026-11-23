'use client';

import React from 'react';
import { Check, X, Volume2, ShieldCheck, FastForward, Sliders } from 'lucide-react';
import { usePlayerStore } from '../../stores/player.store';

interface TrackSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAudio: (id: string) => void;
  onSelectSubtitle: (id: string | null) => void;
}

export function TrackSelectorModal({
  isOpen,
  onClose,
  onSelectAudio,
  onSelectSubtitle,
}: TrackSelectorModalProps) {
  const activeAudioTrackId = usePlayerStore((s) => s.activeAudioTrackId);
  const availableAudioTracks = usePlayerStore((s) => s.availableAudioTracks);
  const activeSubtitleId = usePlayerStore((s) => s.activeSubtitleId);
  const availableSubtitles = usePlayerStore((s) => s.availableSubtitles);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const audioBoost = usePlayerStore((s) => s.audioBoost);
  const setAudioBoost = usePlayerStore((s) => s.setAudioBoost);
  const autoPlayNext = usePlayerStore((s) => s.autoPlayNext);
  const setAutoPlayNext = usePlayerStore((s) => s.setAutoPlayNext);
  const autoSkipIntro = usePlayerStore((s) => s.autoSkipIntro);
  const setAutoSkipIntro = usePlayerStore((s) => s.setAutoSkipIntro);
  const autoSkipOutro = usePlayerStore((s) => s.autoSkipOutro);
  const setAutoSkipOutro = usePlayerStore((s) => s.setAutoSkipOutro);
  const showManualSkipButtons = usePlayerStore((s) => s.showManualSkipButtons);
  const setShowManualSkipButtons = usePlayerStore((s) => s.setShowManualSkipButtons);
  const useSafeProxy = usePlayerStore((s) => s.useSafeProxy);
  const isUsingProxy = usePlayerStore((s) => s.isUsingProxy);
  const setUseSafeProxy = usePlayerStore((s) => s.setUseSafeProxy);

  if (!isOpen) return null;

  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const boosts = [
    { value: 1.0, label: '100% (Стандарт)' },
    { value: 1.25, label: '125% (+25%)' },
    { value: 1.5, label: '150% (+50%)' },
    { value: 2.0, label: '200% (Макс. усиление)' },
  ];

  const effectiveVolPercent = isMuted ? 0 : Math.round(volume * 100);

  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-cinema-surface border border-cinema-border rounded-2xl shadow-2xl p-6 text-white max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cinema-border">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-brand-main" />
            <h2 className="text-xl font-bold tracking-wide">
              Настройки звука, скорости и воспроизведения
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-cinema-muted hover:text-white hover:bg-cinema-card rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-6 overflow-y-auto pr-1">
          {/* 1. Sound & Volume Controls */}
          <div className="bg-cinema-card border border-cinema-border rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-brand-light" />
                <span className="text-sm font-bold text-white">
                  Громкость звука: {effectiveVolPercent}%
                </span>
                {audioBoost > 1 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[11px] font-bold text-amber-300">
                    Усиление x{audioBoost}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={toggleMute}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  isMuted
                    ? 'bg-red-500/20 border-red-500/50 text-red-300'
                    : 'bg-cinema-surface border-cinema-border text-cinema-muted hover:text-white'
                }`}
              >
                {isMuted ? '🔇 Звук выключен (Включить)' : 'Выключить звук (M)'}
              </button>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-cinema-border rounded-lg appearance-none cursor-pointer accent-brand-main"
              />
              <div className="flex items-center gap-1.5">
                {[0.25, 0.5, 0.75, 1.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setVolume(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      !isMuted && Math.abs(volume - preset) < 0.03
                        ? 'bg-brand-main border-brand-main text-white'
                        : 'bg-cinema-surface border-cinema-border text-cinema-muted hover:text-white'
                    }`}
                  >
                    {Math.round(preset * 100)}%
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Boost */}
            <div className="pt-2 border-t border-cinema-border/60">
              <p className="text-xs font-semibold text-cinema-muted uppercase tracking-wider mb-2">
                Усиление тихого звука (Web Audio Boost)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {boosts.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setAudioBoost(b.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                      audioBoost === b.value
                        ? 'bg-brand-main border-brand-main text-white shadow-brand-glow'
                        : 'bg-cinema-surface border-cinema-border text-cinema-muted hover:text-white'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Auto-Next Episode & Edge Safe HTTPS Proxy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-cinema-card border border-cinema-border rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                  <FastForward className="w-4 h-4 text-brand-light" />
                  <span>Автопереключение серий</span>
                </div>
                <p className="text-xs text-cinema-muted mt-1">
                  Автоматически включать следующую серию после окончания текущей
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoPlayNext(!autoPlayNext)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${
                  autoPlayNext
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-cinema-surface border-cinema-border text-cinema-muted'
                }`}
              >
                {autoPlayNext ? 'ВКЛ' : 'ВЫКЛ'}
              </button>
            </div>

            <div className="bg-cinema-card border border-cinema-border rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Защита потока (Edge HTTPS)</span>
                </div>
                <p className="text-xs text-cinema-muted mt-1">
                  Безопасный HTTPS-прокси для обхода блокировки SmartScreen в Microsoft Edge
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUseSafeProxy(!isUsingProxy)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${
                  isUsingProxy || useSafeProxy
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-cinema-surface border-cinema-border text-cinema-muted hover:text-white'
                }`}
              >
                {isUsingProxy ? 'HTTPS Прокси' : 'Прямой CDN'}
              </button>
            </div>

            <div className="bg-cinema-card border border-cinema-border rounded-xl p-4 space-y-3">
              <div className="text-sm font-bold text-white">
                Пропуск опенинга и эндинга (AniSkip)
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-cinema-muted">
                  Автоматически пропускать опенинг
                </span>
                <button
                  type="button"
                  onClick={() => setAutoSkipIntro(!autoSkipIntro)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${
                    autoSkipIntro
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-cinema-surface border-cinema-border text-cinema-muted'
                  }`}
                >
                  {autoSkipIntro ? 'ВКЛ' : 'ВЫКЛ'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-cinema-muted">
                  Автоматически пропускать эндинг
                </span>
                <button
                  type="button"
                  onClick={() => setAutoSkipOutro(!autoSkipOutro)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${
                    autoSkipOutro
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-cinema-surface border-cinema-border text-cinema-muted'
                  }`}
                >
                  {autoSkipOutro ? 'ВКЛ' : 'ВЫКЛ'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-cinema-muted">
                  Всегда показывать кнопку ручного пропуска
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualSkipButtons(!showManualSkipButtons)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${
                    showManualSkipButtons
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-cinema-surface border-cinema-border text-cinema-muted'
                  }`}
                >
                  {showManualSkipButtons ? 'ВКЛ' : 'ВЫКЛ'}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Audio Tracks, Subtitles, Playback Speed */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Audio Tracks */}
            <div>
              <h3 className="text-xs font-semibold text-cinema-muted uppercase tracking-wider mb-3">
                Аудиодорожки
              </h3>
              <div className="space-y-1.5">
                {availableAudioTracks.length === 0 ? (
                  <div className="text-sm text-cinema-muted py-2">Основная дорожка</div>
                ) : (
                  availableAudioTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => onSelectAudio(track.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                        activeAudioTrackId === track.id
                          ? 'bg-brand-main text-white font-medium shadow-brand-glow'
                          : 'text-cinema-muted hover:text-white hover:bg-cinema-card'
                      }`}
                    >
                      <span>{track.label}</span>
                      {activeAudioTrackId === track.id && <Check className="w-4 h-4 ml-2" />}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Subtitles */}
            <div>
              <h3 className="text-xs font-semibold text-cinema-muted uppercase tracking-wider mb-3">
                Субтитры
              </h3>
              <div className="space-y-1.5">
                <button
                  onClick={() => onSelectSubtitle(null)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                    activeSubtitleId === null
                      ? 'bg-brand-main text-white font-medium shadow-brand-glow'
                      : 'text-cinema-muted hover:text-white hover:bg-cinema-card'
                  }`}
                >
                  <span>Выключены</span>
                  {activeSubtitleId === null && <Check className="w-4 h-4 ml-2" />}
                </button>

                {availableSubtitles.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => onSelectSubtitle(sub.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                      activeSubtitleId === sub.id
                        ? 'bg-brand-main text-white font-medium shadow-brand-glow'
                        : 'text-cinema-muted hover:text-white hover:bg-cinema-card'
                    }`}
                  >
                    <span>{sub.label}</span>
                    {activeSubtitleId === sub.id && <Check className="w-4 h-4 ml-2" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Playback Speed */}
            <div>
              <h3 className="text-xs font-semibold text-cinema-muted uppercase tracking-wider mb-3">
                Скорость видео
              </h3>
              <div className="space-y-1.5">
                {speeds.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlaybackRate(s)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      playbackRate === s
                        ? 'bg-brand-main text-white font-medium shadow-brand-glow'
                        : 'text-cinema-muted hover:text-white hover:bg-cinema-card'
                    }`}
                  >
                    <span>{s === 1.0 ? 'Обычная (1.0x)' : `${s}x`}</span>
                    {playbackRate === s && <Check className="w-4 h-4 ml-2" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hotkeys Cheat Sheet */}
          <div className="pt-3 border-t border-cinema-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-cinema-muted">
            <span>⌨️ Горячие клавиши:</span>
            <span>← / → : Перемотка ±10 сек</span>
            <span>↑ / ↓ или Колёсико мыши : Громкость ±5%</span>
            <span>Space : Пауза</span>
            <span>F или Двойной клик : Полный экран</span>
            <span>N / P : След. / Пред. серия</span>
          </div>
        </div>
      </div>
    </div>
  );
}

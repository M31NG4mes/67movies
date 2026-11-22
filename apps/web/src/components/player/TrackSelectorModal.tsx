'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
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

  if (!isOpen) return null;

  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-cinema-surface border border-cinema-border rounded-2xl shadow-2xl p-6 text-white max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cinema-border">
          <h2 className="text-xl font-bold tracking-wide">Аудио и субтитры</h2>
          <button
            onClick={onClose}
            data-nav-item="true"
            className="p-2 text-cinema-muted hover:text-white hover:bg-cinema-card rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 overflow-y-auto">
          {/* Audio Tracks */}
          <div>
            <h3 className="text-xs font-semibold text-cinema-muted uppercase tracking-wider mb-3">
              Аудиодорожки
            </h3>
            <div className="space-y-1">
              {availableAudioTracks.length === 0 ? (
                <div className="text-sm text-cinema-muted py-2">Основная дорожка</div>
              ) : (
                availableAudioTracks.map((track) => (
                  <button
                    key={track.id}
                    data-nav-item="true"
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
            <div className="space-y-1">
              <button
                data-nav-item="true"
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
                  data-nav-item="true"
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
              Скорость
            </h3>
            <div className="space-y-1">
              {speeds.map((s) => (
                <button
                  key={s}
                  data-nav-item="true"
                  onClick={() => setPlaybackRate(s)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
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
      </div>
    </div>
  );
}

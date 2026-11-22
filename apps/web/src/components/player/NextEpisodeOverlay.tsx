'use client';

import React, { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';

interface NextEpisodeOverlayProps {
  nextEpisodeNumber: number;
  nextEpisodeName?: string;
  seasonNumber: number;
  onPlayNext: () => void;
  onCancel: () => void;
  countdownSeconds?: number;
}

export function NextEpisodeOverlay({
  nextEpisodeNumber,
  nextEpisodeName,
  seasonNumber,
  onPlayNext,
  onCancel,
  countdownSeconds = 8,
}: NextEpisodeOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onPlayNext();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onPlayNext]);

  const progressPercent = ((countdownSeconds - secondsLeft) / countdownSeconds) * 100;

  return (
    <div className="absolute bottom-24 right-6 z-40 max-w-sm w-full bg-cinema-surface/95 border border-cinema-border rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-fadeIn select-none">
      <div className="flex items-start justify-between pb-2">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-brand-light">
            Следующая серия через {secondsLeft} сек
          </span>
          <h4 className="text-sm font-bold text-white line-clamp-1 mt-0.5">
            Сезон {seasonNumber}, Серия {nextEpisodeNumber}
          </h4>
          {nextEpisodeName && (
            <p className="text-xs text-cinema-muted line-clamp-1 mt-0.5">
              {nextEpisodeName}
            </p>
          )}
        </div>

        <button
          onClick={onCancel}
          data-nav-item="true"
          aria-label="Отменить автопереход"
          className="p-1 text-cinema-muted hover:text-white rounded-lg hover:bg-cinema-card transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress countdown bar */}
      <div className="w-full h-1 bg-cinema-card rounded-full overflow-hidden my-3">
        <div
          className="h-full bg-gradient-to-r from-brand-main to-brand-light transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onPlayNext}
          data-nav-item="true"
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-brand-main hover:bg-brand-light text-white text-xs font-bold rounded-xl shadow-brand-glow transition-all"
        >
          <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
          <span>Включить сейчас</span>
        </button>

        <button
          onClick={onCancel}
          data-nav-item="true"
          className="px-3.5 py-2 bg-cinema-card hover:bg-cinema-surface text-cinema-muted hover:text-white text-xs font-semibold rounded-xl border border-cinema-border transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

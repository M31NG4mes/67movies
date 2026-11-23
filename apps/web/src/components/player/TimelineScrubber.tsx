'use client';

import React, { useState, useRef } from 'react';

interface TimelineScrubberProps {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  onSeek: (time: number) => void;
}

export function TimelineScrubber({
  currentTime,
  duration,
  bufferedEnd,
  onSeek,
}: TimelineScrubberProps) {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const progressRef = useRef<HTMLDivElement>(null);

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

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  const getPositionFromClientX = (clientX: number) => {
    if (!progressRef.current || duration <= 0) return null;
    const rect = progressRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pos = getPositionFromClientX(e.clientX);
    if (pos === null) return;
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const pos = getPositionFromClientX(e.clientX);
    if (pos === null) return;
    onSeek(pos * duration);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch) return;
    const pos = getPositionFromClientX(touch.clientX);
    if (pos === null) return;
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
    onSeek(pos * duration);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch) return;
    const pos = getPositionFromClientX(touch.clientX);
    if (pos === null) return;
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
    onSeek(pos * duration);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setHoverTime(null);
  };

  return (
    <div
      ref={progressRef}
      role="slider"
      aria-label="Таймлайн воспроизведения"
      aria-valuenow={currentTime}
      aria-valuemin={0}
      aria-valuemax={duration}
      tabIndex={0}
      data-nav-item="true"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onSeek(Math.min(duration, currentTime + 10));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onSeek(Math.max(0, currentTime - 10));
        }
      }}
      className="relative w-full h-6 sm:h-4 group cursor-pointer flex items-center select-none touch-none focus:outline-none"
    >
      {/* Background Track */}
      <div className="absolute w-full h-1 group-hover:h-2 bg-white/20 rounded-full transition-all duration-150 overflow-hidden">
        {/* Buffered bar */}
        <div
          className="h-full bg-white/30 rounded-full transition-all duration-200"
          style={{ width: `${bufferedPercent}%` }}
        />
      </div>

      {/* Played Progress bar */}
      <div
        className="absolute h-1 group-hover:h-2 bg-gradient-to-r from-brand-main to-brand-light rounded-full pointer-events-none transition-all duration-75 shadow-brand-glow"
        style={{ width: `${currentPercent}%` }}
      />

      {/* Scrubber thumb */}
      <div
        className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-brand-glow scale-100 sm:scale-0 sm:group-hover:scale-100 group-focus:scale-100 transition-transform duration-150 -translate-x-1/2 pointer-events-none"
        style={{ left: `${currentPercent}%` }}
      />

      {/* Hover Time Tooltip */}
      {hoverTime !== null && (
        <div
          className="absolute -top-8 px-2 py-1 text-xs font-medium text-white bg-cinema-card border border-cinema-border rounded shadow-lg pointer-events-none -translate-x-1/2"
          style={{ left: `${hoverPosition}%` }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
}

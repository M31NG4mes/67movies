'use client';

import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { ContinueWatchingCard } from './ContinueWatchingCard';
import { MediaItem } from '@cinemaflow/types';

interface ContinueItem {
  media: MediaItem;
  seasonNumber?: number;
  episodeNumber?: number;
  percentage: number;
  remainingMinutes?: number;
}

interface ContinueWatchingRailProps {
  items: ContinueItem[];
}

export function ContinueWatchingRail({ items }: ContinueWatchingRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const offset = direction === 'left' ? -500 : 500;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="relative py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-brand-main" />
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-cinema-text tracking-wide">
            Продолжить просмотр
          </h2>
        </div>

        {/* Scroll Buttons */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => handleScroll('left')}
            data-nav-item="true"
            aria-label="Прокрутить назад"
            className="p-1.5 text-cinema-muted hover:text-white bg-cinema-card hover:bg-cinema-surface border border-cinema-border rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            data-nav-item="true"
            aria-label="Прокрутить вперед"
            className="p-1.5 text-cinema-muted hover:text-white bg-cinema-card hover:bg-cinema-surface border border-cinema-border rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal List */}
      <div
        ref={scrollRef}
        className="flex gap-4 sm:gap-5 overflow-x-auto overflow-y-hidden px-4 sm:px-6 lg:px-8 pb-3 scrollbar-none scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item, idx) => (
          <ContinueWatchingCard
            key={`${item.media.id}-${idx}`}
            media={item.media}
            seasonNumber={item.seasonNumber}
            episodeNumber={item.episodeNumber}
            percentage={item.percentage}
            remainingMinutes={item.remainingMinutes}
          />
        ))}
      </div>
    </section>
  );
}

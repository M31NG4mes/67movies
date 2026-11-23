'use client';

import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaCard } from './MediaCard';
import { MediaItem } from '@cinemaflow/types';

interface MediaRailProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  items: MediaItem[];
  icon?: React.ReactNode;
}

export function MediaRail({ title, subtitle, items }: MediaRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const offset = direction === 'left' ? -620 : 620;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="relative py-2 sm:py-3">
      <div className="max-w-[1440px] mx-auto px-3.5 sm:px-8 lg:px-10 mb-2 sm:mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-[#9A9894] mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            aria-label="Прокрутить назад"
            className="rail-scroll-btn w-8 h-8 rounded-full border border-white/15 hover:border-[#8065FF] text-[#92929F] hover:text-white flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            aria-label="Прокрутить вперед"
            className="rail-scroll-btn w-8 h-8 rounded-full border border-white/15 hover:border-[#8065FF] text-[#92929F] hover:text-white flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="max-w-[1440px] mx-auto flex gap-2.5 sm:gap-4 overflow-x-auto overflow-y-hidden px-3.5 sm:px-8 lg:px-10 pt-2 pb-4 sm:pt-3 sm:pb-6 -mt-1 sm:-mt-2 scrollbar-none scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => (
          <MediaCard key={item.id} media={item} />
        ))}
      </div>
    </section>
  );
}

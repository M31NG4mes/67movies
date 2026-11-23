'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem } from '@cinemaflow/types';
import { TRANSLATIONS, usePreferencesStore } from '../../stores/preferences.store';
import { useLibraryStore } from '../../stores/library.store';

interface HeroBannerProps {
  items?: MediaItem[];
  media?: MediaItem;
}

export function HeroBanner({ items, media }: HeroBannerProps) {
  const activeList = items && items.length > 0 ? items : media ? [media] : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const language = usePreferencesStore((s) => s.language);
  const t = TRANSLATIONS[language];
  const { watchlist, hydrate, toggleWatchlist } = useLibraryStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const nextSlide = useCallback(() => {
    if (activeList.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % activeList.length);
  }, [activeList.length]);

  const prevSlide = useCallback(() => {
    if (activeList.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + activeList.length) % activeList.length);
  }, [activeList.length]);

  useEffect(() => {
    if (activeList.length <= 1) return;
    const interval = setInterval(nextSlide, 8500);
    return () => clearInterval(interval);
  }, [activeList.length, nextSlide]);

  if (activeList.length === 0) return null;

  const currentMedia = activeList[currentIndex];
  const isSaved = watchlist.some(
    (w) => String(w.id) === String(currentMedia.tmdbId || currentMedia.id)
  );
  const toggleSave = () => {
    toggleWatchlist(currentMedia);
  };

  return (
    <section className="relative w-full h-[72vh] sm:h-[78vh] min-h-[480px] sm:min-h-[540px] max-h-[780px] flex items-center overflow-hidden bg-[#09090D]">
      {/* Stacked Crossfading Backdrops (zero flicker!) */}
      {activeList.map((item, idx) => {
        const bg =
          item.backdropPath ||
          item.posterPath ||
          'https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg';
        const isActive = idx === currentIndex;
        return (
          <div
            key={item.id}
            className={`absolute inset-0 bg-cover bg-no-repeat transition-opacity duration-700 ease-out ${
              isActive ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
            }`}
            style={{
              backgroundImage: `url(${bg})`,
              backgroundPosition: 'center 20%',
            }}
          >
            {isActive && (
              <div
                className="w-full h-full animate-heroZoom"
                style={{
                  backgroundImage: `url(${bg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center 20%',
                }}
              />
            )}
          </div>
        );
      })}

      {/* Smooth Cinema Vignettes */}
      <div className="absolute inset-0 z-[1] bg-hero-vignette-x" />
      <div className="absolute inset-0 z-[1] bg-hero-vignette-y" />

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10 pt-10 pb-20 hero-keep-white">
        <div key={currentMedia.id} className="max-w-xl space-y-5 animate-slideUp">
          {/* Small Crimson Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/50 bg-red-500/15 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-300 tracking-wide">
              {currentMedia.type === 'tv' ? t.series : language === 'en' ? 'Trending' : 'В тренде'}
            </span>
          </div>

          {/* Large Clean White Title */}
          <h1 className="text-2xl sm:text-5xl lg:text-[54px] font-bold text-white tracking-tight leading-[1.12] drop-shadow-2xl">
            {currentMedia.title}
          </h1>

          {/* Short Muted Description */}
          <p className="text-xs sm:text-[15px] text-white/75 line-clamp-2 leading-relaxed max-w-lg">
            {currentMedia.overview}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Link
              href={`/movie/${
                currentMedia.anilibertyId
                  ? `al-${currentMedia.anilibertyId}`
                  : String(currentMedia.id || '').startsWith('al-')
                  ? currentMedia.id
                  : currentMedia.tmdbId || currentMedia.id
              }?type=${
                currentMedia.type === 'tv' ? 'tv' : 'movie'
              }`}
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-3.5 brand-btn text-white font-semibold rounded-xl text-sm sm:text-base"
            >
              {t.watch}
            </Link>

            <button
              type="button"
              onClick={toggleSave}
              title={isSaved ? t.inWatchlist : t.addToWatchlist}
              aria-label={isSaved ? t.inWatchlist : t.addToWatchlist}
              className={`inline-flex items-center gap-2 px-4 h-11 sm:h-12 rounded-xl border text-xs sm:text-sm font-semibold transition-all backdrop-blur-sm ${
                isSaved
                  ? 'border-[#8065FF] bg-[#8065FF]/25 text-white'
                  : 'border-white/25 bg-white/10 hover:border-[#8065FF] text-white'
              }`}
            >
              {isSaved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {isSaved ? t.inWatchlist : t.addToWatchlist}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pinned Bottom-Right Dots + Circular Prev/Next Arrows (never jumps vertically!) */}
      {activeList.length > 1 && (
        <div className="absolute bottom-14 sm:bottom-28 right-5 sm:right-8 lg:right-10 z-20 flex items-center gap-3 sm:gap-4 hero-keep-white">
          <div className="flex items-center gap-1.5">
            {activeList.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Слайд ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? 'w-7 bg-[#8065FF]'
                    : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Предыдущий фильм"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/25 hover:border-white/60 bg-black/40 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white transition-all hover:scale-105 active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Следующий фильм"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#8065FF] hover:bg-[#8065FF]/25 bg-black/40 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

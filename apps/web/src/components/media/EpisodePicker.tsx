'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Season, Episode } from '@cinemaflow/types';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';

const EPISODES_PER_PAGE = 50;

interface EpisodePickerProps {
  seasons: Season[];
  activeSeason: number;
  activeEpisode: number;
  onSelectEpisode: (seasonNumber: number, episodeNumber: number) => void;
  onSelectSeason: (seasonNumber: number) => void;
}

export function EpisodePicker({
  seasons,
  activeSeason,
  activeEpisode,
  onSelectEpisode,
  onSelectSeason,
}: EpisodePickerProps) {
  const currentSeason =
    (seasons && seasons.find((s) => s.seasonNumber === activeSeason)) ||
    seasons?.[0];

  const allEpisodes: Episode[] = useMemo(() => {
    if (!currentSeason) return [];
    const raw = currentSeason.episodes || [];
    const declaredCount = currentSeason.episodeCount || raw.length;
    if (raw.length >= declaredCount && raw.length > 0) {
      return [...raw].sort((a, b) => a.episodeNumber - b.episodeNumber);
    }
    if (declaredCount > raw.length) {
      const byNum = new Map<number, Episode>();
      for (const e of raw) {
        byNum.set(Number(e.episodeNumber), e);
      }
      const full: Episode[] = [];
      for (let i = 1; i <= declaredCount; i++) {
        const existing = byNum.get(i);
        full.push(
          existing || {
            id: `${currentSeason.id || 's1'}-ep-${i}`,
            seasonNumber: currentSeason.seasonNumber || 1,
            episodeNumber: i,
            name: `Серия ${i}`,
            stillPath: currentSeason.posterPath || null,
            durationMinutes: 24,
          }
        );
      }
      return full;
    }
    return raw;
  }, [currentSeason]);

  const totalPages = Math.max(1, Math.ceil(allEpisodes.length / EPISODES_PER_PAGE));

  const [currentPage, setCurrentPage] = useState<number>(() => {
    const idx = allEpisodes.findIndex((e) => e.episodeNumber === activeEpisode);
    return idx >= 0 ? Math.floor(idx / EPISODES_PER_PAGE) : 0;
  });

  // Automatically jump to the page containing activeEpisode when season or activeEpisode changes
  useEffect(() => {
    const idx = allEpisodes.findIndex((e) => e.episodeNumber === activeEpisode);
    if (idx >= 0) {
      const targetPage = Math.floor(idx / EPISODES_PER_PAGE);
      setCurrentPage(targetPage);
    } else {
      setCurrentPage(0);
    }
  }, [activeSeason, activeEpisode, allEpisodes.length]);

  if (!seasons || seasons.length === 0 || !currentSeason) return null;

  const safePage = Math.min(Math.max(0, currentPage), totalPages - 1);
  const startIdx = safePage * EPISODES_PER_PAGE;
  const visibleEpisodes = allEpisodes.slice(startIdx, startIdx + EPISODES_PER_PAGE);

  return (
    <div className="py-4 space-y-4">
      {/* Seasons & Episode Pages Header */}
      <div className="flex flex-col gap-3">
        {/* Seasons Tab Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {seasons.map((season) => {
              const isSelected = season.seasonNumber === activeSeason;
              return (
                <button
                  key={season.id}
                  type="button"
                  data-nav-item="true"
                  onClick={() => onSelectSeason(season.seasonNumber)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-brand-main text-white shadow-brand-glow'
                      : 'bg-cinema-card hover:bg-cinema-surface text-cinema-muted hover:text-white border border-cinema-border'
                  }`}
                >
                  {season.name} ({allEpisodes.length})
                </button>
              );
            })}
          </div>

          {totalPages > 1 && (
            <span className="text-xs font-semibold text-cinema-muted">
              Страница {safePage + 1} из {totalPages} • по {EPISODES_PER_PAGE} серий
            </span>
          )}
        </div>

        {/* 50-Episode Range Pagination Tabs (shown when > 50 episodes) */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Предыдущие 50 серий"
              className="p-2 rounded-lg bg-cinema-card hover:bg-cinema-surface border border-cinema-border text-white disabled:opacity-35 disabled:pointer-events-none transition-all flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, pageIdx) => {
              const firstEp =
                allEpisodes[pageIdx * EPISODES_PER_PAGE]?.episodeNumber ||
                pageIdx * EPISODES_PER_PAGE + 1;
              const lastEpSlice =
                allEpisodes[
                  Math.min(
                    allEpisodes.length - 1,
                    (pageIdx + 1) * EPISODES_PER_PAGE - 1
                  )
                ];
              const lastEp =
                lastEpSlice?.episodeNumber ||
                Math.min(allEpisodes.length, (pageIdx + 1) * EPISODES_PER_PAGE);
              const isPageActive = pageIdx === safePage;

              return (
                <button
                  key={`ep-page-${pageIdx}`}
                  type="button"
                  onClick={() => setCurrentPage(pageIdx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all flex-shrink-0 ${
                    isPageActive
                      ? 'bg-[#8065FF] border-[#8065FF] text-white shadow-[0_0_15px_rgba(128,101,255,0.35)]'
                      : 'bg-cinema-card hover:bg-cinema-surface border-cinema-border text-cinema-muted hover:text-white'
                  }`}
                >
                  {firstEp}–{lastEp}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label="Следующие 50 серий"
              className="p-2 rounded-lg bg-cinema-card hover:bg-cinema-surface border border-cinema-border text-white disabled:opacity-35 disabled:pointer-events-none transition-all flex-shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Episodes Grid (max 50 episodes per page) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleEpisodes.map((ep) => {
          const isSelected =
            ep.seasonNumber === activeSeason && ep.episodeNumber === activeEpisode;
          const coverSrc = ep.stillPath || currentSeason.posterPath || null;
          return (
            <button
              key={`${ep.id}-${ep.episodeNumber}`}
              type="button"
              data-nav-item="true"
              onClick={() => onSelectEpisode(ep.seasonNumber, ep.episodeNumber)}
              className={`group flex items-start space-x-3 p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-cinema-card border-brand-main shadow-brand-glow'
                  : 'bg-cinema-surface border-cinema-border/60 hover:bg-cinema-card hover:border-cinema-border'
              }`}
            >
              <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-[#231F3A] via-[#171625] to-[#0D0D14] flex-shrink-0 flex items-center justify-center border border-white/10">
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt={ep.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const imgEl = e.currentTarget;
                      if (
                        currentSeason.posterPath &&
                        imgEl.src !== currentSeason.posterPath
                      ) {
                        imgEl.src = currentSeason.posterPath;
                      } else {
                        imgEl.style.display = 'none';
                      }
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : null}
                <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
                    <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                  </div>
                </div>
                <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-cinema-dark/85 rounded text-[9px] font-mono text-white">
                  {ep.durationMinutes || 24}м
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-brand-light">
                  Серия {ep.episodeNumber}
                </span>
                <h4 className="text-xs font-bold text-white truncate">{ep.name}</h4>
                {ep.overview && (
                  <p className="text-[11px] text-cinema-muted line-clamp-2 mt-0.5">
                    {ep.overview}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Pagination Controls for convenience after scrolling 50 episodes */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-cinema-border/50">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cinema-card hover:bg-cinema-surface border border-cinema-border text-xs font-bold text-white disabled:opacity-35 disabled:pointer-events-none transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Предыдущие 50 серий</span>
          </button>

          <span className="text-xs text-cinema-muted font-medium">
            Страница {safePage + 1} из {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cinema-card hover:bg-cinema-surface border border-cinema-border text-xs font-bold text-white disabled:opacity-35 disabled:pointer-events-none transition-all"
          >
            <span>Следующие 50 серий</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

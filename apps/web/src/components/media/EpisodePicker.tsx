'use client';

import React from 'react';
import { Season, Episode } from '@cinemaflow/types';
import { Play } from 'lucide-react';

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
  if (!seasons || seasons.length === 0) return null;

  const currentSeason =
    seasons.find((s) => s.seasonNumber === activeSeason) || seasons[0];
  const episodes = currentSeason.episodes || [];

  return (
    <div className="py-4 space-y-4">
      {/* Seasons Tab Selector */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {seasons.map((season) => {
          const isSelected = season.seasonNumber === activeSeason;
          return (
            <button
              key={season.id}
              data-nav-item="true"
              onClick={() => onSelectSeason(season.seasonNumber)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                isSelected
                  ? 'bg-brand-main text-white shadow-brand-glow'
                  : 'bg-cinema-card hover:bg-cinema-surface text-cinema-muted hover:text-white border border-cinema-border'
              }`}
            >
              {season.name}
            </button>
          );
        })}
      </div>

      {/* Episodes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {episodes.map((ep) => {
          const isSelected =
            ep.seasonNumber === activeSeason && ep.episodeNumber === activeEpisode;
          return (
            <button
              key={ep.id}
              data-nav-item="true"
              onClick={() => onSelectEpisode(ep.seasonNumber, ep.episodeNumber)}
              className={`flex items-start space-x-3 p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-cinema-card border-brand-main shadow-brand-glow'
                  : 'bg-cinema-surface border-cinema-border/60 hover:bg-cinema-card hover:border-cinema-border'
              }`}
            >
              <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-cinema-dark flex-shrink-0 flex items-center justify-center">
                {ep.stillPath ? (
                  <img
                    src={ep.stillPath}
                    alt={ep.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Play className="w-5 h-5 text-cinema-muted" />
                )}
                <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-cinema-dark/80 rounded text-[9px] font-mono text-white">
                  {ep.durationMinutes || 45}м
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
    </div>
  );
}

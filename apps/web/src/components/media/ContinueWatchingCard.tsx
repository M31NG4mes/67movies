'use client';

import React from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { MediaItem } from '@cinemaflow/types';

interface ContinueWatchingCardProps {
  media: MediaItem;
  seasonNumber?: number;
  episodeNumber?: number;
  percentage: number;
  remainingMinutes?: number;
}

export function ContinueWatchingCard({
  media,
  seasonNumber,
  episodeNumber,
  percentage,
  remainingMinutes = 25,
}: ContinueWatchingCardProps) {
  const backdrop =
    media.backdropPath ||
    media.posterPath ||
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80';

  const isEpisode = seasonNumber !== undefined && episodeNumber !== undefined;
  const watchUrl = isEpisode
    ? `/watch/${media.id}?season=${seasonNumber}&episode=${episodeNumber}`
    : `/watch/${media.id}`;

  return (
    <Link
      href={watchUrl}
      data-nav-item="true"
      className="group relative flex-none w-64 sm:w-72 md:w-80 rounded-xl overflow-hidden bg-cinema-card border border-cinema-border hover:border-brand-main/60 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-brand-glow focus:outline-none"
    >
      {/* Thumbnail Aspect 16:9 */}
      <div className="aspect-[16/9] w-full overflow-hidden bg-cinema-surface relative">
        <img
          src={backdrop}
          alt={media.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Dark Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-cinema-dark/90 via-transparent to-transparent" />

        {/* Center Play Button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-12 h-12 rounded-full bg-brand-main flex items-center justify-center shadow-brand-glow">
            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
          </div>
        </div>

        {/* Season & Episode Badge */}
        {isEpisode && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-cinema-dark/80 backdrop-blur-md rounded text-[11px] font-bold text-brand-light border border-brand-main/30">
            С{seasonNumber} Э{episodeNumber}
          </div>
        )}

        {/* Time Left Badge */}
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-cinema-dark/80 backdrop-blur-md rounded text-[11px] font-medium text-cinema-muted">
          Осталось {remainingMinutes} мин
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-cinema-border relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-main to-brand-light"
          style={{ width: `${Math.max(8, percentage)}%` }}
        />
      </div>

      {/* Metadata */}
      <div className="p-3.5">
        <h3 className="text-sm font-bold text-cinema-text truncate group-hover:text-brand-light transition-colors">
          {media.title}
        </h3>
        <p className="text-xs text-cinema-muted mt-1 truncate">
          {isEpisode ? `Сезон ${seasonNumber}, Эпизод ${episodeNumber}` : media.genres?.[0]?.name || 'Фильм'}
        </p>
      </div>
    </Link>
  );
}

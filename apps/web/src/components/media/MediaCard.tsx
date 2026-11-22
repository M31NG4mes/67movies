'use client';

import React from 'react';
import Link from 'next/link';
import { MediaItem } from '@cinemaflow/types';
import { usePreferencesStore } from '../../stores/preferences.store';

interface MediaCardProps {
  media: MediaItem;
  fluid?: boolean;
}

function MediaCardInner({ media, fluid = false }: MediaCardProps) {
  const ageVerified18 = usePreferencesStore((s) => s.ageVerified18);
  const poster =
    media.posterPath ||
    media.backdropPath ||
    'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg';

  const is18Plus =
    media.ageRating === '18+' ||
    media.ageRating === 'R' ||
    media.ageRating === 'NC-17' ||
    media.ageRating === 'TV-MA' ||
    Boolean((media as any).adult);

  const targetId = media.tmdbId || media.id;
  const targetType = media.type === 'tv' ? 'tv' : 'movie';

  return (
    <Link
      href={`/movie/${targetId}?type=${targetType}`}
      className={`group relative block rounded-2xl overflow-hidden bg-[#181821] brand-card-hover focus:outline-none ${
        fluid ? 'w-full' : 'flex-none w-36 sm:w-44 md:w-48'
      }`}
    >
      <div className="aspect-[2/3] w-full relative overflow-hidden">
        <img
          src={poster}
          alt={media.title}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 ${
            is18Plus && !ageVerified18 ? 'blur-md scale-105 brightness-75' : ''
          }`}
        />

        {/* 18+ Age Badge */}
        {is18Plus && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-red-600/90 text-[10px] font-black text-white border border-red-400/50 shadow-md hero-keep-white">
            18+
          </div>
        )}

        {/* Subtle Rating Pill */}
        {media.voteAverage > 0 && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-bold hero-keep-white border border-white/10">
            <span className="text-[#A18BFF]">★</span> {Number(media.voteAverage).toFixed(1)}
          </div>
        )}

        {/* Smooth Title Overlay (always visible on mobile, hover reveal on desktop) */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/95 via-black/55 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5 sm:p-3 hero-keep-white">
          <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">
            {media.title}
          </h3>
          <div className="flex items-center justify-between text-[11px] text-white/75 mt-1">
            <span>{media.releaseYear || ''}</span>
            <span className="uppercase tracking-wider text-[10px]">
              {targetType === 'tv' ? 'Сериал' : 'Фильм'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export const MediaCard = React.memo(MediaCardInner);

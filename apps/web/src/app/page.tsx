'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { HeroBanner } from '../components/media/HeroBanner';
import { MediaRail } from '../components/media/MediaRail';
import { T } from '../components/common/T';
import { MediaItem } from '@cinemaflow/types';

export default function HomePage() {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [popularSeries, setPopularSeries] = useState<MediaItem[]>([]);
  const [newMovies, setNewMovies] = useState<MediaItem[]>([]);
  const [newSeries, setNewSeries] = useState<MediaItem[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.media.getTrending('all', 'day', 1).catch(() => null),
      api.media.getPopularMovies(1).catch(() => null),
      api.media.getPopularTv(1).catch(() => null),
      api.media.getNewMovies(1).catch(() => null),
      api.media.getNewTv(1).catch(() => null),
    ]).then(([trendingRes, popMoviesRes, popTvRes, newMoviesRes, newTvRes]) => {
      if (!mounted) return;
      if (trendingRes?.items?.length) setTrending(trendingRes.items);
      if (popMoviesRes?.items?.length) setPopularMovies(popMoviesRes.items);
      if (popTvRes?.items?.length) setPopularSeries(popTvRes.items);
      if (newMoviesRes?.items?.length) setNewMovies(newMoviesRes.items);
      if (newTvRes?.items?.length) setNewSeries(newTvRes.items);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const heroItems: MediaItem[] = (
    trending.length >= 5
      ? trending
      : [...trending, ...popularMovies, ...popularSeries]
  ).filter((item: MediaItem) => Boolean(item.backdropPath || item.posterPath));

  const editorsChoice = [...popularMovies, ...popularSeries]
    .filter((item) => item.voteAverage >= 7.0)
    .sort((a, b) => b.voteAverage - a.voteAverage)
    .slice(0, 12);

  return (
    <div className="pb-20 bg-[#09090D] min-h-screen">
      {/* Full-bleed Hero */}
      <HeroBanner items={heroItems} />

      {/* First rail tucked into hero bottom fade */}
      <div className="relative -mt-10 sm:-mt-20 md:-mt-24 z-20 space-y-4 sm:space-y-5">
        <MediaRail title={<T k="popularMovies" />} items={popularMovies} />
        <MediaRail title={<T k="newMovies" />} items={newMovies} />
        <MediaRail title={<T k="popularSeries" />} items={popularSeries} />
        <MediaRail title={<T k="editorsChoice" />} items={editorsChoice} />
        <MediaRail title={<T k="newSeries" />} items={newSeries} />
      </div>
    </div>
  );
}

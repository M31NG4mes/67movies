import React from 'react';
import { api } from '../lib/api-client';
import { HeroBanner } from '../components/media/HeroBanner';
import { MediaRail } from '../components/media/MediaRail';
import { T } from '../components/common/T';
import { mockMoviesCatalog, mockSeriesCatalog } from '../lib/catalog-data';
import { MediaItem } from '@cinemaflow/types';

export const revalidate = 60;

export default async function HomePage() {
  const [
    trendingRes,
    popularMoviesRes,
    popularTvRes,
    newMoviesRes,
    newTvRes,
  ] = await Promise.all([
    api.media.getTrending('all', 'day', 1).catch(() => null),
    api.media.getPopularMovies(1).catch(() => null),
    api.media.getPopularTv(1).catch(() => null),
    api.media.getNewMovies(1).catch(() => null),
    api.media.getNewTv(1).catch(() => null),
  ]);

  const trending = trendingRes?.items?.length ? trendingRes.items : mockMoviesCatalog;
  const popularMovies = popularMoviesRes?.items?.length ? popularMoviesRes.items : mockMoviesCatalog;
  const popularSeries = popularTvRes?.items?.length ? popularTvRes.items : mockSeriesCatalog;
  const newMovies = newMoviesRes?.items?.length ? newMoviesRes.items : mockMoviesCatalog.slice(0, 6);
  const newSeries = newTvRes?.items?.length ? newTvRes.items : mockSeriesCatalog;

  const heroItems: MediaItem[] = (
    trending.length >= 5
      ? trending
      : [...trending, ...popularMovies, ...popularSeries]
  ).filter((item: MediaItem) => Boolean(item.backdropPath || item.posterPath));

  const editorsChoice = [...popularMovies, ...popularSeries]
    .filter((item) => item.voteAverage >= 7.6)
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

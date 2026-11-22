import React from 'react';
import Link from 'next/link';
import { api } from '../../lib/api-client';
import { MediaCard } from '../../components/media/MediaCard';
import {
  CatalogCategory,
  CatalogFilters,
  CatalogSort,
} from '../../components/media/CatalogFilters';
import { mockMoviesCatalog, mockSeriesCatalog } from '../../lib/catalog-data';
import { Genre, MediaType } from '@cinemaflow/types';

interface CatalogPageProps {
  searchParams?: {
    type?: MediaType;
    category?: string;
    genre?: string;
    sort?: string;
    yearFrom?: string;
    yearTo?: string;
    minRating?: string;
    lang?: string;
    page?: string;
  };
}

const VALID_CATEGORIES: CatalogCategory[] = [
  'movie',
  'tv',
  'cartoons',
  'anime',
  'documentary',
  'dorama',
];

const CATEGORY_TITLES: Record<CatalogCategory, string> = {
  movie: 'Фильмы',
  tv: 'Сериалы',
  cartoons: 'Мультфильмы',
  anime: 'Аниме',
  documentary: 'Документальное кино',
  dorama: 'Дорамы',
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const rawCategory = searchParams?.category || searchParams?.type || 'movie';
  const category: CatalogCategory = VALID_CATEGORIES.includes(rawCategory as CatalogCategory)
    ? (rawCategory as CatalogCategory)
    : 'movie';

  const isTv = category === 'tv' || category === 'anime' || category === 'dorama';
  const resolvedType: MediaType = isTv ? 'tv' : 'movie';

  const activeGenreId = searchParams?.genre ? parseInt(searchParams.genre, 10) || 0 : 0;
  const activeSort: CatalogSort =
    searchParams?.sort === 'rating' ||
    searchParams?.sort === 'date' ||
    searchParams?.sort === 'votes'
      ? searchParams.sort
      : 'popularity';

  const yearFrom = searchParams?.yearFrom ? parseInt(searchParams.yearFrom, 10) || undefined : undefined;
  const yearTo = searchParams?.yearTo ? parseInt(searchParams.yearTo, 10) || undefined : undefined;
  const minRating = searchParams?.minRating
    ? parseFloat(searchParams.minRating) || undefined
    : undefined;
  const lang = searchParams?.lang || '';
  const page = Math.max(1, parseInt(searchParams?.page || '1', 10) || 1);

  const [mediaRes, genresRes] = await Promise.all([
    api.media
      .discoverByGenre(resolvedType, activeGenreId, page, activeSort, {
        category,
        yearFrom,
        yearTo,
        minRating,
        lang: lang || undefined,
      })
      .catch(() => null),
    api.media.getGenres(resolvedType).catch(() => []),
  ]);

  const items = mediaRes?.items?.length
    ? mediaRes.items
    : isTv
    ? mockSeriesCatalog
    : mockMoviesCatalog;

  const totalPages = mediaRes?.totalPages || 1;
  const genres: Genre[] = [{ id: 0, name: 'Все жанры' }, ...((genresRes as Genre[]) || [])];
  const activeGenreName =
    activeGenreId > 0 ? genres.find((g) => g.id === activeGenreId)?.name : null;

  const buildPageUrl = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (category !== 'movie') sp.set('category', category);
    if (activeGenreId > 0) sp.set('genre', String(activeGenreId));
    if (activeSort !== 'popularity') sp.set('sort', activeSort);
    if (yearFrom) sp.set('yearFrom', String(yearFrom));
    if (yearTo) sp.set('yearTo', String(yearTo));
    if (minRating) sp.set('minRating', String(minRating));
    if (lang) sp.set('lang', lang);
    if (targetPage > 1) sp.set('page', String(targetPage));
    const qs = sp.toString();
    return qs ? `/catalog?${qs}` : '/catalog';
  };

  return (
    <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10 pt-20 md:pt-12 pb-24 bg-[#09090D] min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          {CATEGORY_TITLES[category]}
          {activeGenreName ? ` — ${activeGenreName}` : ''}
        </h1>
        <p className="text-xs sm:text-sm text-[#92929F] mt-1">
          {[
            yearFrom || yearTo ? `Годы: ${yearFrom || '…'}–${yearTo || '…'}` : null,
            minRating ? `Рейтинг от ${minRating}` : null,
            `Страница ${page}`,
          ]
            .filter(Boolean)
            .join(' • ')}
        </p>
      </div>

      {/* Categories + Expandable Advanced Filters */}
      <CatalogFilters
        genres={genres}
        initial={{
          category,
          genre: activeGenreId,
          sort: activeSort,
          yearFrom: yearFrom ? String(yearFrom) : '',
          yearTo: yearTo ? String(yearTo) : '',
          minRating: minRating ? String(minRating) : '',
          lang,
        }}
      />

      {/* Media Grid */}
      {items.length === 0 ? (
        <div className="text-center py-20 bg-[#181821] border border-[#292936] rounded-2xl p-8 max-w-xl mx-auto">
          <p className="text-lg font-semibold text-white">Ничего не найдено</p>
          <p className="text-sm text-[#92929F] mt-2">
            Попробуйте ослабить фильтры по годам или минимальному рейтингу.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 animate-fadeIn">
          {items.map((item) => (
            <MediaCard key={item.id} media={item} fluid />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-12">
          {page > 1 && (
            <Link
              href={buildPageUrl(page - 1)}
              className="px-5 py-2.5 rounded-xl bg-[#181821] hover:bg-[#20202C] border border-[#292936] hover:border-[#8065FF] text-sm font-semibold text-white transition-all"
            >
              ← Назад
            </Link>
          )}
          <span className="px-4 py-2 text-xs font-semibold text-[#92929F]">
            Страница {page} из {Math.min(totalPages, 500)}
          </span>
          {page < Math.min(totalPages, 500) && (
            <Link
              href={buildPageUrl(page + 1)}
              className="px-5 py-2.5 rounded-xl brand-btn text-sm font-semibold text-white"
            >
              Вперёд →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

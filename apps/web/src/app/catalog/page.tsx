import React from 'react';
import Link from 'next/link';
import { api } from '../../lib/api-client';
import { MediaCard } from '../../components/media/MediaCard';
import { T } from '../../components/common/T';
import {
  CatalogCategory,
  CatalogFilters,
  CatalogSort,
} from '../../components/media/CatalogFilters';
import { mockMoviesCatalog, mockSeriesCatalog } from '../../lib/catalog-data';
import { Genre, MediaItem, MediaType } from '@cinemaflow/types';

interface CatalogPageProps {
  searchParams?: {
    type?: MediaType;
    category?: string;
    genre?: string;
    genres?: string;
    sort?: string;
    yearFrom?: string;
    yearTo?: string;
    minRating?: string;
    lang?: string;
    q?: string;
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

export const dynamic = 'force-dynamic';

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const rawCategory = searchParams?.category || searchParams?.type || 'movie';
  const category: CatalogCategory = VALID_CATEGORIES.includes(rawCategory as CatalogCategory)
    ? (rawCategory as CatalogCategory)
    : 'movie';

  const isTv = category === 'tv' || category === 'anime' || category === 'dorama';
  const resolvedType: MediaType = isTv ? 'tv' : 'movie';

  const activeGenreIds = Array.from(
    new Set(
      [searchParams?.genres, searchParams?.genre]
        .filter(Boolean)
        .flatMap((v) => String(v).split(','))
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  );
  const activeGenreId = activeGenreIds[0] || 0;
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
  const q = category === 'anime' ? (searchParams?.q || '').trim().slice(0, 120) : '';
  const page = Math.max(1, parseInt(searchParams?.page || '1', 10) || 1);

  const [mediaRes, genresRes] = await Promise.all([
    api.media
      .discoverByGenre(resolvedType, activeGenreId, page, activeSort, {
        category,
        genreIds: activeGenreIds.length > 0 ? activeGenreIds : undefined,
        yearFrom,
        yearTo,
        minRating,
        lang: lang || undefined,
        q: q || undefined,
      })
      .catch(() => null),
    api.media.getGenres(resolvedType, category).catch(() => []),
  ]);

  const hasActiveFilters = Boolean(
    activeGenreIds.length > 0 || yearFrom || yearTo || minRating || lang || q
  );
  const items = mediaRes?.items?.length
    ? mediaRes.items
    : hasActiveFilters || category === 'anime'
    ? []
    : isTv
    ? mockSeriesCatalog
    : mockMoviesCatalog;

  const totalPages = mediaRes?.totalPages || 1;
  const genres: Genre[] = [{ id: 0, name: 'Все жанры' }, ...((genresRes as Genre[]) || [])];
  const activeGenreNames = activeGenreIds
    .map((gid) => genres.find((g) => g.id === gid)?.name)
    .filter(Boolean)
    .join(', ');

  const buildPageUrl = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (category !== 'movie') sp.set('category', category);
    if (activeGenreIds.length > 0) sp.set('genres', activeGenreIds.join(','));
    if (activeSort !== 'popularity') sp.set('sort', activeSort);
    if (yearFrom) sp.set('yearFrom', String(yearFrom));
    if (yearTo) sp.set('yearTo', String(yearTo));
    if (minRating) sp.set('minRating', String(minRating));
    if (lang) sp.set('lang', lang);
    if (q) sp.set('q', q);
    if (targetPage > 1) sp.set('page', String(targetPage));
    const qs = sp.toString();
    return qs ? `/catalog?${qs}` : '/catalog';
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-8 lg:px-10 pt-16 md:pt-14 pb-16 bg-[#09090D] min-h-screen overflow-x-hidden">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight truncate">
          {CATEGORY_TITLES[category]}
          {activeGenreNames ? ` — ${activeGenreNames}` : ''}
        </h1>
        <p className="text-xs sm:text-sm text-[#92929F] mt-1">
          {[
            q ? `Поиск: «${q}»` : null,
            mediaRes?.totalItems ? `Найдено: ${mediaRes.totalItems.toLocaleString('ru-RU')}` : null,
            yearFrom || yearTo ? `Годы: ${yearFrom || '…'}–${yearTo || '…'}` : null,
            minRating ? `Рейтинг от ${minRating}` : null,
            `Показано: ${items.length}`,
            `Страница ${page}`,
          ]
            .filter(Boolean)
            .join(' • ')}
        </p>
      </div>

      {/* Categories + Expandable Advanced Filters (Bottom Sheet on Mobile) */}
      <CatalogFilters
        genres={genres}
        initial={{
          category,
          genres: activeGenreIds,
          sort: activeSort,
          yearFrom: yearFrom ? String(yearFrom) : '',
          yearTo: yearTo ? String(yearTo) : '',
          minRating: minRating ? String(minRating) : '',
          lang,
          q,
        }}
      />

      {/* Media Grid */}
      {items.length === 0 ? (
        <div className="text-center py-14 sm:py-20 bg-[#181821] border border-[#292936] rounded-2xl p-6 sm:p-8 max-w-xl mx-auto space-y-4">
          <p className="text-base sm:text-lg font-bold text-white">
            <T k="nothingFound" />
          </p>
          <p className="text-xs sm:text-sm text-[#92929F]">
            <T k="tryRelaxFilters" />
          </p>
          <Link
            href={category !== 'movie' ? `/catalog?category=${category}` : '/catalog'}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl brand-btn text-white text-xs font-bold"
          >
            Сбросить фильтры
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4 animate-fadeIn">
          {items.map((item: MediaItem) => (
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
              ← <T k="prevPage" />
            </Link>
          )}
          <span className="px-4 py-2 text-xs font-semibold text-[#92929F]">
            <T k="pageLabel" /> {page} <T k="ofLabel" /> {Math.min(totalPages, 500)}
          </span>
          {page < Math.min(totalPages, 500) && (
            <Link
              href={buildPageUrl(page + 1)}
              className="px-5 py-2.5 rounded-xl brand-btn text-sm font-semibold text-white"
            >
              <T k="nextPage" /> →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

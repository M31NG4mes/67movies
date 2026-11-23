import React from 'react';
import Link from 'next/link';
import { api } from '../../lib/api-client';
import { MediaCard } from '../../components/media/MediaCard';
import { T } from '../../components/common/T';
import {
  CatalogCategory,
  CatalogFilterState,
  CatalogRuntime,
  CatalogSidebarFilters,
  CatalogSort,
  CatalogTopBar,
} from '../../components/media/CatalogFilters';
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
    countries?: string;
    runtime?: string;
    q?: string;
    page?: string;
  };
}

const VALID_CATEGORIES: CatalogCategory[] = [
  'all',
  'movie',
  'tv',
  'cartoons',
  'anime',
  'documentary',
  'dorama',
];

const VALID_SORTS: CatalogSort[] = [
  'popularity',
  'rating',
  'date',
  'date_asc',
  'title_asc',
  'title_desc',
];

const CATEGORY_TITLES: Record<CatalogCategory, string> = {
  all: 'Весь каталог',
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

  const activeSort: CatalogSort = VALID_SORTS.includes(searchParams?.sort as CatalogSort)
    ? (searchParams?.sort as CatalogSort)
    : 'popularity';

  const yearFrom = searchParams?.yearFrom ? parseInt(searchParams.yearFrom, 10) || undefined : undefined;
  const yearTo = searchParams?.yearTo ? parseInt(searchParams.yearTo, 10) || undefined : undefined;
  const minRating = searchParams?.minRating
    ? parseFloat(searchParams.minRating) || undefined
    : undefined;
  const activeCountries = Array.from(
    new Set(
      String(searchParams?.countries || '')
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z]{2}$/.test(s))
    )
  );
  const activeRuntime: CatalogRuntime =
    searchParams?.runtime === 'short' ||
    searchParams?.runtime === 'medium' ||
    searchParams?.runtime === 'long'
      ? searchParams.runtime
      : '';
  const q = category === 'anime' ? (searchParams?.q || '').trim().slice(0, 120) : '';
  const page = Math.max(1, parseInt(searchParams?.page || '1', 10) || 1);

  const extraOpts = {
    category: category === 'all' ? undefined : category,
    genreIds: activeGenreIds.length > 0 ? activeGenreIds : undefined,
    yearFrom,
    yearTo,
    minRating,
    countries: activeCountries.length > 0 ? activeCountries : undefined,
    runtime: activeRuntime || undefined,
    q: q || undefined,
  };

  let mediaRes: { items: MediaItem[]; totalPages: number; totalItems: number } | null = null;
  let genresRes: Genre[] = [];

  if (category === 'all') {
    const [movieRes, tvRes, movieGenres, tvGenres] = await Promise.all([
      api.media
        .discoverByGenre('movie', activeGenreId, page, activeSort, {
          ...extraOpts,
          category: 'movie',
        })
        .catch(() => null),
      api.media
        .discoverByGenre('tv', activeGenreId, page, activeSort, {
          ...extraOpts,
          category: 'tv',
        })
        .catch(() => null),
      api.media.getGenres('movie', 'movie').catch(() => []),
      api.media.getGenres('tv', 'tv').catch(() => []),
    ]);

    const combined = [...(movieRes?.items || []), ...(tvRes?.items || [])];
    const seen = new Set<string>();
    const deduped = combined.filter((item) => {
      const key = `${item.type}:${item.tmdbId || item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (activeSort === 'rating') {
      deduped.sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));
    } else if (activeSort === 'date') {
      deduped.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
    } else if (activeSort === 'date_asc') {
      deduped.sort((a, b) => (a.releaseYear || 9999) - (b.releaseYear || 9999));
    } else if (activeSort === 'title_asc') {
      deduped.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    } else if (activeSort === 'title_desc') {
      deduped.sort((a, b) => b.title.localeCompare(a.title, 'ru'));
    }

    mediaRes = {
      items: deduped.slice(0, 48),
      totalPages: Math.max(movieRes?.totalPages || 1, tvRes?.totalPages || 1),
      totalItems: (movieRes?.totalItems || 0) + (tvRes?.totalItems || 0),
    };

    const genreMap = new Map<number, Genre>();
    for (const g of [...(movieGenres || []), ...(tvGenres || [])]) {
      if (g?.id && !genreMap.has(g.id)) genreMap.set(g.id, g);
    }
    genresRes = Array.from(genreMap.values());
  } else {
    const [res, gRes] = await Promise.all([
      api.media
        .discoverByGenre(resolvedType, activeGenreId, page, activeSort, extraOpts)
        .catch(() => null),
      api.media.getGenres(resolvedType, category).catch(() => []),
    ]);
    mediaRes = res;
    genresRes = (gRes as Genre[]) || [];
  }

  const items = mediaRes?.items || [];
  const totalPages = mediaRes?.totalPages || 1;
  const genres: Genre[] = [{ id: 0, name: 'Все жанры' }, ...genresRes];
  const activeGenreNames = activeGenreIds
    .map((gid) => genres.find((g) => g.id === gid)?.name)
    .filter(Boolean)
    .join(', ');

  // Derive available years dynamically from catalog items + recent release years
  const yearSet = new Set<number>([2026, 2025, 2024, 2023, 2022, 2021, 2020]);
  for (const item of items) {
    if (item.releaseYear && item.releaseYear >= 1950 && item.releaseYear <= 2026) {
      yearSet.add(item.releaseYear);
    }
  }
  const availableYears = Array.from(yearSet).sort((a, b) => b - a);

  const filterState: CatalogFilterState = {
    category,
    genres: activeGenreIds,
    sort: activeSort,
    yearFrom: yearFrom ? String(yearFrom) : '',
    yearTo: yearTo ? String(yearTo) : '',
    minRating: minRating ? String(minRating) : '',
    countries: activeCountries,
    runtime: activeRuntime,
    q,
  };

  const buildPageUrl = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (category !== 'movie') sp.set('category', category);
    if (activeGenreIds.length > 0) sp.set('genres', activeGenreIds.join(','));
    if (activeSort !== 'popularity') sp.set('sort', activeSort);
    if (yearFrom) sp.set('yearFrom', String(yearFrom));
    if (yearTo) sp.set('yearTo', String(yearTo));
    if (minRating) sp.set('minRating', String(minRating));
    if (activeCountries.length > 0 && category !== 'anime') {
      sp.set('countries', activeCountries.join(','));
    }
    if (activeRuntime && category !== 'anime') sp.set('runtime', activeRuntime);
    if (q) sp.set('q', q);
    if (targetPage > 1) sp.set('page', String(targetPage));
    const qs = sp.toString();
    return qs ? `/catalog?${qs}` : '/catalog';
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-8 lg:px-10 pt-16 md:pt-14 pb-16 bg-[#09090D] min-h-screen overflow-x-clip">
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

      {/* Two-Column Layout on Desktop (~75% Catalog Left, ~25% Sticky Filters Right) */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Left: Sort Bar + Cards Grid + Pagination */}
        <div className="flex-1 min-w-0 w-full">
          <CatalogTopBar
            initial={filterState}
            genres={genres}
            availableYears={availableYears}
          />

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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 animate-fadeIn">
              {items.map((item: MediaItem) => (
                <MediaCard key={`${item.type}-${item.id}`} media={item} fluid />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10 sm:mt-12">
              {page > 1 && (
                <Link
                  href={buildPageUrl(page - 1)}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#181821] hover:bg-[#20202C] border border-[#292936] hover:border-[#8065FF] text-xs sm:text-sm font-semibold text-white transition-all"
                >
                  ← <T k="prevPage" />
                </Link>
              )}
              <span className="px-3 sm:px-4 py-2 text-xs font-semibold text-[#92929F]">
                <T k="pageLabel" /> {page} <T k="ofLabel" /> {Math.min(totalPages, 500)}
              </span>
              {page < Math.min(totalPages, 500) && (
                <Link
                  href={buildPageUrl(page + 1)}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl brand-btn text-xs sm:text-sm font-semibold text-white"
                >
                  <T k="nextPage" /> →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right: Persistent Sticky Filters Sidebar (Desktop lg+) */}
        <CatalogSidebarFilters
          initial={filterState}
          genres={genres}
          availableYears={availableYears}
        />
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, X, RotateCcw, Check, Star, Calendar, Globe, ArrowUpDown } from 'lucide-react';
import { Genre } from '@cinemaflow/types';

export type CatalogCategory = 'movie' | 'tv' | 'cartoons' | 'anime' | 'documentary' | 'dorama';
export type CatalogSort = 'popularity' | 'rating' | 'date' | 'votes';

export interface CatalogFilterState {
  category: CatalogCategory;
  genre: number;
  sort: CatalogSort;
  yearFrom: string;
  yearTo: string;
  minRating: string;
  lang: string;
}

const CATEGORIES: Array<{ id: CatalogCategory; label: string }> = [
  { id: 'movie', label: 'Фильмы' },
  { id: 'tv', label: 'Сериалы' },
  { id: 'cartoons', label: 'Мультфильмы' },
  { id: 'anime', label: 'Аниме' },
  { id: 'documentary', label: 'Документалки' },
  { id: 'dorama', label: 'Дорамы' },
];

const YEAR_PRESETS = [
  { label: '2025–2026', from: '2025', to: '2026' },
  { label: '2020-е', from: '2020', to: '2026' },
  { label: '2010-е', from: '2010', to: '2019' },
  { label: '2000-е', from: '2000', to: '2009' },
  { label: '90-е', from: '1990', to: '1999' },
  { label: 'Классика', from: '1950', to: '1989' },
];

const RATING_OPTIONS = [
  { value: '', label: 'Любой' },
  { value: '6', label: '6+' },
  { value: '7', label: '7+' },
  { value: '7.5', label: '7.5+' },
  { value: '8', label: '8+' },
  { value: '8.5', label: '8.5+' },
];

const LANG_OPTIONS = [
  { value: '', label: 'Любая страна' },
  { value: 'en', label: 'США / Великобритания' },
  { value: 'ru', label: 'Россия' },
  { value: 'ja', label: 'Япония' },
  { value: 'ko', label: 'Южная Корея' },
  { value: 'fr', label: 'Франция' },
  { value: 'es', label: 'Испания' },
  { value: 'tr', label: 'Турция' },
];

const SORT_OPTIONS: Array<{ value: CatalogSort; label: string }> = [
  { value: 'popularity', label: 'По популярности' },
  { value: 'rating', label: 'По рейтингу' },
  { value: 'date', label: 'По дате выхода' },
  { value: 'votes', label: 'По числу оценок' },
];

interface CatalogFiltersProps {
  initial: CatalogFilterState;
  genres: Genre[];
}

export function CatalogFilters({ initial, genres }: CatalogFiltersProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const [category, setCategory] = useState<CatalogCategory>(initial.category);
  const [genre, setGenre] = useState<number>(initial.genre);
  const [sort, setSort] = useState<CatalogSort>(initial.sort);
  const [yearFrom, setYearFrom] = useState<string>(initial.yearFrom);
  const [yearTo, setYearTo] = useState<string>(initial.yearTo);
  const [minRating, setMinRating] = useState<string>(initial.minRating);
  const [lang, setLang] = useState<string>(initial.lang);

  const navigateWith = (next: Partial<CatalogFilterState>) => {
    const merged: CatalogFilterState = {
      category,
      genre,
      sort,
      yearFrom,
      yearTo,
      minRating,
      lang,
      ...next,
    };
    const sp = new URLSearchParams();
    if (merged.category !== 'movie') sp.set('category', merged.category);
    if (merged.genre > 0) sp.set('genre', String(merged.genre));
    if (merged.sort !== 'popularity') sp.set('sort', merged.sort);
    if (merged.yearFrom) sp.set('yearFrom', merged.yearFrom);
    if (merged.yearTo) sp.set('yearTo', merged.yearTo);
    if (merged.minRating) sp.set('minRating', merged.minRating);
    if (merged.lang) sp.set('lang', merged.lang);

    const qs = sp.toString();
    router.push(qs ? `/catalog?${qs}` : '/catalog');
  };

  const activeFiltersCount = [
    initial.genre > 0,
    initial.sort !== 'popularity',
    Boolean(initial.yearFrom || initial.yearTo),
    Boolean(initial.minRating),
    Boolean(initial.lang),
  ].filter(Boolean).length;

  const handleApply = () => {
    setIsOpen(false);
    navigateWith({});
  };

  const handleReset = () => {
    setCategory('movie');
    setGenre(0);
    setSort('popularity');
    setYearFrom('');
    setYearTo('');
    setMinRating('');
    setLang('');
    setIsOpen(false);
    router.push('/catalog');
  };

  return (
    <div className="space-y-4 mb-7">
      {/* Top Row: Category Pills + Dedicated "Фильтры" Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Scrollable Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 -mx-5 px-5 sm:mx-0 sm:px-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = initial.category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategory(cat.id);
                  setGenre(0);
                  navigateWith({ category: cat.id, genre: 0 });
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'brand-btn text-white'
                    : 'bg-[#111119] text-[#92929F] hover:text-white border border-[#292936] hover:border-[#8065FF]/60'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Dedicated Sort Dropdown + Filters Toggle Button */}
        <div className="flex items-center gap-2 shrink-0">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#181821] hover:bg-red-500/15 border border-[#292936] hover:border-red-500/40 text-xs font-semibold text-[#92929F] hover:text-red-300 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Сбросить</span>
            </button>
          )}

          {/* Quick Sort Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsSortOpen(!isSortOpen);
                setIsOpen(false);
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                isSortOpen || initial.sort !== 'popularity'
                  ? 'bg-[#8065FF]/20 border-[#8065FF] text-white'
                  : 'bg-[#111119] border-[#292936] hover:border-[#8065FF] text-white'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#A18BFF]" />
              <span>
                {SORT_OPTIONS.find((o) => o.value === initial.sort)?.label || 'Сортировка'}
              </span>
            </button>

            {isSortOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#111119] border border-[#292936] shadow-2xl p-1.5 z-40 animate-scaleIn">
                {SORT_OPTIONS.map((opt) => {
                  const isActive = initial.sort === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSort(opt.value);
                        setIsSortOpen(false);
                        navigateWith({ sort: opt.value });
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-[#8065FF]/20 text-[#A18BFF]'
                          : 'text-[#92929F] hover:text-white hover:bg-[#181821]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-[#A18BFF]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              setIsSortOpen(false);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
              isOpen || activeFiltersCount > 0
                ? 'bg-[#8065FF]/20 border-[#8065FF] text-white'
                : 'bg-[#111119] border-[#292936] hover:border-[#8065FF] text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-[#A18BFF]" />
            <span>Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#8065FF] text-white text-[10px] font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Advanced Filter Panel */}
      {isOpen && (
        <div className="p-5 sm:p-6 rounded-2xl bg-[#111119] border border-[#292936] shadow-2xl space-y-6 animate-scaleIn">
          <div className="flex items-center justify-between border-b border-[#292936] pb-3.5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#A18BFF]" />
              <span>Расширенные фильтры каталога</span>
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-[#92929F] hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Sort */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#92929F] flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-[#A18BFF]" />
                <span>Сортировка</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSort(opt.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                      sort === opt.value
                        ? 'bg-[#8065FF]/20 border-[#8065FF] text-white'
                        : 'bg-[#181821] border-[#292936] text-[#92929F] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Min Rating */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#92929F] flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-[#A18BFF]" />
                <span>Минимальный рейтинг</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {RATING_OPTIONS.map((r) => (
                  <button
                    key={r.value || 'any'}
                    type="button"
                    onClick={() => setMinRating(r.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      minRating === r.value
                        ? 'bg-[#8065FF] border-[#8065FF] text-white'
                        : 'bg-[#181821] border-[#292936] text-[#92929F] hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Country / Language */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#92929F] flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#A18BFF]" />
                <span>Страна / Язык оригинала</span>
              </label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-xs font-semibold text-white focus:outline-none focus:border-[#8065FF]"
              >
                {LANG_OPTIONS.map((l) => (
                  <option key={l.value || 'all'} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Year Range */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#92929F] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#A18BFF]" />
              <span>Год выхода</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1920}
                max={2026}
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                placeholder="От (напр. 2010)"
                className="w-32 px-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
              />
              <span className="text-[#92929F] text-xs">—</span>
              <input
                type="number"
                min={1920}
                max={2026}
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                placeholder="До (напр. 2026)"
                className="w-32 px-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
              />

              <div className="flex flex-wrap gap-1.5 ml-0 sm:ml-2">
                {YEAR_PRESETS.map((p) => {
                  const active = yearFrom === p.from && yearTo === p.to;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setYearFrom(p.from);
                        setYearTo(p.to);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                        active
                          ? 'bg-[#8065FF]/20 border-[#8065FF] text-[#A18BFF]'
                          : 'bg-[#181821] border-[#292936] text-[#92929F] hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5. Genre Pills */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#92929F]">
              Жанр
            </label>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGenre(g.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    genre === g.id
                      ? 'bg-[#8065FF] border-[#8065FF] text-white'
                      : 'bg-[#181821] border-[#292936] text-[#92929F] hover:text-white'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#292936]">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl bg-[#181821] hover:bg-[#20202C] border border-[#292936] text-xs font-semibold text-[#92929F] hover:text-white transition-all"
            >
              Сбросить все
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl brand-btn text-white text-xs font-bold"
            >
              <Check className="w-4 h-4" />
              <span>Применить фильтры</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

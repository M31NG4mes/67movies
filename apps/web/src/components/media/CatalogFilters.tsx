'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  Check,
  Star,
  Calendar,
  Globe,
  ArrowUpDown,
  Film,
  Tv,
  Sparkles,
  Flame,
  BookOpen,
  Heart,
} from 'lucide-react';
import { Genre } from '@cinemaflow/types';
import { TRANSLATIONS, usePreferencesStore } from '../../stores/preferences.store';

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

interface CatalogFiltersProps {
  initial: CatalogFilterState;
  genres: Genre[];
}

export function CatalogFilters({ initial, genres }: CatalogFiltersProps) {
  const router = useRouter();
  const language = usePreferencesStore((s) => s.language);
  const t = TRANSLATIONS[language];
  const isEn = language === 'en';

  const [isOpen, setIsOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const [category, setCategory] = useState<CatalogCategory>(initial.category);
  const [genre, setGenre] = useState<number>(initial.genre);
  const [sort, setSort] = useState<CatalogSort>(initial.sort);
  const [yearFrom, setYearFrom] = useState<string>(initial.yearFrom);
  const [yearTo, setYearTo] = useState<string>(initial.yearTo);
  const [minRating, setMinRating] = useState<string>(initial.minRating);
  const [lang, setLang] = useState<string>(initial.lang);

  const CATEGORIES: Array<{ id: CatalogCategory; label: string; icon: any }> = [
    { id: 'movie', label: t.movies, icon: Film },
    { id: 'tv', label: t.series, icon: Tv },
    { id: 'cartoons', label: t.cartoons, icon: Sparkles },
    { id: 'anime', label: t.anime, icon: Flame },
    { id: 'documentary', label: t.documentary, icon: BookOpen },
    { id: 'dorama', label: t.dorama, icon: Heart },
  ];

  const YEAR_PRESETS = [
    { label: '2025–2026', from: '2025', to: '2026' },
    { label: isEn ? '2020s' : '2020-е', from: '2020', to: '2026' },
    { label: isEn ? '2010s' : '2010-е', from: '2010', to: '2019' },
    { label: isEn ? '2000s' : '2000-е', from: '2000', to: '2009' },
    { label: isEn ? '90s' : '90-е', from: '1990', to: '1999' },
    { label: isEn ? 'Classics' : 'Классика', from: '1950', to: '1989' },
  ];

  const RATING_OPTIONS = [
    { value: '', label: t.anyRating },
    { value: '6', label: '6+' },
    { value: '7', label: '7+' },
    { value: '7.5', label: '7.5+' },
    { value: '8', label: '8+' },
    { value: '8.5', label: '8.5+' },
  ];

  const LANG_OPTIONS = [
    { value: '', label: t.anyCountry },
    { value: 'en', label: isEn ? 'USA / UK' : 'США / Великобритания' },
    { value: 'ru', label: isEn ? 'Russia' : 'Россия' },
    { value: 'ja', label: isEn ? 'Japan' : 'Япония' },
    { value: 'ko', label: isEn ? 'South Korea' : 'Южная Корея' },
    { value: 'fr', label: isEn ? 'France' : 'Франция' },
    { value: 'es', label: isEn ? 'Spain' : 'Испания' },
    { value: 'tr', label: isEn ? 'Turkey' : 'Турция' },
  ];

  const SORT_OPTIONS: Array<{ value: CatalogSort; label: string }> = [
    { value: 'popularity', label: t.sortPopularity },
    { value: 'rating', label: t.sortRating },
    { value: 'date', label: t.sortDate },
    { value: 'votes', label: t.sortVotes },
  ];

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

  // Build visible active chips for quick 1-click clearing
  const activeChips: Array<{ id: string; label: string; onClear: () => void }> = [];
  if (initial.genre > 0) {
    const gName = genres.find((g) => g.id === initial.genre)?.name || `#${initial.genre}`;
    activeChips.push({
      id: 'genre',
      label: gName,
      onClear: () => {
        setGenre(0);
        navigateWith({ genre: 0 });
      },
    });
  }
  if (initial.yearFrom || initial.yearTo) {
    activeChips.push({
      id: 'year',
      label: `${initial.yearFrom || '...'}–${initial.yearTo || '...'}`,
      onClear: () => {
        setYearFrom('');
        setYearTo('');
        navigateWith({ yearFrom: '', yearTo: '' });
      },
    });
  }
  if (initial.minRating) {
    activeChips.push({
      id: 'rating',
      label: `★ ${initial.minRating}+`,
      onClear: () => {
        setMinRating('');
        navigateWith({ minRating: '' });
      },
    });
  }
  if (initial.lang) {
    const lName = LANG_OPTIONS.find((l) => l.value === initial.lang)?.label || initial.lang;
    activeChips.push({
      id: 'lang',
      label: lName,
      onClear: () => {
        setLang('');
        navigateWith({ lang: '' });
      },
    });
  }

  return (
    <div className="space-y-3.5 mb-7">
      {/* Top Row: Category Tabs with Icons + Sort & Filters Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 -mx-5 px-5 lg:mx-0 lg:px-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'brand-btn text-white'
                    : 'bg-[#111119] text-[#92929F] hover:text-white border border-[#292936] hover:border-[#8065FF]/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sort Dropdown + Filters Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#181821] hover:bg-red-500/15 border border-[#292936] hover:border-red-500/40 text-xs font-semibold text-[#92929F] hover:text-red-300 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.reset}</span>
            </button>
          )}

          {/* Quick Sort Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsSortOpen(!isSortOpen);
                setIsOpen(false);
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                isSortOpen || initial.sort !== 'popularity'
                  ? 'bg-[#8065FF]/20 border-[#8065FF] text-white'
                  : 'bg-[#111119] border-[#292936] hover:border-[#8065FF] text-white'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#A18BFF]" />
              <span className="text-[#92929F] font-semibold hidden sm:inline">{t.sortBy}:</span>
              <span>
                {SORT_OPTIONS.find((o) => o.value === initial.sort)?.label || t.sortBy}
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
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${
              isOpen || activeFiltersCount > 0
                ? 'bg-[#8065FF]/20 border-[#8065FF] text-white'
                : 'bg-[#111119] border-[#292936] hover:border-[#8065FF] text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-[#A18BFF]" />
            <span>{t.filters}</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#8065FF] text-white text-[10px] font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active Filter Chips (instant 1-click removal) */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onClear}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8065FF]/15 border border-[#8065FF]/40 text-xs font-semibold text-[#A18BFF] hover:bg-rose-500/15 hover:border-rose-500/40 hover:text-rose-300 transition-all"
            >
              <span>{chip.label}</span>
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Expandable Advanced Filter Panel */}
      {isOpen && (
        <div className="p-5 sm:p-6 rounded-2xl bg-[#111119] border border-[#292936] shadow-2xl space-y-6 animate-scaleIn">
          <div className="flex items-center justify-between border-b border-[#292936] pb-3.5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#A18BFF]" />
              <span>{t.advancedFilters}</span>
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
                <span>{t.sortBy}</span>
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
                <span>{t.minRating}</span>
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
                <span>{t.countryLang}</span>
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
              <span>{t.yearLabel}</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1920}
                max={2026}
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                placeholder={t.yearFrom}
                className="w-32 px-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
              />
              <span className="text-[#92929F] text-xs">—</span>
              <input
                type="number"
                min={1920}
                max={2026}
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                placeholder={t.yearTo}
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
              {t.genres}
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
                  {g.id === 0 ? t.allGenres : g.name}
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
              {t.reset}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl brand-btn text-white text-xs font-bold"
            >
              <Check className="w-4 h-4" />
              <span>{t.applyFilters}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

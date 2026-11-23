'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SlidersHorizontal,
  Search,
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
  Clock,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { Genre } from '@cinemaflow/types';
import { TRANSLATIONS, usePreferencesStore } from '../../stores/preferences.store';

export type CatalogCategory =
  | 'all'
  | 'movie'
  | 'tv'
  | 'cartoons'
  | 'anime'
  | 'documentary'
  | 'dorama';

export type CatalogSort =
  | 'popularity'
  | 'rating'
  | 'date'
  | 'date_asc'
  | 'title_asc'
  | 'title_desc';

export type CatalogRuntime = '' | 'short' | 'medium' | 'long';

export interface CatalogFilterState {
  category: CatalogCategory;
  genres: number[];
  sort: CatalogSort;
  yearFrom: string;
  yearTo: string;
  minRating: string;
  countries: string[];
  runtime: CatalogRuntime;
  q?: string;
}

export const COUNTRY_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'US', label: 'США' },
  { code: 'RU', label: 'Россия' },
  { code: 'GB', label: 'Великобритания' },
  { code: 'JP', label: 'Япония' },
  { code: 'KR', label: 'Южная Корея' },
  { code: 'FR', label: 'Франция' },
  { code: 'DE', label: 'Германия' },
  { code: 'CN', label: 'Китай' },
  { code: 'IN', label: 'Индия' },
  { code: 'CA', label: 'Канада' },
];

export const RUNTIME_OPTIONS: Array<{ value: CatalogRuntime; label: string }> = [
  { value: '', label: 'Любая' },
  { value: 'short', label: 'До 90 мин' },
  { value: 'medium', label: '90–140 мин' },
  { value: 'long', label: 'От 140 мин' },
];

export const RATING_OPTIONS = [
  { value: '', label: 'Любой' },
  { value: '5', label: 'От 5.0' },
  { value: '6', label: 'От 6.0' },
  { value: '7', label: 'От 7.0' },
  { value: '8', label: 'От 8.0' },
  { value: '9', label: 'От 9.0' },
];

export const SORT_OPTIONS: Array<{ value: CatalogSort; label: string; shortLabel: string }> = [
  { value: 'popularity', label: 'По популярности', shortLabel: 'Популярные' },
  { value: 'rating', label: 'По рейтингу', shortLabel: 'По рейтингу' },
  { value: 'date', label: 'По дате (сначала новые)', shortLabel: 'Сначала новые' },
  { value: 'date_asc', label: 'По дате (сначала старые)', shortLabel: 'Сначала старые' },
  { value: 'title_asc', label: 'По названию (А–Я)', shortLabel: 'А–Я' },
  { value: 'title_desc', label: 'По названию (Я–А)', shortLabel: 'Я–А' },
];

function buildCatalogHref(state: CatalogFilterState): string {
  const sp = new URLSearchParams();
  if (state.category !== 'movie') sp.set('category', state.category);
  if (state.genres.length > 0) sp.set('genres', state.genres.join(','));
  if (state.sort !== 'popularity') sp.set('sort', state.sort);
  if (state.yearFrom) sp.set('yearFrom', state.yearFrom);
  if (state.yearTo) sp.set('yearTo', state.yearTo);
  if (state.minRating) sp.set('minRating', state.minRating);
  if (state.countries.length > 0 && state.category !== 'anime') {
    sp.set('countries', state.countries.join(','));
  }
  if (state.runtime && state.category !== 'anime') {
    sp.set('runtime', state.runtime);
  }
  if (state.q && state.category === 'anime') sp.set('q', state.q.trim());

  const qs = sp.toString();
  return qs ? `/catalog?${qs}` : '/catalog';
}

interface FilterBodyProps {
  draft: CatalogFilterState;
  setDraft: React.Dispatch<React.SetStateAction<CatalogFilterState>>;
  genres: Genre[];
  availableYears: number[];
  instantApply?: boolean;
  onInstantCommit: (next: CatalogFilterState) => void;
}

function FilterSections({
  draft,
  setDraft,
  genres,
  availableYears,
  instantApply = false,
  onInstantCommit,
}: FilterBodyProps) {
  const [openSections, setOpenSections] = useState({
    category: true,
    genres: true,
    year: true,
    countries: true,
    rating: true,
    runtime: false,
  });

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const CATEGORIES: Array<{ id: CatalogCategory; label: string; icon: any }> = [
    { id: 'all', label: 'Все', icon: Layers },
    { id: 'movie', label: 'Фильмы', icon: Film },
    { id: 'tv', label: 'Сериалы', icon: Tv },
    { id: 'cartoons', label: 'Мультфильмы', icon: Sparkles },
    { id: 'anime', label: 'Аниме', icon: Flame },
    { id: 'documentary', label: 'Документальные', icon: BookOpen },
    { id: 'dorama', label: 'Дорамы', icon: Heart },
  ];

  const updateField = (patch: Partial<CatalogFilterState>, immediate = instantApply) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      if (immediate) onInstantCommit(next);
      return next;
    });
  };

  // Auto-apply manual year range inputs after short debounce
  useEffect(() => {
    if (!instantApply) return;
    const timer = setTimeout(() => {
      onInstantCommit(draft);
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.yearFrom, draft.yearTo]);

  const toggleGenre = (gid: number) => {
    if (gid === 0) {
      updateField({ genres: [] });
      return;
    }
    const exists = draft.genres.includes(gid);
    const nextGenres = exists
      ? draft.genres.filter((id) => id !== gid)
      : [...draft.genres, gid];
    updateField({ genres: nextGenres });
  };

  const toggleCountry = (code: string) => {
    const exists = draft.countries.includes(code);
    const nextCountries = exists
      ? draft.countries.filter((c) => c !== code)
      : [...draft.countries, code];
    updateField({ countries: nextCountries });
  };

  const quickYears =
    availableYears.length > 0
      ? availableYears.slice(0, 8)
      : [2026, 2025, 2024, 2023, 2022, 2021, 2020];

  const isAnime = draft.category === 'anime';

  return (
    <div className="space-y-4 divide-y divide-[#292936]/70">
      {/* 1. Category */}
      <div>
        <button
          type="button"
          onClick={() => toggleSection('category')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase tracking-wider text-white"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#A18BFF]" />
            <span>Категория</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#92929F] transition-transform ${
              openSections.category ? 'rotate-180' : ''
            }`}
          />
        </button>
        {openSections.category && (
          <div className="grid grid-cols-2 gap-1.5 pt-2.5">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = draft.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    updateField({
                      category: cat.id,
                      genres: cat.id !== draft.category ? [] : draft.genres,
                    })
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-[#8065FF]/20 border-[#8065FF] text-white'
                      : 'bg-[#181821] border-[#292936] text-[#92929F] hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Genres (Multi-select Checkboxes) */}
      <div className="pt-3.5">
        <button
          type="button"
          onClick={() => toggleSection('genres')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase tracking-wider text-white"
        >
          <span className="flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-[#A18BFF]" />
            <span>
              Жанры {draft.genres.length > 0 ? `(${draft.genres.length})` : ''}
            </span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#92929F] transition-transform ${
              openSections.genres ? 'rotate-180' : ''
            }`}
          />
        </button>
        {openSections.genres && (
          <div className="pt-2.5 space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {genres
              .filter((g) => g.id !== 0)
              .map((g) => {
                const checked = draft.genres.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGenre(g.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      checked
                        ? 'bg-[#8065FF]/15 text-white font-semibold'
                        : 'text-[#B8B6C8] hover:bg-[#181821] hover:text-white'
                    }`}
                  >
                    <span className="truncate">{g.name}</span>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                        checked
                          ? 'bg-[#8065FF] border-[#8065FF] text-white'
                          : 'border-[#3A3A4A] bg-[#09090D]'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* 3. Release Year */}
      <div className="pt-3.5">
        <button
          type="button"
          onClick={() => toggleSection('year')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase tracking-wider text-white"
        >
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#A18BFF]" />
            <span>Год выхода</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#92929F] transition-transform ${
              openSections.year ? 'rotate-180' : ''
            }`}
          />
        </button>
        {openSections.year && (
          <div className="pt-2.5 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {quickYears.map((y) => {
                const yStr = String(y);
                const active = draft.yearFrom === yStr && draft.yearTo === yStr;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() =>
                      updateField(
                        active ? { yearFrom: '', yearTo: '' } : { yearFrom: yStr, yearTo: yStr }
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                      active
                        ? 'bg-[#8065FF] border-[#8065FF] text-white'
                        : 'bg-[#181821] border-[#292936] text-[#92929F] hover:text-white'
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1920}
                max={2026}
                value={draft.yearFrom}
                onChange={(e) => updateField({ yearFrom: e.target.value }, false)}
                placeholder="От"
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
              />
              <span className="text-[#92929F] text-xs">—</span>
              <input
                type="number"
                min={1920}
                max={2026}
                value={draft.yearTo}
                onChange={(e) => updateField({ yearTo: e.target.value }, false)}
                placeholder="До"
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. Countries (Multi-select) */}
      {!isAnime && (
        <div className="pt-3.5">
          <button
            type="button"
            onClick={() => toggleSection('countries')}
            className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase tracking-wider text-white"
          >
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#A18BFF]" />
              <span>
                Страна {draft.countries.length > 0 ? `(${draft.countries.length})` : ''}
              </span>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[#92929F] transition-transform ${
                openSections.countries ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openSections.countries && (
            <div className="pt-2.5 space-y-1 max-h-44 overflow-y-auto pr-1">
              {COUNTRY_OPTIONS.map((c) => {
                const checked = draft.countries.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggleCountry(c.code)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      checked
                        ? 'bg-[#8065FF]/15 text-white font-semibold'
                        : 'text-[#B8B6C8] hover:bg-[#181821] hover:text-white'
                    }`}
                  >
                    <span className="truncate">{c.label}</span>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                        checked
                          ? 'bg-[#8065FF] border-[#8065FF] text-white'
                          : 'border-[#3A3A4A] bg-[#09090D]'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Rating */}
      <div className="pt-3.5">
        <button
          type="button"
          onClick={() => toggleSection('rating')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase tracking-wider text-white"
        >
          <span className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-[#A18BFF]" />
            <span>Рейтинг</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#92929F] transition-transform ${
              openSections.rating ? 'rotate-180' : ''
            }`}
          />
        </button>
        {openSections.rating && (
          <div className="flex flex-wrap gap-1.5 pt-2.5">
            {RATING_OPTIONS.map((r) => (
              <button
                key={r.value || 'any'}
                type="button"
                onClick={() => updateField({ minRating: r.value })}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  draft.minRating === r.value
                    ? 'bg-[#8065FF] border-[#8065FF] text-white'
                    : 'bg-[#181821] border-[#292936] text-[#92929F] hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 6. Runtime */}
      {!isAnime && (
        <div className="pt-3.5">
          <button
            type="button"
            onClick={() => toggleSection('runtime')}
            className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase tracking-wider text-white"
          >
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#A18BFF]" />
              <span>Продолжительность</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[#92929F] transition-transform ${
                openSections.runtime ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openSections.runtime && (
            <div className="flex flex-wrap gap-1.5 pt-2.5">
              {RUNTIME_OPTIONS.map((rt) => (
                <button
                  key={rt.value || 'any'}
                  type="button"
                  onClick={() => updateField({ runtime: rt.value })}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    draft.runtime === rt.value
                      ? 'bg-[#8065FF] border-[#8065FF] text-white'
                      : 'bg-[#181821] border-[#292936] text-[#92929F] hover:text-white'
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CatalogFiltersProps {
  initial: CatalogFilterState;
  genres: Genre[];
  availableYears: number[];
}

export function CatalogTopBar({ initial, genres, availableYears }: CatalogFiltersProps) {
  const router = useRouter();
  const language = usePreferencesStore((s) => s.language);
  const t = TRANSLATIONS[language];

  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogFilterState>(initial);

  useEffect(() => {
    setDraft(initial);
  }, [
    initial.category,
    initial.genres.join(','),
    initial.sort,
    initial.yearFrom,
    initial.yearTo,
    initial.minRating,
    initial.countries.join(','),
    initial.runtime,
    initial.q,
  ]);

  useEffect(() => {
    if (!isMobileSheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileSheetOpen]);

  const commit = (next: CatalogFilterState) => {
    router.push(buildCatalogHref(next), { scroll: false });
  };

  const activeFiltersCount =
    (initial.genres?.length || 0) +
    (initial.yearFrom || initial.yearTo ? 1 : 0) +
    (initial.minRating ? 1 : 0) +
    (initial.countries?.length || 0) +
    (initial.runtime ? 1 : 0) +
    (initial.q ? 1 : 0);

  const draftFiltersCount =
    (draft.genres?.length || 0) +
    (draft.yearFrom || draft.yearTo ? 1 : 0) +
    (draft.minRating ? 1 : 0) +
    (draft.countries?.length || 0) +
    (draft.runtime ? 1 : 0);

  const handleResetAll = () => {
    const clean: CatalogFilterState = {
      category: 'movie',
      genres: [],
      sort: 'popularity',
      yearFrom: '',
      yearTo: '',
      minRating: '',
      countries: [],
      runtime: '',
      q: '',
    };
    setDraft(clean);
    setIsMobileSheetOpen(false);
    commit(clean);
  };

  // Active chips for 1-click removal
  const activeChips: Array<{ id: string; label: string; onClear: () => void }> = [];
  for (const gid of initial.genres) {
    const gName = genres.find((g) => g.id === gid)?.name || `#${gid}`;
    activeChips.push({
      id: `genre-${gid}`,
      label: gName,
      onClear: () => commit({ ...initial, genres: initial.genres.filter((id) => id !== gid) }),
    });
  }
  if (initial.yearFrom || initial.yearTo) {
    activeChips.push({
      id: 'year',
      label:
        initial.yearFrom === initial.yearTo
          ? initial.yearFrom
          : `${initial.yearFrom || '…'}–${initial.yearTo || '…'}`,
      onClear: () => commit({ ...initial, yearFrom: '', yearTo: '' }),
    });
  }
  for (const cCode of initial.countries) {
    const cLabel = COUNTRY_OPTIONS.find((c) => c.code === cCode)?.label || cCode;
    activeChips.push({
      id: `country-${cCode}`,
      label: cLabel,
      onClear: () =>
        commit({ ...initial, countries: initial.countries.filter((c) => c !== cCode) }),
    });
  }
  if (initial.minRating) {
    activeChips.push({
      id: 'rating',
      label: `★ от ${initial.minRating}`,
      onClear: () => commit({ ...initial, minRating: '' }),
    });
  }
  if (initial.runtime) {
    const rtLabel = RUNTIME_OPTIONS.find((r) => r.value === initial.runtime)?.label || '';
    activeChips.push({
      id: 'runtime',
      label: rtLabel,
      onClear: () => commit({ ...initial, runtime: '' }),
    });
  }

  return (
    <div className="space-y-3 mb-5 w-full">
      {/* Anime search (AniLiberty catalog) */}
      {initial.category === 'anime' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commit({ ...initial, q: draft.q });
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1 min-w-0 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92929F]" />
            <input
              type="text"
              value={draft.q || ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
              placeholder="Поиск по аниме…"
              maxLength={120}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#111119] border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
            />
            {draft.q && (
              <button
                type="button"
                aria-label="Очистить"
                onClick={() => commit({ ...initial, q: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#92929F] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl brand-btn text-white text-xs font-bold shrink-0"
          >
            Найти
          </button>
        </form>
      )}

      {/* Sort Bar above cards + Mobile Filter Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Desktop & Mobile Sort Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none max-w-full">
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-[#92929F] mr-1 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#A18BFF]" />
            <span>Сортировка:</span>
          </span>
          {SORT_OPTIONS.map((opt) => {
            const active = initial.sort === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => commit({ ...initial, sort: opt.value })}
                className={`px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-all ${
                  active
                    ? 'brand-btn border-transparent text-white'
                    : 'bg-[#111119] border-[#292936] text-[#92929F] hover:text-white hover:border-[#8065FF]/60'
                }`}
              >
                <span className="sm:hidden">{opt.shortLabel}</span>
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile-only Filters Button (on lg+ sidebar is always visible!) */}
        <div className="flex lg:hidden items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetAll}
              aria-label="Сбросить фильтры"
              className="p-2 rounded-xl bg-[#181821] border border-[#292936] text-[#92929F] hover:text-red-300"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMobileSheetOpen(true)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
              activeFiltersCount > 0
                ? 'bg-[#8065FF]/20 border-[#8065FF] text-white'
                : 'bg-[#111119] border-[#292936] text-white'
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

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onClear}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#8065FF]/15 border border-[#8065FF]/40 text-[11px] font-semibold text-[#A18BFF] hover:bg-rose-500/15 hover:border-rose-500/40 hover:text-rose-300 transition-all"
            >
              <span>{chip.label}</span>
              <X className="w-3 h-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={handleResetAll}
            className="text-[11px] font-semibold text-[#92929F] hover:text-white px-2 py-1"
          >
            Сбросить все
          </button>
        </div>
      )}

      {/* MOBILE: Bottom Sheet Filter Drawer */}
      {isMobileSheetOpen && (
        <div
          onClick={() => setIsMobileSheetOpen(false)}
          className="lg:hidden fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-end animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[88dvh] bg-[#111119] border-t border-[#292936] rounded-t-3xl flex flex-col shadow-2xl animate-slideUp"
          >
            <div className="px-4 pt-2.5 pb-3 border-b border-[#292936] shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#A18BFF]" />
                  <span>Фильтры</span>
                  {draftFiltersCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-[#8065FF] text-white text-[10px] font-black">
                      {draftFiltersCount}
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsMobileSheetOpen(false)}
                  className="p-1.5 rounded-xl bg-[#181821] text-[#92929F] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <FilterSections
                draft={draft}
                setDraft={setDraft}
                genres={genres}
                availableYears={availableYears}
                instantApply={true}
                onInstantCommit={commit}
              />
            </div>

            {draftFiltersCount > 0 && (
              <div className="px-4 py-3 border-t border-[#292936] bg-[#111119] shrink-0">
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="w-full py-2.5 rounded-xl bg-[#181821] border border-[#292936] text-xs font-bold text-[#92929F] hover:text-white"
                >
                  Сбросить фильтры ({draftFiltersCount})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Persistent Desktop Right Sidebar (~25% width, sticky) */
export function CatalogSidebarFilters({ initial, genres, availableYears }: CatalogFiltersProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<CatalogFilterState>(initial);

  useEffect(() => {
    setDraft(initial);
  }, [
    initial.category,
    initial.genres.join(','),
    initial.sort,
    initial.yearFrom,
    initial.yearTo,
    initial.minRating,
    initial.countries.join(','),
    initial.runtime,
    initial.q,
  ]);

  const commit = (next: CatalogFilterState) => {
    router.push(buildCatalogHref(next), { scroll: false });
  };

  const activeCount =
    (initial.genres?.length || 0) +
    (initial.yearFrom || initial.yearTo ? 1 : 0) +
    (initial.minRating ? 1 : 0) +
    (initial.countries?.length || 0) +
    (initial.runtime ? 1 : 0) +
    (initial.category !== 'movie' ? 1 : 0);

  const handleReset = () => {
    const clean: CatalogFilterState = {
      category: 'movie',
      genres: [],
      sort: initial.sort,
      yearFrom: '',
      yearTo: '',
      minRating: '',
      countries: [],
      runtime: '',
      q: '',
    };
    setDraft(clean);
    commit(clean);
  };

  return (
    <aside className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 sticky top-20 max-h-[calc(100vh-6rem)] rounded-2xl bg-[#111119] border border-[#292936] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#292936] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#A18BFF]" />
          <h2 className="text-sm font-black text-white">Фильтры</h2>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-[#8065FF] text-white text-[10px] font-black">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#92929F] hover:text-rose-400 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Сбросить</span>
          </button>
        )}
      </div>

      {/* Scrollable Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <FilterSections
          draft={draft}
          setDraft={setDraft}
          genres={genres}
          availableYears={availableYears}
          instantApply={true}
          onInstantCommit={commit}
        />
      </div>
    </aside>
  );
}

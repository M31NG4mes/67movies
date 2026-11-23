import React from 'react';
import { Search, Flame, Sparkles } from 'lucide-react';
import { api } from '../../lib/api-client';
import { MediaCard } from '../../components/media/MediaCard';
import { mockMoviesCatalog, mockSeriesCatalog } from '../../lib/catalog-data';

interface SearchPageProps {
  searchParams?: {
    q?: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = (searchParams?.q || '').trim();

  let items: any[] = [];
  let popularItems: any[] = [];
  let newItems: any[] = [];

  if (query) {
    try {
      const res = await api.media.search(query).catch(() => null);
      if (res?.items && res.items.length > 0) {
        items = res.items;
      }
    } catch (e) {
      console.warn('[SearchPage] search error', e);
    }
  } else {
    const [popMoviesRes, popTvRes, newMoviesRes] = await Promise.all([
      api.media.getPopularMovies(1).catch(() => null),
      api.media.getPopularTv(1).catch(() => null),
      api.media.getNewMovies(1).catch(() => null),
    ]);

    const popMovies = popMoviesRes?.items?.length ? popMoviesRes.items : mockMoviesCatalog;
    const popTv = popTvRes?.items?.length ? popTvRes.items : mockSeriesCatalog;
    const newMovies = newMoviesRes?.items?.length ? newMoviesRes.items : mockMoviesCatalog.slice(0, 10);

    // Interleave popular movies & series cleanly
    const seenPop = new Set<string>();
    for (let i = 0; i < Math.max(popMovies.length, popTv.length); i++) {
      for (const candidate of [popMovies[i], popTv[i]]) {
        if (!candidate) continue;
        const k = `${candidate.type}:${candidate.id}`;
        if (!seenPop.has(k)) {
          seenPop.add(k);
          popularItems.push(candidate);
        }
      }
    }
    popularItems = popularItems.slice(0, 15);
    newItems = newMovies.slice(0, 15);
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-8 lg:px-10 pt-16 sm:pt-20 pb-20 bg-[#09090D] min-h-screen">
      <div className="mb-6 border-b border-[#292936] pb-5 space-y-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
            {query ? (
              <>
                Результаты поиска: <span className="text-[#A18BFF]">«{query}»</span>
              </>
            ) : (
              'Поиск фильмов, сериалов и аниме'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-[#92929F] mt-1">
            {query
              ? items.length > 0
                ? `Найдено совпадений: ${items.length}`
                : 'Ничего не найдено по вашему запросу'
              : 'Популярные новинки и хиты или введите название для поиска'}
          </p>
        </div>

        <form action="/search" method="GET" className="flex items-center gap-2 max-w-xl">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92929F]" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Название фильма, сериала или аниме..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111119] border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
            />
          </div>
          <button
            type="submit"
            className="px-4 sm:px-5 py-2.5 rounded-xl brand-btn text-white text-xs sm:text-sm font-bold shrink-0"
          >
            Найти
          </button>
        </form>
      </div>

      {query ? (
        items.length === 0 ? (
          <div className="text-center py-16 bg-[#111119] border border-[#292936] rounded-2xl p-6 sm:p-8 max-w-xl mx-auto">
            <p className="text-base sm:text-lg font-bold text-white">Ничего не найдено</p>
            <p className="text-xs sm:text-sm text-[#92929F] mt-2">
              Проверьте правильность написания или попробуйте найти другой фильм, сериал или аниме.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4 animate-fadeIn">
            {items.map((item) => (
              <MediaCard key={`${item.type}-${item.id}`} media={item} fluid />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-8 animate-fadeIn">
          {/* Popular Movies & Series */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#A18BFF]" />
              <h2 className="text-base sm:text-xl font-bold text-white">
                Популярные фильмы и сериалы
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
              {popularItems.map((item) => (
                <MediaCard key={`pop-${item.type}-${item.id}`} media={item} fluid />
              ))}
            </div>
          </section>

          {/* New Movies */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#A18BFF]" />
              <h2 className="text-base sm:text-xl font-bold text-white">Новые фильмы</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
              {newItems.map((item) => (
                <MediaCard key={`new-${item.type}-${item.id}`} media={item} fluid />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { api } from '../../lib/api-client';
import { MediaCard } from '../../components/media/MediaCard';

interface SearchPageProps {
  searchParams?: {
    q?: string;
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams?.q || '';

  let items: any[] = [];
  if (query.trim()) {
    try {
      const res = await api.media.search(query).catch(() => null);
      if (res?.items && res.items.length > 0) {
        items = res.items;
      }
    } catch (e) {
      console.warn('[SearchPage] search error', e);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-24 bg-cinema-dark min-h-screen">
      <div className="mb-8 border-b border-cinema-border pb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-cinema-text tracking-wide">
          Результаты поиска: <span className="text-brand-light">«{query}»</span>
        </h1>
        <p className="text-sm text-cinema-muted mt-1.5">
          {items.length > 0
            ? `Найдено совпадений: ${items.length}`
            : 'Поиск по объединённой базе фильмов, сериалов и аниме'}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-cinema-card border border-cinema-border rounded-2xl p-8 max-w-xl mx-auto">
          <p className="text-lg font-semibold text-white">Ничего не найдено</p>
          <p className="text-sm text-cinema-muted mt-2">
            Проверьте правильность написания или попробуйте найти другой фильм, сериал или персону.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-5 animate-fadeIn">
          {items.map((item) => (
            <MediaCard key={item.id} media={item} fluid />
          ))}
        </div>
      )}
    </div>
  );
}

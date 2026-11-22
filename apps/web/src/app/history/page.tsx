'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Clock, Trash2, Film } from 'lucide-react';
import { useLibraryStore } from '../../stores/library.store';

export default function HistoryPage() {
  const { history, hydrated, hydrate, removeFromHistory, clearHistory } = useLibraryStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10 pt-24 sm:pt-28 pb-24 bg-[#09090D] min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#292936] pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-[#A18BFF] text-xs font-bold uppercase tracking-widest mb-1.5">
            <Clock className="w-4 h-4" />
            <span>Недавние просмотры</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            История просмотров
          </h1>
          <p className="text-sm text-[#92929F] mt-1">
            Фильмы и сериалы, которые вы открывали и смотрели ({history.length})
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-bold transition-all self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Очистить историю</span>
          </button>
        )}
      </div>

      {!hydrated ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-[#181821] animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 bg-[#111119] border border-[#292936] rounded-3xl p-8 max-w-lg mx-auto">
          <Clock className="w-10 h-10 text-[#A18BFF] mx-auto mb-3 opacity-70" />
          <p className="text-lg font-bold text-white">История пока пуста</p>
          <p className="text-sm text-[#92929F] mt-2">
            Открывайте фильмы и сериалы из каталога — они автоматически появятся здесь.
          </p>
          <Link
            href="/catalog"
            className="mt-6 inline-flex items-center px-6 py-2.5 rounded-xl brand-btn text-white text-xs font-bold"
          >
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 animate-fadeIn">
          {history.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-2xl p-1 brand-card-hover bg-[#111119]"
            >
              <Link href={`/movie/${item.id}?type=${item.type || 'movie'}`} className="block">
                <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#181821] relative">
                  {item.posterPath ? (
                    <img
                      src={item.posterPath}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#92929F]">
                      <Film className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/95 via-black/50 to-transparent flex flex-col justify-end p-2.5 hero-keep-white">
                    <p className="text-xs font-bold text-white line-clamp-2">{item.title}</p>
                    <p className="text-[10px] text-white/65 mt-0.5">
                      {new Date(item.addedAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => removeFromHistory(item.id)}
                title="Удалить из истории"
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/75 hover:bg-red-500/80 text-white backdrop-blur-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

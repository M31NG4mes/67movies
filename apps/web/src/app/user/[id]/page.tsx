'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Star, Heart, Film, ArrowLeft, ListPlus } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface ShowcaseRating {
  id: string;
  tmdbId: number;
  mediaType: 'MOVIE' | 'SERIES';
  title: string;
  posterPath: string | null;
  rating: number;
  review: string | null;
  isFavorite: boolean;
  updatedAt: string;
}

interface ShowcaseCollectionItem {
  id: string;
  tmdbId: number;
  mediaType: 'MOVIE' | 'SERIES';
  title: string;
  posterPath: string | null;
}

interface ShowcaseCollection {
  id: string;
  title: string;
  description?: string | null;
  items: ShowcaseCollectionItem[];
}

interface PublicShowcase {
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
  };
  stats: {
    totalRated: number;
    totalFavorites: number;
    averageRating: number;
  };
  favorites: ShowcaseRating[];
  ratings: ShowcaseRating[];
  collections?: ShowcaseCollection[];
}

export default function PublicUserProfilePage() {
  const params = useParams();
  const userId = String(params?.id || '');

  const [showcase, setShowcase] = useState<PublicShowcase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`${API_BASE}/social/users/${encodeURIComponent(userId)}/profile`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Профиль пользователя не найден');
        return res.json();
      })
      .then((data) => {
        setShowcase(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || 'Не удалось загрузить профиль');
        setLoading(false);
      });
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090D] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#8065FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !showcase) {
    return (
      <div className="min-h-screen bg-[#09090D] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-xl font-bold text-white mb-2">{error || 'Профиль не найден'}</p>
        <Link
          href="/profile"
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8065FF] text-white text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад в мой профиль</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-24 pb-24 min-h-screen bg-[#09090D] space-y-8">
      {/* Banner & Avatar Card */}
      <div className="rounded-3xl overflow-hidden bg-[#111119] border border-[#292936]">
        <div
          className="relative h-44 sm:h-56 w-full profile-banner-bg bg-cover bg-center"
          style={
            showcase.user.bannerUrl
              ? { backgroundImage: `url(${showcase.user.bannerUrl})` }
              : undefined
          }
        >
          <div className="absolute inset-0 profile-banner-fade" />
        </div>

        <div className="px-6 pb-6 -mt-12 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#181821] profile-avatar-ring flex items-center justify-center">
              {showcase.user.avatarUrl ? (
                <img
                  src={showcase.user.avatarUrl}
                  alt={showcase.user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-black text-[#A18BFF] uppercase">
                  {showcase.user.name.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="pb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-white">{showcase.user.name}</h1>
              <p className="text-xs text-[#92929F] mt-0.5">Публичная кино-витрина 67movies</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-[#181821] border border-[#292936] text-center">
              <p className="text-lg font-black text-white">{showcase.stats.totalFavorites}</p>
              <p className="text-[11px] text-[#92929F]">Любимых</p>
            </div>
            <div className="px-4 py-2 rounded-xl bg-[#181821] border border-[#292936] text-center">
              <p className="text-lg font-black text-white">{showcase.stats.totalRated}</p>
              <p className="text-[11px] text-[#92929F]">Оценок</p>
            </div>
            <div className="px-4 py-2 rounded-xl bg-[#181821] border border-[#292936] text-center">
              <p className="text-lg font-black text-[#A18BFF]">
                {showcase.stats.averageRating || '—'}
              </p>
              <p className="text-[11px] text-[#92929F]">Средняя</p>
            </div>
          </div>
        </div>
      </div>

      {/* Favorite Movies Showcase */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-xl">
          <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
          <span>Любимые фильмы и сериалы</span>
        </div>

        {showcase.favorites.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#111119] border border-[#292936] text-center text-sm text-[#92929F]">
            Пользователь пока не добавил любимые фильмы.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {showcase.favorites.map((item) => (
              <Link
                key={item.id}
                href={`/movie/${item.tmdbId}?type=${item.mediaType === 'SERIES' ? 'tv' : 'movie'}`}
                className="group rounded-2xl overflow-hidden bg-[#181821] border border-[#292936] hover:border-[#8065FF] transition-all"
              >
                <div className="aspect-[2/3] relative bg-[#111119]">
                  {item.posterPath ? (
                    <img
                      src={item.posterPath}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#92929F]">
                      <Film className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/80 backdrop-blur-md text-xs font-bold text-[#A18BFF] flex items-center gap-1">
                    <Star className="w-3 h-3 fill-[#A18BFF] text-[#A18BFF]" />
                    <span>{item.rating}/10</span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs font-bold text-white line-clamp-1">{item.title}</p>
                  {item.review && (
                    <p className="text-[11px] text-[#92929F] line-clamp-2 mt-1">{item.review}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Public Collections Showcase */}
      {showcase.collections && showcase.collections.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-xl">
            <ListPlus className="w-5 h-5 text-[#A18BFF]" />
            <span>Подборки пользователя ({showcase.collections.length})</span>
          </div>

          <div className="space-y-4">
            {showcase.collections.map((col) => (
              <div
                key={col.id}
                className="p-5 rounded-2xl bg-[#111119] border border-[#292936] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white">{col.title}</h3>
                    {col.description && (
                      <p className="text-xs text-[#92929F] mt-0.5">{col.description}</p>
                    )}
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-[#8065FF]/15 text-[#A18BFF] text-xs font-bold shrink-0">
                    {col.items.length} шт.
                  </span>
                </div>

                {col.items.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                    {col.items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/movie/${item.tmdbId}?type=${item.mediaType === 'SERIES' ? 'tv' : 'movie'}`}
                        className="group rounded-xl overflow-hidden bg-[#181821] border border-[#292936] hover:border-[#8065FF] transition-all"
                      >
                        <div className="aspect-[2/3] bg-[#09090D] flex items-center justify-center">
                          {item.posterPath ? (
                            <img
                              src={item.posterPath}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <Film className="w-6 h-6 text-[#92929F]" />
                          )}
                        </div>
                        <p className="p-2 text-[11px] font-semibold text-white line-clamp-1">
                          {item.title}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#92929F]">Подборка пока пуста.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All Ratings & Reviews */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-xl">
          <Star className="w-5 h-5 text-[#A18BFF] fill-[#A18BFF]" />
          <span>Все оценки и отзывы ({showcase.ratings.length})</span>
        </div>

        {showcase.ratings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#111119] border border-[#292936] text-center text-sm text-[#92929F]">
            Оценок пока нет.
          </div>
        ) : (
          <div className="space-y-3">
            {showcase.ratings.map((item) => (
              <Link
                key={item.id}
                href={`/movie/${item.tmdbId}?type=${item.mediaType === 'SERIES' ? 'tv' : 'movie'}`}
                className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[#111119] border border-[#292936] hover:border-[#8065FF] transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {item.posterPath && (
                    <img
                      src={item.posterPath}
                      alt={item.title}
                      className="w-11 h-16 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.title}</p>
                    {item.review && (
                      <p className="text-xs text-[#92929F] line-clamp-2 mt-1">{item.review}</p>
                    )}
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#8065FF]/15 border border-[#8065FF]/40 text-sm font-black text-[#A18BFF] shrink-0">
                  ★ {item.rating}/10
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

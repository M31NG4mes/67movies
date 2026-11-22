import React from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Star, Film, Tv, Clock } from 'lucide-react';
import { api } from '../../lib/api-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface TvMazeEpisode {
  id: number;
  episodeName: string;
  season: number;
  number: number;
  airtime: string;
  showName: string;
  network: string;
  image: string | null;
}

async function fetchTvMazeToday(): Promise<TvMazeEpisode[]> {
  try {
    const res = await fetch(`${API_BASE}/media/tvmaze-schedule`, {
      next: { revalidate: 1800 },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) return json;
    }
  } catch {
    // fallback below
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`https://api.tvmaze.com/schedule?country=US&date=${today}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((ep: any) => ep?.show?.name && (ep?.show?.image?.medium || ep?.show?.rating?.average))
      .slice(0, 16)
      .map((ep: any) => ({
        id: ep.id,
        episodeName: ep.name,
        season: ep.season,
        number: ep.number,
        airtime: ep.airtime || '',
        showName: ep.show.name,
        network: ep.show.network?.name || ep.show.webChannel?.name || 'TV',
        image: ep.show.image?.medium || null,
      }));
  } catch {
    return [];
  }
}

interface CalendarPageProps {
  searchParams?: {
    year?: string;
    month?: string;
    type?: 'all' | 'movie' | 'tv';
  };
}

const MONTH_NAMES_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const MONTH_SHORT_RU = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

const WEEKDAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const now = new Date();
  const year = searchParams?.year ? parseInt(searchParams.year, 10) || now.getFullYear() : now.getFullYear();
  const month = searchParams?.month
    ? Math.min(12, Math.max(1, parseInt(searchParams.month, 10) || now.getMonth() + 1))
    : now.getMonth() + 1;
  const type: 'all' | 'movie' | 'tv' =
    searchParams?.type === 'movie' || searchParams?.type === 'tv' ? searchParams.type : 'all';

  const [data, tvMazeEpisodes] = await Promise.all([
    api.media.getCalendar(year, month, type).catch(() => ({
      year,
      month,
      days: [],
    })),
    fetchTvMazeToday(),
  ]);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const buildUrl = (y: number, m: number, t: 'all' | 'movie' | 'tv' = type) => {
    const sp = new URLSearchParams({ year: String(y), month: String(m) });
    if (t !== 'all') sp.set('type', t);
    return `/calendar?${sp.toString()}`;
  };

  return (
    <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10 pt-20 md:pt-16 pb-24 bg-[#09090D] min-h-screen">
      {/* Header & Month Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 border-b border-[#292936] pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-[#A18BFF] text-xs font-bold uppercase tracking-widest mb-1.5">
            <CalendarDays className="w-4 h-4" />
            <span>График релизов</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            Календарь премьер
          </h1>
          <p className="text-sm text-[#92929F] mt-1">
            Даты выхода фильмов и сериалов по дням из базы TMDB
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-[#111119] border border-[#292936] p-1 rounded-xl">
            {(
              [
                { id: 'all', label: 'Все' },
                { id: 'movie', label: 'Фильмы' },
                { id: 'tv', label: 'Сериалы' },
              ] as const
            ).map((opt) => (
              <Link
                key={opt.id}
                href={buildUrl(year, month, opt.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  type === opt.id
                    ? 'brand-btn text-white'
                    : 'text-[#92929F] hover:text-white hover:bg-[#181821]'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2 bg-[#111119] border border-[#292936] p-1 rounded-xl">
            <Link
              href={buildUrl(prevYear, prevMonth)}
              aria-label="Предыдущий месяц"
              className="p-2 rounded-lg hover:bg-[#181821] text-[#92929F] hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <span className="px-3 text-sm font-bold text-white min-w-[140px] text-center">
              {MONTH_NAMES_RU[month - 1]} {year}
            </span>
            <Link
              href={buildUrl(nextYear, nextMonth)}
              aria-label="Следующий месяц"
              className="p-2 rounded-lg hover:bg-[#181821] text-[#92929F] hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* TVMaze Live Today Episodes Strip */}
      {tvMazeEpisodes.length > 0 && (
        <section className="mb-10 p-5 rounded-3xl bg-[#111119] border border-[#292936] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#8065FF]/15 text-[#A18BFF]">
                <Tv className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Сегодня в эфире (TVMaze)
                </h2>
                <p className="text-xs text-[#92929F]">
                  Свежие серии сериалов, выходящие сегодня по расписанию телесетей и стримингов
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              LIVE • {tvMazeEpisodes.length} серий
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {tvMazeEpisodes.map((ep) => (
              <Link
                key={ep.id}
                href={`/search?q=${encodeURIComponent(ep.showName)}`}
                className="group w-64 shrink-0 flex items-center gap-3 p-2.5 rounded-2xl bg-[#181821] border border-[#292936] hover:border-[#8065FF] transition-all"
              >
                <div className="w-12 h-16 rounded-xl overflow-hidden bg-[#09090D] shrink-0 flex items-center justify-center">
                  {ep.image ? (
                    <img
                      src={ep.image}
                      alt={ep.showName}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <Tv className="w-4 h-4 text-[#92929F]" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold">
                    <span className="px-1.5 py-0.5 rounded bg-[#8065FF]/20 text-[#A18BFF]">
                      S{String(ep.season || 1).padStart(2, '0')}E{String(ep.number || 1).padStart(2, '0')}
                    </span>
                    <span className="text-[#92929F] truncate">{ep.network}</span>
                  </div>
                  <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#A18BFF] transition-colors">
                    {ep.showName}
                  </p>
                  <p className="text-[11px] text-[#92929F] line-clamp-1 flex items-center gap-1">
                    {ep.airtime && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-400 font-semibold shrink-0">
                        <Clock className="w-3 h-3" />
                        {ep.airtime}
                      </span>
                    )}
                    <span className="truncate">{ep.episodeName}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Release Timeline by Date */}
      {data.days.length === 0 ? (
        <div className="text-center py-20 bg-[#111119] border border-[#292936] rounded-3xl p-8 max-w-lg mx-auto">
          <CalendarDays className="w-10 h-10 text-[#A18BFF] mx-auto mb-3 opacity-75" />
          <p className="text-lg font-bold text-white">На этот месяц премьер не найдено</p>
          <p className="text-sm text-[#92929F] mt-2">
            Попробуйте переключить месяц стрелками вверху справа.
          </p>
        </div>
      ) : (
        <div className="space-y-7 animate-fadeIn">
          {data.days.map((dayGroup) => {
            const d = new Date(`${dayGroup.date}T00:00:00`);
            const dayNum = d.getDate();
            const weekday = WEEKDAYS_RU[d.getDay()];
            const monthShort = MONTH_SHORT_RU[d.getMonth()];

            return (
              <div
                key={dayGroup.date}
                className="flex flex-col md:flex-row gap-4 md:gap-6 items-start"
              >
                {/* Date Badge Column */}
                <div className="flex md:flex-col items-center justify-center gap-2 md:gap-0.5 px-4 py-2.5 md:w-24 md:py-4 rounded-2xl bg-[#111119] border border-[#292936] shrink-0">
                  <span className="text-2xl sm:text-3xl font-black text-white leading-none">
                    {dayNum}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#A18BFF]">
                    {monthShort}
                  </span>
                  <span className="text-[11px] text-[#92929F] font-medium">{weekday}</span>
                </div>

                {/* Releases on This Day */}
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {dayGroup.items.map((item) => {
                    const targetId = item.tmdbId || item.id;
                    const targetType = item.type === 'tv' ? 'tv' : 'movie';
                    return (
                      <Link
                        key={`${targetType}-${targetId}`}
                        href={`/movie/${targetId}?type=${targetType}`}
                        className="group flex items-center gap-3.5 p-3 rounded-2xl bg-[#111119] border border-[#292936] hover:border-[#8065FF] transition-all hover:-translate-y-0.5"
                      >
                        <div className="w-14 h-20 rounded-xl overflow-hidden bg-[#181821] shrink-0 flex items-center justify-center">
                          {item.posterPath ? (
                            <img
                              src={item.posterPath}
                              alt={item.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <Film className="w-5 h-5 text-[#92929F]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-[#8065FF]/15 text-[#A18BFF] text-[10px] font-bold uppercase">
                              {targetType === 'tv' ? 'Сериал' : 'Фильм'}
                            </span>
                            {item.voteAverage > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#A18BFF]">
                                <Star className="w-3 h-3 fill-[#A18BFF]" />
                                {Number(item.voteAverage).toFixed(1)}
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#A18BFF] transition-colors">
                            {item.title}
                          </h3>
                          {item.overview && (
                            <p className="text-[11px] text-[#92929F] line-clamp-2 leading-snug">
                              {item.overview}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

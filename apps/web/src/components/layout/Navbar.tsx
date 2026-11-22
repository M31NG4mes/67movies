'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Home,
  Compass,
  CalendarDays,
  Bookmark,
  Clock,
  X,
  Sun,
  Moon,
  Snowflake,
  Star,
  Film,
  MessageCircle,
  User as UserIcon,
} from 'lucide-react';
import { MediaItem } from '@cinemaflow/types';
import { api } from '../../lib/api-client';
import { authFetch, useAuthStore } from '../../stores/auth.store';
import { TRANSLATIONS, usePreferencesStore } from '../../stores/preferences.store';

function SidebarTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full ml-3.5 px-3 py-1.5 rounded-xl bg-[#181821]/95 border border-[#292936] text-xs font-semibold text-white whitespace-nowrap shadow-2xl backdrop-blur-md opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-[60]">
      {label}
    </span>
  );
}

function NavbarContent() {
  const router = useRouter();
  const pathname = usePathname();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const { user, accessToken, profiles, activeProfileId, hydrate } = useAuthStore();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { theme, language, newYearMode, setTheme, setLanguage, setNewYearMode } =
    usePreferencesStore();
  const t = TRANSLATIONS[language];
  const currentAccountProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Poll unread chat messages badge
  useEffect(() => {
    if (!accessToken) {
      setUnreadMessages(0);
      return;
    }
    let cancelled = false;
    const fetchUnread = async () => {
      const res = await authFetch('/social/messages/unread-count', { cache: 'no-store' }).catch(
        () => null
      );
      if (res?.ok && !cancelled) {
        const data = await res.json();
        setUnreadMessages(Number(data?.unreadCount || 0));
      }
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 12000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [accessToken, pathname]);

  // Debounced live search suggestions
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.media.search(trimmed, 1);
        if (!cancelled) {
          setSuggestions((res?.items || []).slice(0, 6));
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Close desktop dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDropdown(false);
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Hide navigation chrome on the full-screen /auth welcome page
  if (pathname === '/auth') {
    return null;
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchOpen(false);
      setShowDropdown(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const sideLinks = [
    { label: t.home, href: '/', icon: Home, isActive: pathname === '/' },
    {
      label: t.catalog,
      href: '/catalog',
      icon: Compass,
      isActive: pathname === '/catalog',
    },
    {
      label: language === 'en' ? 'Calendar' : 'Календарь',
      href: '/calendar',
      icon: CalendarDays,
      isActive: pathname === '/calendar',
      badge: 0,
    },
    {
      label: language === 'en' ? 'Messages' : 'Чат',
      href: '/messages',
      icon: MessageCircle,
      isActive: pathname === '/messages',
      badge: unreadMessages,
    },
    {
      label: t.history,
      href: '/history',
      icon: Clock,
      isActive: pathname === '/history',
      badge: 0,
    },
    {
      label: t.watchlist,
      href: '/watchlist',
      icon: Bookmark,
      isActive: pathname === '/watchlist',
      badge: 0,
    },
  ];

  return (
    <>
      {/* =================================================================
          DESKTOP: All Controls Consolidated into Left Slim Sidebar
          (with sleek hover tooltips sliding out to the right)
         ================================================================= */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-16 z-50 bg-[#09090D]/95 border-r border-white/[0.06] flex-col items-center justify-between py-5 select-none">
        {/* Top: Brand Logo */}
        <Link
          href="/"
          aria-label="67movies"
          className="group relative w-10 h-10 rounded-xl brand-logo-badge flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          <span className="text-[17px] font-black text-white tracking-tighter leading-none">
            67
          </span>
          <SidebarTooltip label="67movies" />
        </Link>

        {/* Middle: Navigation + Search Icons */}
        <nav className="flex flex-col items-center gap-3.5">
          {sideLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  item.isActive
                    ? 'text-[#A18BFF] bg-[#8065FF]/15 shadow-[0_0_16px_rgba(128,101,255,0.2)]'
                    : 'text-[#8C8A9A] hover:text-white hover:bg-white/5'
                }`}
              >
                {item.isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ backgroundColor: 'var(--brand-main)' }}
                  />
                )}
                <Icon className="w-[20px] h-[20px] stroke-[1.75]" />
                {Boolean((item as any).badge) && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg">
                    {(item as any).badge > 9 ? '9+' : (item as any).badge}
                  </span>
                )}
                <SidebarTooltip label={item.label} />
              </Link>
            );
          })}

          <div className="w-6 h-px bg-white/10 my-1" />
        </nav>

        {/* Bottom: New Year, Language, Theme & Account */}
        <div className="flex flex-col items-center gap-3">
          {/* New Year Festive Toggle */}
          <button
            type="button"
            onClick={() => setNewYearMode(!newYearMode)}
            aria-label="Новогодняя тема"
            className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              newYearMode
                ? 'text-sky-300 bg-sky-400/15 border border-sky-400/40 shadow-[0_0_16px_rgba(56,189,248,0.35)]'
                : 'text-[#8C8A9A] hover:text-sky-300 hover:bg-white/5'
            }`}
          >
            <Snowflake className={`w-[19px] h-[19px] stroke-[1.75] ${newYearMode ? 'animate-spin' : ''}`} style={newYearMode ? { animationDuration: '9s' } : undefined} />
            <SidebarTooltip
              label={
                newYearMode
                  ? language === 'en'
                    ? 'New Year Mode: ON'
                    : 'Новогодняя тема: ВКЛ'
                  : language === 'en'
                  ? 'New Year Mode'
                  : 'Новогодняя тема'
              }
            />
          </button>

          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => {
              const nextLang = language === 'ru' ? 'en' : 'ru';
              setLanguage(nextLang);
              if (accessToken) {
                authFetch('/settings', {
                  method: 'PATCH',
                  body: JSON.stringify({ language: nextLang }),
                }).catch(() => {});
              }
            }}
            aria-label="Сменить язык"
            className="group relative w-10 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold uppercase tracking-wider text-[#92929F] hover:text-white border border-white/10 hover:border-[#8065FF] transition-all"
          >
            <span>{language.toUpperCase()}</span>
            <SidebarTooltip label={language === 'ru' ? 'Язык: Русский' : 'Language: English'} />
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={() => {
              const nextTheme = theme === 'dark' ? 'light' : 'dark';
              setTheme(nextTheme);
              if (accessToken) {
                authFetch('/settings', {
                  method: 'PATCH',
                  body: JSON.stringify({ theme: nextTheme }),
                }).catch(() => {});
              }
            }}
            aria-label="Переключить тему"
            className="group relative w-10 h-10 rounded-xl flex items-center justify-center text-[#8C8A9A] hover:text-white hover:bg-white/5 transition-all"
          >
            {theme === 'dark' ? (
              <Sun className="w-[19px] h-[19px] stroke-[1.75]" />
            ) : (
              <Moon className="w-[19px] h-[19px] stroke-[1.75]" />
            )}
            <SidebarTooltip
              label={
                theme === 'dark'
                  ? language === 'en'
                    ? 'Light theme'
                    : 'Светлая тема'
                  : language === 'en'
                  ? 'Dark theme'
                  : 'Тёмная тема'
              }
            />
          </button>

          {/* Account / Login */}
          <Link
            href={user ? '/profile' : '/auth'}
            aria-label={user ? user.name : t.signIn}
            className="group relative w-10 h-10 rounded-xl overflow-visible flex items-center justify-center transition-transform hover:scale-105"
          >
            {user ? (
              currentAccountProfile?.avatarUrl ? (
                <img
                  src={currentAccountProfile.avatarUrl}
                  alt={user.name}
                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/15 group-hover:ring-[#8065FF] transition-all"
                />
              ) : (
                <span className="w-10 h-10 rounded-xl brand-btn text-white text-sm font-black flex items-center justify-center uppercase">
                  {user.name.slice(0, 1)}
                </span>
              )
            ) : (
              <span className="w-10 h-10 rounded-xl bg-[#181821] border border-[#292936] group-hover:border-[#8065FF] text-[#A18BFF] flex items-center justify-center transition-all">
                <UserIcon className="w-5 h-5" />
              </span>
            )}
            <SidebarTooltip label={user ? user.name : t.signIn} />
          </Link>
        </div>
      </aside>

      {/* =================================================================
          DESKTOP: Floating Top Search Bar with Live Autocomplete Dropdown
         ================================================================= */}
      <div className="hidden md:flex fixed top-4 left-20 right-6 z-40 justify-center pointer-events-none">
        <div ref={searchBoxRef} className="pointer-events-auto relative w-full max-w-md">
          <form onSubmit={handleSearchSubmit} className="relative group">
            <Search className="w-4 h-4 text-[#92929F] group-focus-within:text-[#A18BFF] absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              placeholder={t.searchPlaceholder}
              className="w-full pl-11 pr-10 py-2.5 rounded-2xl bg-[#111119]/85 backdrop-blur-xl border border-white/15 focus:border-[#8065FF] text-sm text-white placeholder-[#92929F] shadow-xl focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                }}
                aria-label="Очистить поиск"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#92929F] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Live Suggestions Dropdown */}
          {showDropdown && searchQuery.trim().length >= 2 && (
            <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-[#111119]/95 backdrop-blur-2xl border border-[#292936] shadow-2xl overflow-hidden animate-scaleIn">
              {isSearching ? (
                <div className="px-4 py-5 text-center text-xs text-[#92929F]">
                  Поиск фильмов и сериалов...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-4 py-5 text-center text-xs text-[#92929F]">
                  Ничего не найдено по запросу «{searchQuery}»
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {suggestions.map((item) => {
                    const targetId = item.tmdbId || item.id;
                    const targetType = item.type === 'tv' ? 'tv' : 'movie';
                    return (
                      <Link
                        key={`${targetType}-${targetId}`}
                        href={`/movie/${targetId}?type=${targetType}`}
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#8065FF]/15 transition-colors"
                      >
                        <div className="w-9 h-12 rounded-lg overflow-hidden bg-[#181821] shrink-0 flex items-center justify-center">
                          {item.posterPath ? (
                            <img
                              src={item.posterPath}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Film className="w-4 h-4 text-[#92929F]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{item.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-[#92929F] mt-0.5">
                            <span>{item.releaseYear || '—'}</span>
                            <span>•</span>
                            <span>{targetType === 'tv' ? 'Сериал' : 'Фильм'}</span>
                          </div>
                        </div>
                        {item.voteAverage > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#181821] text-[11px] font-bold text-[#A18BFF] shrink-0">
                            <Star className="w-3 h-3 fill-[#A18BFF]" />
                            {Number(item.voteAverage).toFixed(1)}
                          </span>
                        )}
                      </Link>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    className="w-full px-4 py-2.5 text-center text-xs font-semibold text-[#A18BFF] hover:bg-[#8065FF]/15 transition-colors"
                  >
                    Показать все результаты для «{searchQuery}» →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =================================================================
          MOBILE ONLY: Compact Top Bar (Logo + Search + Lang + Theme)
         ================================================================= */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 glass-nav-scrolled px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg brand-logo-badge flex items-center justify-center text-xs font-black text-white">
            67
          </span>
          <div className="flex items-baseline tracking-tight">
            <span className="text-lg font-black text-white">67</span>
            <span className="text-xs font-semibold text-[#A18BFF] ml-0.5">movies</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNewYearMode(!newYearMode)}
            aria-label="Новогодняя тема"
            className={`p-1.5 rounded-lg transition-colors ${
              newYearMode ? 'text-sky-300 bg-sky-400/15' : 'text-[#B8B6C8]'
            }`}
          >
            <Snowflake className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
            className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase text-[#B8B6C8] border border-white/15"
          >
            {language.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Тема"
            className="p-1.5 text-[#B8B6C8]"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Поиск"
            className="p-1.5 text-[#B8B6C8]"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MOBILE ONLY: Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-nav-scrolled border-t border-[#292936] px-2 py-2 flex items-center justify-around">
        {[
          { label: t.home, href: '/', icon: Home, active: pathname === '/' },
          { label: t.catalog, href: '/catalog', icon: Compass, active: pathname === '/catalog' },
          {
            label: language === 'en' ? 'Calendar' : 'Календарь',
            href: '/calendar',
            icon: CalendarDays,
            active: pathname === '/calendar',
          },
          {
            label: t.watchlist,
            href: '/watchlist',
            icon: Bookmark,
            active: pathname === '/watchlist',
          },
          {
            label: user ? user.name : t.signIn,
            href: user ? '/profile' : '/auth',
            icon: UserIcon,
            active: pathname === '/profile' || pathname === '/auth',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
                item.active ? 'text-[#A18BFF]' : 'text-[#92929F]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {Boolean((item as any).badge) && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                    {(item as any).badge > 9 ? '9+' : (item as any).badge}
                  </span>
                )}
              </div>
              <span className="max-w-[56px] truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Interactive Search Overlay Modal */}
      {isSearchOpen && (
        <div
          onClick={() => setIsSearchOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/80 backdrop-blur-md animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#111119] border border-[#292936] rounded-2xl shadow-2xl p-4 sm:p-6 text-white animate-scaleIn"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#292936]">
              <div className="flex items-center gap-3 flex-1 mr-4">
                <Search className="w-5 h-5 text-[#8065FF]" />
                <form onSubmit={handleSearchSubmit} className="flex-1">
                  <input
                    type="text"
                    autoFocus
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-base text-white placeholder-[#92929F] focus:outline-none"
                  />
                </form>
              </div>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-1.5 text-[#92929F] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pt-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#92929F]">
                {t.oftenSearched}
              </span>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {['Дюна 2', 'Сёгун', 'Оппенгеймер', 'Аркейн', 'Интерстеллар'].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setSearchQuery(item);
                      setIsSearchOpen(false);
                      router.push(`/search?q=${encodeURIComponent(item)}`);
                    }}
                    className="px-3 py-1.5 text-xs text-white bg-[#181821] hover:bg-[#8065FF]/20 hover:text-[#A18BFF] border border-[#292936] hover:border-[#8065FF]/50 rounded-lg transition-all"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Navbar() {
  return (
    <Suspense fallback={null}>
      <NavbarContent />
    </Suspense>
  );
}

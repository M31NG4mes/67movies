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
  Shield,
  Menu,
  User as UserIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaItem } from '@cinemaflow/types';
import { api } from '../../lib/api-client';
import { authFetch, useAuthStore } from '../../stores/auth.store';
import { TRANSLATIONS, usePreferencesStore } from '../../stores/preferences.store';
import { Logo } from './Logo';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);

  const { user, accessToken, profiles, activeProfileId, hydrate } = useAuthStore();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const { language, setLanguage } = usePreferencesStore();
  const t = TRANSLATIONS[language];
  const currentAccountProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Close mobile drawer automatically on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Check admin role once per login session (not on every route change)
  useEffect(() => {
    if (!accessToken) {
      setCanAccessAdmin(false);
      return;
    }
    let cancelled = false;
    authFetch('/admin/access', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setCanAccessAdmin(Boolean(d?.canAccessAdmin));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // Poll unread chat messages badge (pauses when tab is hidden)
  useEffect(() => {
    if (!accessToken) {
      setUnreadMessages(0);
      return;
    }
    let cancelled = false;
    const fetchUnread = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const res = await authFetch('/social/messages/unread-count', { cache: 'no-store' }).catch(
        () => null
      );
      if (res?.ok && !cancelled) {
        const data = await res.json();
        setUnreadMessages(Number(data?.unreadCount || 0));
      }
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 20000);
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth >= 768) {
          desktopSearchInputRef.current?.focus();
          setShowDropdown(true);
        } else {
          setIsSearchOpen(true);
        }
      }
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

  // Hide regular user navigation chrome on /auth, /watch player, and dedicated /admin dashboard
  if (
    pathname === '/auth' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/watch')
  ) {
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
          DESKTOP: Expandable Left Sidebar (expands smoothly on hover)
         ================================================================= */}
      <aside className="group/sidebar hidden md:flex fixed top-0 left-0 bottom-0 w-16 hover:w-56 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 bg-[#09090D]/95 hover:bg-[#09090D]/98 backdrop-blur-xl border-r border-white/[0.06] hover:shadow-[16px_0_40px_rgba(0,0,0,0.65)] flex-col justify-between py-5 px-2.5 overflow-hidden">
        {/* Top: Brand Logo (shows '67' collapsed, '67 movies' expanded) */}
        <div className="w-full px-0.5 flex items-center">
          <Logo expandOnSidebarHover className="w-full" />
        </div>

        {/* Middle: Navigation Links */}
        <nav className="w-full flex flex-col gap-2">
          {sideLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={`relative w-full h-11 px-3 rounded-xl flex items-center gap-3.5 transition-all duration-200 overflow-hidden ${
                  item.isActive
                    ? 'text-[#A18BFF] bg-[#8065FF]/15 shadow-[0_0_16px_rgba(128,101,255,0.2)]'
                    : 'text-[#8C8A9A] hover:text-white hover:bg-white/5'
                }`}
              >
                {item.isActive && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ backgroundColor: 'var(--brand-main)' }}
                  />
                )}
                <span className="relative shrink-0 flex items-center justify-center">
                  <Icon className="w-[20px] h-[20px] stroke-[1.75]" />
                  {Boolean((item as any).badge) && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-lg">
                      {(item as any).badge > 9 ? '9+' : (item as any).badge}
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold whitespace-nowrap opacity-0 -translate-x-2 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 transition-all duration-200">
                  {item.label}
                </span>
              </Link>
            );
          })}

          {canAccessAdmin && (
            <>
              <div className="w-full h-px bg-white/10 my-1" />
              <Link
                href="/admin"
                aria-label="Админ-панель"
                className="relative w-full h-11 px-3 rounded-xl flex items-center gap-3.5 text-[#A18BFF] bg-[#8065FF]/15 hover:bg-[#8065FF]/25 border border-[#8065FF]/35 transition-all duration-200 overflow-hidden"
              >
                <Shield className="w-[19px] h-[19px] stroke-[1.9] shrink-0" />
                <span className="text-sm font-semibold whitespace-nowrap opacity-0 -translate-x-2 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 transition-all duration-200">
                  {t.adminPanel}
                </span>
              </Link>
            </>
          )}
        </nav>

        {/* Bottom: Language & Account */}
        <div className="w-full flex flex-col gap-2.5">
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
            className="w-full h-10 px-2.5 rounded-xl flex items-center gap-3.5 text-[#92929F] hover:text-white hover:bg-white/5 border border-white/10 hover:border-[#8065FF] transition-all overflow-hidden"
          >
            <span className="w-6 text-center text-[11px] font-bold uppercase tracking-wider shrink-0">
              {language.toUpperCase()}
            </span>
            <span className="text-xs font-semibold whitespace-nowrap opacity-0 -translate-x-2 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 transition-all duration-200">
              {language === 'ru' ? 'Русский' : 'English'}
            </span>
          </button>

          {/* Account / Login */}
          <Link
            href={user ? '/profile' : '/auth'}
            aria-label={user ? user.name : t.signIn}
            className="w-full h-11 px-0.5 rounded-xl flex items-center gap-3 hover:bg-white/5 transition-all overflow-hidden"
          >
            {user ? (
              currentAccountProfile?.avatarUrl ? (
                <img
                  src={currentAccountProfile.avatarUrl}
                  alt={user.name}
                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/15 shrink-0"
                />
              ) : (
                <span className="w-10 h-10 rounded-xl brand-btn text-white text-sm font-black flex items-center justify-center uppercase shrink-0">
                  {user.name.slice(0, 1)}
                </span>
              )
            ) : (
              <span className="w-10 h-10 rounded-xl bg-[#181821] border border-[#292936] text-[#A18BFF] flex items-center justify-center shrink-0">
                <UserIcon className="w-5 h-5" />
              </span>
            )}
            <span className="text-sm font-bold text-white truncate opacity-0 -translate-x-2 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 transition-all duration-200">
              {user ? user.name : t.signIn}
            </span>
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
              ref={desktopSearchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              placeholder={t.searchPlaceholder}
              className="w-full pl-11 pr-16 py-2.5 rounded-2xl bg-[#111119]/85 backdrop-blur-xl border border-white/15 focus:border-[#8065FF] text-sm text-white placeholder-[#92929F] shadow-xl focus:outline-none transition-all"
            />
            {!searchQuery && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-[#92929F]">
                Ctrl K
              </span>
            )}
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
                    const targetId = item.anilibertyId
                      ? `al-${item.anilibertyId}`
                      : String(item.id || '').startsWith('al-')
                      ? item.id
                      : item.tmdbId || item.id;
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
          MOBILE ONLY: Minimal Floating Controls (Menu + Search)
          All navigation & settings are tucked cleanly inside the Slide-Out Drawer
         ================================================================= */}
      <div className="md:hidden fixed top-3 left-3 right-3 z-40 flex items-center justify-between pointer-events-none">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Открыть меню"
          className="pointer-events-auto relative w-10 h-10 rounded-2xl bg-[#111119]/80 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center shadow-xl active:scale-95 transition-transform"
        >
          <Menu className="w-5 h-5" />
          {unreadMessages > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow">
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          aria-label="Поиск"
          className="pointer-events-auto w-10 h-10 rounded-2xl bg-[#111119]/80 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center shadow-xl active:scale-95 transition-transform"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* MOBILE ONLY: Smooth Slide-Out Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          >
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[280px] max-w-[82vw] h-full bg-[#111119] border-r border-[#292936] p-4 flex flex-col justify-between shadow-2xl overflow-y-auto"
            >
              <div className="space-y-5">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#292936]">
                  <Link
                    href="/"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2.5"
                  >
                    <span className="w-9 h-9 rounded-xl brand-logo-badge flex items-center justify-center text-sm font-black text-white">
                      67
                    </span>
                    <div className="flex items-baseline tracking-tight">
                      <span className="text-lg font-black text-white">67</span>
                      <span className="text-xs font-semibold text-[#A18BFF] ml-0.5">movies</span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-label="Закрыть меню"
                    className="p-2 rounded-xl bg-[#181821] text-[#92929F] hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* User Card */}
                <Link
                  href={user ? '/profile' : '/auth'}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-[#181821] border border-[#292936] hover:border-[#8065FF] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#09090D] flex items-center justify-center shrink-0">
                    {user && currentAccountProfile?.avatarUrl ? (
                      <img
                        src={currentAccountProfile.avatarUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-5 h-5 text-[#A18BFF]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {user ? user.name : t.signIn}
                    </p>
                    <p className="text-[11px] text-[#92929F] truncate">
                      {user ? t.myProfile : t.signInAccount}
                    </p>
                  </div>
                </Link>

                {/* Navigation Links */}
                <nav className="space-y-1">
                  {sideLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all ${
                          item.isActive
                            ? 'bg-[#8065FF]/15 text-[#A18BFF] border border-[#8065FF]/35'
                            : 'text-[#B8B6C8] hover:text-white hover:bg-[#181821]'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </span>
                        {Boolean((item as any).badge) && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                            {(item as any).badge > 9 ? '9+' : (item as any).badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}

                  {canAccessAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold text-[#A18BFF] bg-[#8065FF]/10 border border-[#8065FF]/30 mt-2"
                    >
                      <Shield className="w-4 h-4" />
                      <span>{t.adminPanel}</span>
                    </Link>
                  )}
                </nav>
              </div>

              {/* Drawer Footer: Language Toggle */}
              <div className="pt-4 border-t border-[#292936]">
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#181821] border border-[#292936] text-xs font-bold text-[#B8B6C8] hover:text-white"
                >
                  <span className="font-black text-white">{language.toUpperCase()}</span>
                  <span>{language === 'ru' ? 'Язык: Русский' : 'Language: English'}</span>
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

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
      {/* =================================================================
          MOBILE: Thumb-Friendly Bottom Navigation Bar
         ================================================================= */}
      {!pathname?.startsWith('/watch') && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090D]/90 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 flex items-center justify-around">
          <Link
            href="/"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
              pathname === '/' ? 'text-[#A18BFF]' : 'text-[#92929F]'
            }`}
          >
            <Home className="w-5 h-5" />
            <span>{t.home}</span>
          </Link>
          <Link
            href="/catalog"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
              pathname?.startsWith('/catalog') ? 'text-[#A18BFF]' : 'text-[#92929F]'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span>{t.catalog}</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-semibold text-[#92929F] active:scale-95 transition-transform"
          >
            <Search className="w-5 h-5" />
            <span>Поиск</span>
          </button>
          <Link
            href="/messages"
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
              pathname?.startsWith('/messages') ? 'text-[#A18BFF]' : 'text-[#92929F]'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span>{t.chat}</span>
            {unreadMessages > 0 && (
              <span className="absolute top-0.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </Link>
          <Link
            href={user ? '/profile' : '/auth'}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
              pathname?.startsWith('/profile') ? 'text-[#A18BFF]' : 'text-[#92929F]'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span>{user ? 'Профиль' : t.signIn}</span>
          </Link>
        </nav>
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

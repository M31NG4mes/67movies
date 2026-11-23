'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Plus,
  Trash2,
  Shield,
  Sliders,
  LogOut,
  Monitor,
  Camera,
  Image as ImageIcon,
  Sun,
  Moon,
  Palette,
  Globe,
  Star,
  Heart,
  Share2,
  ExternalLink,
  ListPlus,
  Film,
  X,
  MessageCircle,
  Sparkles,
  Bookmark,
  Check,
} from 'lucide-react';
import { authFetch, useAuthStore } from '../../stores/auth.store';
import { useLibraryStore } from '../../stores/library.store';
import {
  ACCENT_PRESETS,
  THEME_PRESETS,
  TRANSLATIONS,
  usePreferencesStore,
} from '../../stores/preferences.store';

type ProfileTab = 'overview' | 'friends' | 'settings' | 'security';

export default function ProfilePage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const {
    user,
    accessToken,
    profiles,
    activeProfileId,
    hydrated,
    hydrate,
    setProfiles,
    logout,
  } = useAuthStore();

  const {
    theme,
    accentColor,
    language,
    newYearMode,
    ageVerified18,
    setTheme,
    setAccentColor,
    setLanguage,
    setNewYearMode,
    setAgeVerified18,
  } = usePreferencesStore();
  const t = TRANSLATIONS[language];

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [sessions, setSessions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [friendsData, setFriendsData] = useState<{
    friends: any[];
    incomingRequests: any[];
    outgoingRequests: any[];
  }>({ friends: [], incomingRequests: [], outgoingRequests: [] });
  const [myRatings, setMyRatings] = useState<any[]>([]);
  const [myCollections, setMyCollections] = useState<any[]>([]);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState<'avatar' | 'banner' | null>(null);

  const {
    watchlist,
    favorites,
    hydrate: hydrateLibrary,
    removeFromWatchlist,
    removeFromFavorites,
  } = useLibraryStore();

  useEffect(() => {
    hydrate();
    hydrateLibrary();
  }, [hydrate, hydrateLibrary]);

  useEffect(() => {
    const latestToken = useAuthStore.getState().accessToken;
    if (useAuthStore.getState().hydrated && !latestToken) {
      router.replace('/auth');
    }
  }, [hydrated, accessToken, router]);

  const showToast = (msg: string) => {
    setStatus(msg);
    setTimeout(() => {
      setStatus((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const loadAccountData = useCallback(async () => {
    if (!accessToken) return;

    const [pRes, sRes, setRes, fRes, rRes, cRes] = await Promise.all([
      authFetch('/profiles', { cache: 'no-store' }).catch(() => null),
      authFetch('/auth/sessions', { cache: 'no-store' }).catch(() => null),
      authFetch('/settings', { cache: 'no-store' }).catch(() => null),
      authFetch('/social/friends', { cache: 'no-store' }).catch(() => null),
      authFetch('/social/ratings/me', { cache: 'no-store' }).catch(() => null),
      authFetch('/social/collections/me', { cache: 'no-store' }).catch(() => null),
    ]);

    if (pRes?.ok) setProfiles(await pRes.json());
    if (sRes?.ok) setSessions(await sRes.json());
    if (fRes?.ok) setFriendsData(await fRes.json());
    if (rRes?.ok) setMyRatings(await rRes.json());
    if (cRes?.ok) setMyCollections(await cRes.json());
    if (setRes?.ok) {
      const serverSettings = await setRes.json();
      setSettings(serverSettings);
      // Do NOT overwrite user's active local theme/language on page visit!
    }
  }, [accessToken, setProfiles]);

  useEffect(() => {
    if (accessToken) {
      loadAccountData();
    }
  }, [accessToken, loadAccountData]);

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

  const updateActiveProfileMedia = async (patch: { avatarUrl?: string; bannerUrl?: string }) => {
    if (!accessToken || !activeProfile) return;
    const res = await authFetch(`/profiles/${activeProfile.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      showToast(patch.avatarUrl ? 'Аватар обновлён' : 'Баннер обновлён');
      setShowMediaPicker(null);
      await loadAccountData();
    } else {
      showToast('Не удалось сохранить изображение (проверьте размер до 10 МБ)');
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'avatarUrl' | 'bannerUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Файл слишком большой — выберите изображение до 10 МБ');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const dataUrl = reader.result;

      // Keep animated GIFs under 1.5 MB intact; compress static images via canvas
      if (file.type === 'image/gif' && file.size < 1.5 * 1024 * 1024) {
        updateActiveProfileMedia({ [field]: dataUrl });
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        try {
          const maxW = field === 'avatarUrl' ? 360 : 1280;
          const maxH = field === 'avatarUrl' ? 360 : 540;
          let width = img.width || maxW;
          let height = img.height || maxH;
          const ratio = Math.min(maxW / width, maxH / height, 1);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            updateActiveProfileMedia({ [field]: compressed });
            return;
          }
        } catch {}
        updateActiveProfileMedia({ [field]: dataUrl });
      };
      img.onerror = () => updateActiveProfileMedia({ [field]: dataUrl });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRevokeSession = async (id: string) => {
    if (!accessToken) return;
    const res = await authFetch(`/auth/sessions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Сессия завершена');
      await loadAccountData();
    }
  };

  const handleUpdateSetting = async (patch: Record<string, any>) => {
    if (!accessToken) return;
    const res = await authFetch('/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setSettings(await res.json());
      showToast('Настройки сохранены');
    }
  };

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendEmail.trim() || !accessToken) return;
    const res = await authFetch('/social/friends/request', {
      method: 'POST',
      body: JSON.stringify({ email: friendEmail.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setFriendEmail('');
      showToast('Запрос в друзья отправлен');
      await loadAccountData();
    } else {
      showToast(data?.message || 'Не удалось отправить запрос в друзья');
    }
  };

  const handleAcceptFriend = async (requestId: string) => {
    if (!accessToken) return;
    const res = await authFetch(`/social/friends/${requestId}/accept`, {
      method: 'POST',
    });
    if (res.ok) {
      showToast('Пользователь добавлен в друзья!');
      await loadAccountData();
    }
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    if (!accessToken) return;
    const res = await authFetch(`/social/friends/${friendshipId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      showToast('Удалено из списка друзей / запросов');
      await loadAccountData();
    }
  };

  const handleDeleteRating = async (tmdbId: number, mediaType: string) => {
    if (!accessToken) return;
    const res = await authFetch(
      `/social/ratings/${tmdbId}?mediaType=${encodeURIComponent(mediaType)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      showToast('Оценка удалена из витрины профиля');
      await loadAccountData();
    }
  };

  const handleRemoveFavoriteMovie = (item: {
    id: string | number;
    tmdbId?: number;
  }) => {
    removeFromFavorites(item.id);
    if (item.tmdbId) {
      removeFromFavorites(item.tmdbId);
    }
    showToast('Убрано из «Любимых фильмов»');
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColTitle.trim() || !accessToken) return;
    const res = await authFetch('/social/collections', {
      method: 'POST',
      body: JSON.stringify({
        title: newColTitle.trim(),
        description: newColDesc.trim() || undefined,
        isPublic: true,
      }),
    });
    if (res.ok) {
      setNewColTitle('');
      setNewColDesc('');
      showToast('Подборка создана!');
      await loadAccountData();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err?.message || 'Не удалось создать подборку');
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!accessToken) return;
    const res = await authFetch(`/social/collections/${collectionId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      showToast('Подборка удалена');
      await loadAccountData();
    }
  };

  const handleRemoveCollectionItem = async (
    collectionId: string,
    tmdbId: number,
    mediaType: string
  ) => {
    if (!accessToken) return;
    const res = await authFetch(
      `/social/collections/${collectionId}/items/${tmdbId}?mediaType=${encodeURIComponent(mediaType)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      showToast('Фильм убран из подборки');
      await loadAccountData();
    }
  };

  const handleCopyProfileLink = async () => {
    if (!user) return;
    const url = `${window.location.origin}/user/${user.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Ссылка на вашу публичную витрину скопирована!');
    } catch {
      showToast(`Ссылка на ваш профиль: ${url}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/auth');
  };

  if (!hydrated || !user) return null;

  // Favorite movies are 100% separate from ratings (added via the ❤️ Heart button without any automatic rating)
  const favoriteMovies = favorites.map((f) => ({
    id: String(f.id),
    routeId: String(f.id),
    tmdbId: Number(f.tmdbId) || 0,
    mediaType: (f.type === 'tv' ? 'SERIES' : 'MOVIE') as 'MOVIE' | 'SERIES',
    title: f.title,
    posterPath: f.posterPath || null,
    releaseYear: f.releaseYear,
  }));
  const isEn = language === 'en';

  const avgRating =
    myRatings.length > 0
      ? (myRatings.reduce((s, r) => s + Number(r.rating || 0), 0) / myRatings.length).toFixed(1)
      : '—';

  const tabs: { id: ProfileTab; label: string; icon: any; badge?: number }[] = [
    { id: 'overview', label: isEn ? 'Showcase & Lists' : 'Витрина и подборки', icon: Sparkles },
    {
      id: 'friends',
      label: isEn ? 'Friends' : 'Друзья',
      icon: Users,
      badge: friendsData.incomingRequests.length,
    },
    { id: 'settings', label: isEn ? 'Settings' : 'Настройки', icon: Sliders },
    { id: 'security', label: isEn ? 'Sessions' : 'Сессии', icon: Shield },
  ];

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-20 md:pt-16 pb-24 min-h-screen bg-[#09090D] space-y-6">
      {/* Hidden File Inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'avatarUrl')}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'bannerUrl')}
      />

      {/* Hero Profile Card */}
      <div className="rounded-3xl overflow-hidden bg-[#111119] border border-[#292936] shadow-2xl">
        {/* Banner Area */}
        <div
          className="relative h-44 sm:h-56 w-full profile-banner-bg bg-cover bg-center"
          style={
            activeProfile?.bannerUrl
              ? { backgroundImage: `url(${activeProfile.bannerUrl})` }
              : undefined
          }
        >
          <div className="absolute inset-0 profile-banner-fade" />

          {/* Banner Edit Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/15 text-xs font-semibold text-white transition-all"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#A18BFF]" />
              <span className="hidden sm:inline">Загрузить баннер</span>
            </button>
          </div>
        </div>

        {/* Avatar + User Info + Quick Actions */}
        <div className="px-6 pb-6 -mt-14 relative space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              {/* Avatar */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#181821] profile-avatar-ring flex items-center justify-center">
                  {activeProfile?.avatarUrl ? (
                    <img
                      src={activeProfile.avatarUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-black text-[#A18BFF] uppercase">
                      {user.name.slice(0, 1)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Загрузить аватар"
                  className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                >
                  <Camera className="w-6 h-6" />
                </button>
              </div>

              <div className="pb-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-black text-white truncate">
                  {user.name}
                </h1>
                <p className="text-xs text-[#92929F] truncate">{user.email}</p>
                <div className="flex flex-wrap items-center gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-xs font-semibold text-[#A18BFF] hover:underline"
                  >
                    Сменить аватар
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/messages"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl brand-btn text-white text-xs font-bold transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Чат</span>
              </Link>
              <Link
                href={`/user/${user.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#181821] hover:bg-[#8065FF]/20 border border-[#292936] hover:border-[#8065FF] text-white text-xs font-semibold transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#A18BFF]" />
                <span>Моя витрина</span>
              </Link>
              <button
                type="button"
                onClick={handleCopyProfileLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#181821] hover:bg-[#8065FF]/20 border border-[#292936] hover:border-[#8065FF] text-[#92929F] hover:text-white text-xs font-semibold transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Поделиться</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-semibold transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Выйти</span>
              </button>
            </div>
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-[#181821] border border-[#292936]">
              <p className="text-xl font-black text-rose-400">{favoriteMovies.length}</p>
              <p className="text-[11px] font-medium text-[#92929F]">
                {isEn ? 'Favorite Titles' : 'Любимых фильмов'}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#181821] border border-[#292936]">
              <p className="text-xl font-black text-white">{myRatings.length}</p>
              <p className="text-[11px] font-medium text-[#92929F]">
                {isEn ? 'Rated Titles' : 'Моих оценок'}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#181821] border border-[#292936]">
              <p className="text-xl font-black text-[#A18BFF]">{avgRating}</p>
              <p className="text-[11px] font-medium text-[#92929F]">
                {isEn ? 'Average Rating' : 'Средняя оценка'}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#181821] border border-[#292936]">
              <p className="text-xl font-black text-white">{watchlist.length}</p>
              <p className="text-[11px] font-medium text-[#92929F]">
                {isEn ? 'In Watchlist' : 'В вотчлисте'}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#181821] border border-[#292936]">
              <p className="text-xl font-black text-white">{myCollections.length}</p>
              <p className="text-[11px] font-medium text-[#92929F]">
                {isEn ? 'Collections' : 'Подборок'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Toast */}
      {status && (
        <div className="px-4 py-3 rounded-2xl bg-[#8065FF]/15 border border-[#8065FF]/40 text-sm text-white flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#A18BFF]" />
            <span>{status}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatus(null)}
            className="text-xs text-[#92929F] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'brand-btn text-white shadow-lg'
                  : 'bg-[#111119] border border-[#292936] text-[#92929F] hover:text-white hover:border-[#8065FF]/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {Boolean(tab.badge) && (
                <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =================================================================
          TAB 1: OVERVIEW (Favorite Movies, Watchlist, My Ratings, Collections)
         ================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 1. Favorite Movies (Separated from Ratings) */}
          <section className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 text-white font-bold text-lg">
                <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
                <span>
                  {isEn ? 'Favorite Movies & Series' : 'Любимые фильмы и сериалы'} (
                  {favoriteMovies.length})
                </span>
              </div>
              <span className="text-xs text-[#92929F]">
                {isEn
                  ? 'Titles added with the ❤️ Heart button on any movie, series, or anime page'
                  : 'Тайтлы, добавленные нажатием на сердечко ❤️ на странице фильма, сериала или аниме'}
              </span>
            </div>

            {favoriteMovies.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#181821]/60 border border-[#292936] text-center">
                <p className="text-xs text-[#92929F]">
                  {isEn
                    ? 'No favorite movies yet. Click the ❤️ "В любимые" button on any movie or anime page!'
                    : 'Любимых фильмов пока нет. Нажмите кнопку ❤️ «В любимые» на странице любого фильма, сериала или аниме!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {favoriteMovies.map((item) => (
                  <div
                    key={`fav-${item.id}`}
                    className="group relative rounded-2xl overflow-hidden bg-[#181821] border border-[#292936] hover:border-rose-500/60 brand-card-hover transition-all flex flex-col"
                  >
                    <Link
                      href={`/movie/${item.routeId || item.tmdbId}?type=${
                        item.mediaType === 'SERIES' ? 'tv' : 'movie'
                      }`}
                      className="block relative aspect-[2/3] w-full overflow-hidden bg-[#09090D]"
                    >
                      {item.posterPath ? (
                        <img
                          src={item.posterPath}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#1B1A2B] to-[#0D0D14]">
                          <Film className="w-8 h-8 text-rose-400/70 mb-2" />
                          <span className="text-xs font-bold text-white/80 line-clamp-2">
                            {item.title}
                          </span>
                        </div>
                      )}

                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-rose-500/90 text-[10px] font-bold text-white flex items-center gap-1 shadow-md">
                        <Heart className="w-2.5 h-2.5 fill-white" />
                        <span>{isEn ? 'Fav' : 'Любимый'}</span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end p-2.5">
                        <p className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">
                          {item.title}
                        </p>
                        {item.releaseYear && (
                          <p className="text-[10px] text-white/70 mt-0.5">{item.releaseYear}</p>
                        )}
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleRemoveFavoriteMovie(item)}
                      title={isEn ? 'Remove from Favorites' : 'Убрать из любимых'}
                      className="absolute bottom-2.5 right-2.5 p-1.5 rounded-lg bg-black/75 hover:bg-red-500 text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. User Watchlist in Profile */}
          <section className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 text-white font-bold text-lg">
                <Bookmark className="w-5 h-5 text-[#A18BFF] fill-[#A18BFF]/20" />
                <span>
                  {isEn ? 'My Watchlist' : 'Мой вотчлист'} ({watchlist.length})
                </span>
              </div>
              <Link
                href="/watchlist"
                className="text-xs font-semibold text-[#A18BFF] hover:underline"
              >
                {isEn ? 'Open full watchlist →' : 'Открыть весь вотчлист →'}
              </Link>
            </div>

            {watchlist.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#181821]/60 border border-[#292936] text-center">
                <p className="text-xs text-[#92929F]">
                  {isEn
                    ? 'Your watchlist is empty. Click the heart/bookmark button on any movie or anime.'
                    : 'Ваш вотчлист пока пуст. Нажмите на сердечко на странице любого фильма, сериала или аниме.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {watchlist.map((item) => (
                  <div
                    key={`wl-${item.id}`}
                    className="group relative rounded-2xl overflow-hidden bg-[#181821] border border-[#292936] hover:border-[#8065FF] brand-card-hover transition-all flex flex-col"
                  >
                    <Link
                      href={`/movie/${item.id}?type=${item.type || 'movie'}`}
                      className="block relative aspect-[2/3] w-full overflow-hidden bg-[#09090D]"
                    >
                      {item.posterPath ? (
                        <img
                          src={item.posterPath}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#1B1A2B] to-[#0D0D14]">
                          <Film className="w-8 h-8 text-[#8065FF]/70 mb-2" />
                          <span className="text-xs font-bold text-white/80 line-clamp-2">
                            {item.title}
                          </span>
                        </div>
                      )}

                      {item.voteAverage && item.voteAverage > 0 ? (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-bold text-[#A18BFF] border border-white/10">
                          ★ {Number(item.voteAverage).toFixed(1)}
                        </div>
                      ) : null}

                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end p-2.5">
                        <p className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">
                          {item.title}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-white/70 mt-1">
                          <span>{item.releaseYear || ''}</span>
                          <span className="uppercase">
                            {item.type === 'tv' ? t.seriesBadge : t.movieBadge}
                          </span>
                        </div>
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => removeFromWatchlist(item.id)}
                      title={isEn ? 'Remove from Watchlist' : 'Убрать из вотчлиста'}
                      className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/75 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. My Ratings & Reviews (Separated from Favorite Movies) */}
          <section className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 text-white font-bold text-lg">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span>
                  {isEn ? 'My Ratings & Reviews' : 'Мои оценки и отзывы'} ({myRatings.length})
                </span>
              </div>
              <span className="text-xs text-[#92929F]">
                {isEn
                  ? 'All titles you have rated from 1 to 10'
                  : 'Все фильмы, сериалы и аниме, которым вы поставили оценку 1–10'}
              </span>
            </div>

            {myRatings.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#181821]/60 border border-[#292936] text-center">
                <p className="text-xs text-[#92929F]">
                  {isEn
                    ? 'No ratings yet. Open any movie and click "Rate" (1–10).'
                    : 'Оценок пока нет. Откройте любой фильм и нажмите «Оценить» (1–10).'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {myRatings.map((item) => (
                  <div
                    key={`rate-${item.id}`}
                    className="group relative rounded-2xl overflow-hidden bg-[#181821] border border-[#292936] hover:border-[#8065FF] brand-card-hover transition-all flex flex-col"
                  >
                    <Link
                      href={`/movie/${item.tmdbId}?type=${
                        item.mediaType === 'SERIES' ? 'tv' : 'movie'
                      }`}
                      className="block relative aspect-[2/3] w-full overflow-hidden bg-[#09090D]"
                    >
                      {item.posterPath ? (
                        <img
                          src={item.posterPath}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#1B1A2B] to-[#0D0D14]">
                          <Film className="w-8 h-8 text-[#8065FF]/70 mb-2" />
                          <span className="text-xs font-bold text-white/80 line-clamp-2">
                            {item.title}
                          </span>
                        </div>
                      )}

                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-bold text-amber-300 border border-amber-400/30 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{item.rating}/10</span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/95 via-black/65 to-transparent flex flex-col justify-end p-2.5">
                        <p className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">
                          {item.title}
                        </p>
                        {item.review && (
                          <p className="text-[11px] text-white/75 line-clamp-2 mt-1 italic">
                            «{item.review}»
                          </p>
                        )}
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDeleteRating(item.tmdbId, item.mediaType)}
                      title={isEn ? 'Delete rating' : 'Удалить оценку'}
                      className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/75 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. My Custom Movie Collections */}
          <section className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 text-white font-bold text-lg">
                <ListPlus className="w-5 h-5 text-[#A18BFF]" />
                <span>
                  {isEn ? 'My Collections' : 'Мои подборки'} ({myCollections.length})
                </span>
              </div>
              <span className="text-xs text-[#92929F]">
                {isEn
                  ? 'Create themed lists — visible to friends on your public showcase'
                  : 'Собирайте тематические списки — они видны друзьям на вашей витрине'}
              </span>
            </div>

            <form onSubmit={handleCreateCollection} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                placeholder={isEn ? 'Collection title...' : 'Название (напр. Топ киберпанка)...'}
                className="px-4 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
              />
              <input
                type="text"
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
                placeholder={isEn ? 'Description (optional)...' : 'Описание (необязательно)...'}
                className="px-4 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl brand-btn text-white text-xs font-bold transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Create Collection' : 'Создать подборку'}</span>
              </button>
            </form>

            {myCollections.length === 0 ? (
              <p className="text-xs text-[#92929F]">
                {isEn
                  ? 'No collections yet. Create one above or click "+ Collection" on any movie page.'
                  : 'Подборок пока нет. Создайте первую выше или нажмите «В подборку» на странице любого фильма.'}
              </p>
            ) : (
              <div className="space-y-4">
                {myCollections.map((col) => (
                  <div
                    key={col.id}
                    className="p-5 rounded-2xl bg-[#181821] border border-[#292936] space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <span>{col.title}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#8065FF]/15 text-[#A18BFF]">
                            {col.items?.length || 0} {isEn ? 'items' : 'шт.'}
                          </span>
                        </h3>
                        {col.description && (
                          <p className="text-xs text-[#92929F] mt-0.5">{col.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCollection(col.id)}
                        title={isEn ? 'Delete collection' : 'Удалить подборку'}
                        className="p-1.5 text-[#92929F] hover:text-red-400 rounded-lg shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {!col.items || col.items.length === 0 ? (
                      <p className="text-xs text-[#92929F] italic">
                        {isEn
                          ? 'Empty — open any movie and click "Add to Collection".'
                          : 'Пока пусто — откройте любой фильм и нажмите «В подборку».'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                        {col.items.map((item: any) => (
                          <div
                            key={item.id}
                            className="relative group rounded-2xl overflow-hidden bg-[#111119] border border-[#292936] hover:border-[#8065FF] brand-card-hover transition-all"
                          >
                            <Link
                              href={`/movie/${item.tmdbId}?type=${
                                item.mediaType === 'SERIES' ? 'tv' : 'movie'
                              }`}
                              className="block relative aspect-[2/3] w-full overflow-hidden bg-[#09090D]"
                            >
                              {item.posterPath ? (
                                <img
                                  src={item.posterPath}
                                  alt={item.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Film className="w-7 h-7 text-[#92929F]" />
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/95 via-black/55 to-transparent flex flex-col justify-end p-2.5">
                                <p className="text-xs font-bold text-white line-clamp-2 leading-snug">
                                  {item.title}
                                </p>
                              </div>
                            </Link>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveCollectionItem(col.id, item.tmdbId, item.mediaType)
                              }
                              title={isEn ? 'Remove from collection' : 'Убрать из подборки'}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/75 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-10"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* =================================================================
          TAB 2: FRIENDS & REQUESTS
         ================================================================= */}
      {activeTab === 'friends' && (
        <section className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-5 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Users className="w-5 h-5 text-[#A18BFF]" />
              <span>Друзья ({friendsData.friends.length})</span>
            </div>
            <Link
              href="/messages"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl brand-btn text-white text-xs font-bold"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Открыть мессенджер</span>
            </Link>
          </div>

          <form onSubmit={handleSendFriendRequest} className="flex flex-wrap gap-3">
            <input
              type="email"
              required
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              placeholder="Введите email друга, чтобы отправить запрос..."
              className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl brand-btn text-white text-xs font-bold transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Добавить в друзья</span>
            </button>
          </form>

          {/* Incoming Friend Requests */}
          {friendsData.incomingRequests.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#A18BFF]">
                Входящие запросы ({friendsData.incomingRequests.length})
              </p>
              {friendsData.incomingRequests.map((req) => (
                <div
                  key={req.requestId}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181821] border border-[#8065FF]/40"
                >
                  <span className="text-sm font-semibold text-white">{req.from.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAcceptFriend(req.requestId)}
                      className="px-3.5 py-1.5 rounded-xl brand-btn text-white text-xs font-bold"
                    >
                      Принять
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveFriend(req.requestId)}
                      className="px-3 py-1.5 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-[#92929F] hover:text-white"
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Accepted Friends List */}
          {friendsData.friends.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#181821] border border-[#292936] text-center space-y-2">
              <Users className="w-8 h-8 text-[#A18BFF] mx-auto opacity-60" />
              <p className="text-sm font-bold text-white">Список друзей пока пуст</p>
              <p className="text-xs text-[#92929F]">
                Добавьте друга по email выше, чтобы переписываться в чате и отправлять друг другу
                фильмы.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {friendsData.friends.map((f) => (
                <div
                  key={f.friendshipId}
                  className="flex items-center justify-between p-4 rounded-2xl bg-[#181821] border border-[#292936] hover:border-[#8065FF]/60 transition-all"
                >
                  <Link href={`/user/${f.user.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#09090D] flex items-center justify-center shrink-0">
                      {f.user.avatarUrl ? (
                        <img
                          src={f.user.avatarUrl}
                          alt={f.user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-[#A18BFF] uppercase">
                          {f.user.name.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{f.user.name}</p>
                      <p className="text-xs text-[#92929F]">
                        Любимых: {f.favoritesCount} • Оценок: {f.ratingsCount}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    <Link
                      href={`/messages?friend=${f.user.id}`}
                      title="Написать сообщение"
                      className="p-2 text-[#A18BFF] hover:bg-[#8065FF]/20 rounded-xl transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRemoveFriend(f.friendshipId)}
                      title="Удалить из друзей"
                      className="p-2 text-[#92929F] hover:text-red-400 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* =================================================================
          TAB 3: INTERFACE & PLAYBACK SETTINGS
         ================================================================= */}
      {activeTab === 'settings' && (
        <section className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-5 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-white font-bold text-lg">
            <Sliders className="w-5 h-5 text-[#A18BFF]" />
            <span>{t.profileSettings}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Theme Switcher */}
            <div className="p-4 rounded-2xl bg-[#181821] border border-[#292936] flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">{t.themeLabel}</span>
              <div className="flex items-center gap-1.5 bg-[#09090D] p-1 rounded-xl border border-[#292936]">
                <button
                  type="button"
                  onClick={() => {
                    setTheme('dark');
                    handleUpdateSetting({ theme: 'dark' });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    theme === 'dark'
                      ? 'brand-btn text-white'
                      : 'text-[#92929F] hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>{t.themeDark}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTheme('light');
                    handleUpdateSetting({ theme: 'light' });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    theme === 'light'
                      ? 'brand-btn text-white'
                      : 'text-[#92929F] hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>{t.themeLight}</span>
                </button>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="p-4 rounded-2xl bg-[#181821] border border-[#292936] flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#A18BFF]" />
                {t.languageLabel}
              </span>
              <div className="flex items-center gap-1.5 bg-[#09090D] p-1 rounded-xl border border-[#292936]">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('ru');
                    handleUpdateSetting({ language: 'ru' });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    language === 'ru'
                      ? 'brand-btn text-white'
                      : 'text-[#92929F] hover:text-white'
                  }`}
                >
                  Русский
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    handleUpdateSetting({ language: 'en' });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    language === 'en'
                      ? 'brand-btn text-white'
                      : 'text-[#92929F] hover:text-white'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          {/* Theme Mode Picker */}
          <div className="p-4 rounded-2xl bg-[#181821] border border-[#292936] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-sm font-medium text-white">{t.themeLabel}</span>
            <div className="flex flex-wrap items-center gap-2">
              {THEME_PRESETS.map((tp) => {
                const isSelected = theme === tp.id;
                return (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => {
                      setTheme(tp.id);
                      handleUpdateSetting({ theme: tp.id });
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-[#8065FF] bg-[#8065FF]/15 text-white'
                        : 'border-[#292936] bg-[#09090D] text-[#92929F] hover:text-white'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/25 shrink-0"
                      style={{ backgroundColor: tp.bg }}
                    />
                    <span>{language === 'en' ? tp.nameEn : tp.nameRu}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Palette Picker */}
          <div className="p-4 rounded-2xl bg-[#181821] border border-[#292936] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#A18BFF]" />
              <span className="text-sm font-medium text-white">{t.accentLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = accentColor.toLowerCase() === preset.main.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setAccentColor(preset.main);
                      handleUpdateSetting({ accentColor: preset.main });
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-[#8065FF] bg-[#8065FF]/15 text-white'
                        : 'border-[#292936] bg-[#09090D] text-[#92929F] hover:text-white'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: preset.main }}
                    />
                    <span>{language === 'en' ? preset.nameEn : preset.nameRu}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* New Year Festive Mode */}
          <label className="flex items-center justify-between p-4 rounded-2xl bg-[#181821] border border-[#292936] cursor-pointer">
            <div>
              <span className="text-sm font-medium text-white">
                ❄️ {language === 'en' ? 'New Year Festive Theme' : 'Новогодняя тема'}
              </span>
              <p className="text-xs text-[#92929F] mt-0.5">
                {language === 'en'
                  ? 'Gentle snowfall and glowing garland lights across the site'
                  : 'Лёгкий снегопад и мерцающая гирлянда по всему сайту'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={newYearMode}
              onChange={(e) => setNewYearMode(e.target.checked)}
              className="w-4 h-4 accent-[#8065FF]"
            />
          </label>

          {/* 18+ Age Restriction Toggle */}
          <label className="flex items-center justify-between p-4 rounded-2xl bg-[#181821] border border-[#292936] cursor-pointer">
            <div>
              <span className="text-sm font-medium text-white">
                🔞 {language === 'en' ? '18+ Adult Content Access' : 'Доступ к контенту 18+'}
              </span>
              <p className="text-xs text-[#92929F] mt-0.5">
                {language === 'en'
                  ? 'When disabled, 18+ posters are blurred and opening an adult title requires age confirmation'
                  : 'Если выключено — постеры 18+ размываются, а при открытии фильма требуется подтверждение возраста'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={ageVerified18}
              onChange={(e) => setAgeVerified18(e.target.checked)}
              className="w-4 h-4 accent-[#8065FF]"
            />
          </label>

          {/* Playback Settings */}
          {settings && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-4 rounded-2xl bg-[#181821] border border-[#292936] cursor-pointer">
                <span className="text-sm text-white">{t.autoplayNext}</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.autoplayNext)}
                  onChange={(e) => handleUpdateSetting({ autoplayNext: e.target.checked })}
                  className="w-4 h-4 accent-[#8065FF]"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-[#181821] border border-[#292936] cursor-pointer">
                <span className="text-sm text-white">{t.subtitlesDefault}</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.subtitlesEnabled)}
                  onChange={(e) => handleUpdateSetting({ subtitlesEnabled: e.target.checked })}
                  className="w-4 h-4 accent-[#8065FF]"
                />
              </label>
            </div>
          )}
        </section>
      )}

      {/* =================================================================
          TAB 4: SECURITY & ACTIVE SESSIONS
         ================================================================= */}
      {activeTab === 'security' && (
        <section className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-4 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-white font-bold text-lg">
            <Shield className="w-5 h-5 text-[#A18BFF]" />
            <span>Активные сессии ({sessions.length})</span>
          </div>

          <div className="space-y-2.5">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-[#181821] border border-[#292936]"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="w-4 h-4 text-[#A18BFF]" />
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {s.deviceName || 'Web Browser'}{' '}
                      {s.isCurrent && (
                        <span className="text-[11px] text-emerald-400 font-medium ml-1">
                          (Текущая)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#92929F]">{s.ipAddress || 'localhost'}</p>
                  </div>
                </div>

                {!s.isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleRevokeSession(s.id)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-xs text-red-400 font-semibold transition-colors"
                  >
                    Завершить
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

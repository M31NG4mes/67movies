'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Play,
  Star,
  Heart,
  Clock,
  Calendar,
  ShieldAlert,
  ArrowLeft,
  MessageSquare,
  ThumbsUp,
  Share2,
  Check,
  X,
  Send,
  Film,
  Youtube,
  FolderPlus,
  Award,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { MediaItem, Season } from '@cinemaflow/types';
import { EpisodePicker } from '../../../components/media/EpisodePicker';
import { MediaRail } from '../../../components/media/MediaRail';
import { useUiStore } from '../../../stores/ui.store';
import { authFetch, useAuthStore } from '../../../stores/auth.store';
import { useLibraryStore } from '../../../stores/library.store';
import { usePreferencesStore } from '../../../stores/preferences.store';
import { mockMoviesCatalog, mockSeriesCatalog } from '../../../lib/catalog-data';

interface CommentItem {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  date: string;
  text: string;
  likes: number;
  isLiked?: boolean;
}

function getNumericMediaId(media: MediaItem | null): number {
  if (!media) return 0;
  if (media.tmdbId && Number.isFinite(Number(media.tmdbId))) {
    return Number(media.tmdbId);
  }
  const raw = String(media.id || '').trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const kp = /^kp-(\d+)$/i.exec(raw);
  if (kp) return 1_000_000_000 + (Number(kp[1]) % 200_000_000);
  const mal = /^mal-(\d+)$/i.exec(raw);
  if (mal) return 1_200_000_000 + (Number(mal[1]) % 200_000_000);
  const tvm = /^tvmaze-(\d+)$/i.exec(raw);
  if (tvm) return 1_400_000_000 + (Number(tvm[1]) % 200_000_000);
  const omdb = /^(?:omdb-)?tt(\d+)$/i.exec(raw);
  if (omdb) return 1_600_000_000 + (Number(omdb[1]) % 200_000_000);
  const al = /^al-(\d+)$/i.exec(raw);
  if (al) return 1_800_000_000 + (Number(al[1]) % 200_000_000);
  if (media.kinopoiskId) return 1_000_000_000 + (Number(media.kinopoiskId) % 200_000_000);
  return 0;
}

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mediaId = String(params?.id || '');
  const isAniLibertyId = /^al-\d+$/i.test(mediaId);
  const rawType = searchParams?.get('type');
  const mediaTypeParam = rawType === 'tv' ? 'tv' : rawType === 'movie' ? 'movie' : undefined;

  const activeProfile = useUiStore((s) => s.activeProfile);

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);

  // Favorites & User Rating State
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState<number>(0);

  // Comments State
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentRating, setNewCommentRating] = useState(9);
  const [comments, setComments] = useState<CommentItem[]>([
    {
      id: 'c1',
      author: 'Александр Романов',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
      rating: 10,
      date: 'Вчера, 21:40',
      text: 'Невероятная кинематография и звук! Визуальный ряд захватывает дух с первых минут. Дени Вильнёв создал настоящий шедевр научной фантастики.',
      likes: 42,
    },
    {
      id: 'c2',
      author: 'Екатерина Смирнова',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
      rating: 9,
      date: '2 дня назад',
      text: 'Актерская игра на высшем уровне. Особенно впечатлило раскрытие персонажей и музыкальное сопровождение Ханса Циммера.',
      likes: 19,
    },
    {
      id: 'c3',
      author: 'Дмитрий Волков',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
      rating: 8,
      date: '3 дня назад',
      text: 'Очень крепкая картина, рекомендую смотреть строго в 4K с хорошей акустикой. Финал оставляет мощное послевкусие.',
      likes: 11,
    },
  ]);

  // Load Media from TMDB / API
  useEffect(() => {
    if (!mediaId) return;

    let isMounted = true;
    setIsLoading(true);

    const fallbackItem =
      [...mockMoviesCatalog, ...mockSeriesCatalog].find((m) => m.id === mediaId) ||
      mockMoviesCatalog[0];

    api.media
      .getById(mediaId, mediaTypeParam)
      .then((data) => {
        if (!isMounted) return;
        const currentData = data || fallbackItem;
        setMedia(currentData);

        if (currentData.type === 'tv') {
          if (currentData.seasons?.[0]?.episodes?.length) {
            setSeasonData(currentData.seasons[0]);
          } else {
            const seasonLookupId = currentData.anilibertyId
              ? `al-${currentData.anilibertyId}`
              : mediaId;
            api.media
              .getTvSeason(seasonLookupId, 1)
              .then((s) => {
                if (isMounted && s) setSeasonData(s);
              })
              .catch(() => {});
          }
        }

        setIsLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setMedia(fallbackItem);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [mediaId, mediaTypeParam]);

  const { watchlist, hydrate: hydrateLibrary, toggleWatchlist, addToHistory } = useLibraryStore();
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const ageVerified18 = usePreferencesStore((s) => s.ageVerified18);
  const setAgeVerified18 = usePreferencesStore((s) => s.setAgeVerified18);

  const [communityStats, setCommunityStats] = useState<{
    averageRating: number;
    totalRatings: number;
    reviews: Array<{
      id: string;
      userId: string;
      authorName: string;
      authorAvatar: string | null;
      rating: number;
      review: string;
      isFavorite: boolean;
      updatedAt: string;
    }>;
  }>({ averageRating: 0, totalRatings: 0, reviews: [] });
  const [modalRating, setModalRating] = useState<number>(9);
  const [modalReview, setModalReview] = useState<string>('');
  const [modalFavorite, setModalFavorite] = useState<boolean>(true);
  const [savingReview, setSavingReview] = useState<boolean>(false);

  // External extras (Trailers, OMDb, KinopoiskDev, Jikan/MAL) + Custom Collections
  const [extras, setExtras] = useState<{
    trailers: Array<{ id: string; key: string; name: string; embedUrl: string; language: string }>;
    omdb: { imdbRating?: string; rottenTomatoes?: string; metacritic?: string; awards?: string } | null;
    kinopoisk: { kpRating?: number; facts?: string[] } | null;
    anime: { score?: number; studios: string[]; status?: string; broadcast?: string; url: string } | null;
  }>({ trailers: [], omdb: null, kinopoisk: null, anime: null });
  const [activeTrailerUrl, setActiveTrailerUrl] = useState<string | null>(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [myCollections, setMyCollections] = useState<any[]>([]);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [collectionToast, setCollectionToast] = useState<string | null>(null);

  // Send Movie to Friend modal state
  const [isSendFriendModalOpen, setIsSendFriendModalOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sendNote, setSendNote] = useState('');
  const [sentToFriendIds, setSentToFriendIds] = useState<string[]>([]);
  const [sendingToFriendId, setSendingToFriendId] = useState<string | null>(null);

  const loadCommunityReviews = React.useCallback(async () => {
    if (!media) return;
    const apiBase =
    process.env.NEXT_PUBLIC_API_URL || 'https://six7movies-api.onrender.com/api';
    const tmdbNum = getNumericMediaId(media);
    if (!tmdbNum) return;
    const mediaType = media.type === 'tv' ? 'SERIES' : 'MOVIE';
    try {
      const res = await fetch(
        `${apiBase}/social/movies/${tmdbNum}/reviews?mediaType=${mediaType}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        setCommunityStats(data);
        if (authUser) {
          const mine = data.reviews?.find((r: any) => r.userId === authUser.id);
          if (mine) {
            setUserRating(mine.rating);
            setModalRating(mine.rating);
            setModalReview(mine.review || '');
            setModalFavorite(Boolean(mine.isFavorite));
          }
        }
      }
    } catch {
      // keep silent when offline
    }
  }, [media, authUser]);

  useEffect(() => {
    hydrateLibrary();
  }, [hydrateLibrary]);

  useEffect(() => {
    if (media && media.title) {
      addToHistory(media);
      loadCommunityReviews();

      // Load trailers, OMDb, KinopoiskDev, and Jikan/MAL extras
      const apiBase =
    process.env.NEXT_PUBLIC_API_URL || 'https://six7movies-api.onrender.com/api';
      const tmdbId = String(media.tmdbId || media.id);
      const isAnime = Boolean(
        media.genres?.some((g) => g.id === 16) ||
          (media.originalTitle && /[\u3040-\u30ff\u4e00-\u9faf]/.test(media.originalTitle))
      );
      const sp = new URLSearchParams({
        type: media.type === 'tv' ? 'tv' : 'movie',
        title: media.title || '',
        originalTitle: media.originalTitle || '',
        year: String(media.releaseYear || ''),
        isAnime: String(isAnime),
      });
      if (media.imdbId) sp.set('imdbId', media.imdbId);

      fetch(`${apiBase}/media/extra/${encodeURIComponent(tmdbId)}?${sp.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setExtras(d);
        })
        .catch(() => {});
    }
  }, [media, addToHistory, loadCommunityReviews]);

  const openCollectionModal = async () => {
    setIsCollectionModalOpen(true);
    if (!accessToken) return;
    const res = await authFetch('/social/collections/me', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setMyCollections(await res.json());
  };

  const openSendFriendModal = async () => {
    setIsSendFriendModalOpen(true);
    setSentToFriendIds([]);
    if (!accessToken) return;
    setLoadingFriends(true);
    try {
      const res = await authFetch('/social/friends', { cache: 'no-store' }).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        setFriendsList(data.friends || []);
      }
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSendMovieToFriend = async (friendId: string, friendName: string) => {
    if (!media || !accessToken) return;
    setSendingToFriendId(friendId);
    try {
      const res = await authFetch(`/social/messages/${encodeURIComponent(friendId)}`, {
        method: 'POST',
        body: JSON.stringify({
          content: sendNote.trim() || `Рекомендую посмотреть «${media.title}»!`,
          movieTmdbId: getNumericMediaId(media) || 1,
          movieMediaType: media.type === 'tv' ? 'SERIES' : 'MOVIE',
          movieTitle: media.title,
          moviePosterPath: media.posterPath || media.backdropPath || undefined,
        }),
      });
      if (res.ok) {
        setSentToFriendIds((prev) => [...prev, friendId]);
        setCollectionToast(`Отправлено другу ${friendName}!`);
        setTimeout(() => setCollectionToast(null), 3500);
      }
    } finally {
      setSendingToFriendId(null);
    }
  };

  const handleAddToCollection = async (collectionId: string, collectionTitle: string) => {
    if (!media || !accessToken) return;
    const res = await authFetch(`/social/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({
        tmdbId: getNumericMediaId(media) || 1,
        mediaType: media.type === 'tv' ? 'SERIES' : 'MOVIE',
        title: media.title,
        posterPath: media.posterPath || media.backdropPath || undefined,
      }),
    });
    if (res.ok) {
      setCollectionToast(`Добавлено в подборку «${collectionTitle}»`);
      setIsCollectionModalOpen(false);
      setTimeout(() => setCollectionToast(null), 3500);
    }
  };

  const handleCreateAndAddCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionTitle.trim() || !media || !accessToken) return;
    const createRes = await authFetch('/social/collections', {
      method: 'POST',
      body: JSON.stringify({ title: newCollectionTitle.trim(), isPublic: true }),
    });
    if (createRes.ok) {
      const col = await createRes.json();
      setNewCollectionTitle('');
      await handleAddToCollection(col.id, col.title);
    }
  };

  const saveRatingToServer = async (ratingVal: number, reviewText: string, favFlag: boolean) => {
    if (!media) return;
    setUserRating(ratingVal);

    if (useAuthStore.getState().accessToken) {
      setSavingReview(true);
      try {
        await authFetch('/social/ratings', {
          method: 'POST',
          body: JSON.stringify({
            tmdbId: getNumericMediaId(media) || 1,
            mediaType: media.type === 'tv' ? 'SERIES' : 'MOVIE',
            title: media.title,
            posterPath: media.posterPath || media.backdropPath || undefined,
            rating: ratingVal,
            review: reviewText.trim() || undefined,
            isFavorite: favFlag,
          }),
        });
        await loadCommunityReviews();
      } finally {
        setSavingReview(false);
      }
    }
  };

  const handleDeleteOwnReview = async () => {
    if (!media || !accessToken) return;
    const tmdbNum = getNumericMediaId(media);
    const mediaType = media.type === 'tv' ? 'SERIES' : 'MOVIE';
    await authFetch(`/social/ratings/${tmdbNum}?mediaType=${mediaType}`, {
      method: 'DELETE',
    }).catch(() => {});
    setUserRating(null);
    setModalReview('');
    await loadCommunityReviews();
  };

  const handleSeasonChange = (seasonNum: number) => {
    setSelectedSeason(seasonNum);
    setSelectedEpisode(1);
    api.media
      .getTvSeason(mediaId, seasonNum)
      .then((s) => {
        if (s) setSeasonData(s);
      })
      .catch(() => {});
  };

  const anilibertyTargetId = isAniLibertyId
    ? mediaId
    : media?.anilibertyId
    ? `al-${media.anilibertyId}`
    : null;

  const handleEpisodeChange = (seasonNum: number, episodeNum: number) => {
    setSelectedSeason(seasonNum);
    setSelectedEpisode(episodeNum);

    // AniLiberty anime: play the episode right in the built-in HLS player
    if (anilibertyTargetId) {
      router.push(
        `/watch/${encodeURIComponent(anilibertyTargetId)}?season=${seasonNum}&episode=${episodeNum}`
      );
      return;
    }

    const apiBase =
      process.env.NEXT_PUBLIC_API_URL || 'https://six7movies-api.onrender.com/api';
    const kpParam = media?.kinopoiskId
      ? `&kinopoiskId=${encodeURIComponent(String(media.kinopoiskId))}`
      : '';
    const url = `${apiBase}/media/kinopoisk-redirect?tmdbId=${encodeURIComponent(
      String(media?.tmdbId || mediaId)
    )}${kpParam}&type=${encodeURIComponent(media?.type || 'tv')}&title=${encodeURIComponent(
      media?.title || ''
    )}&year=${encodeURIComponent(String(media?.releaseYear || ''))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    await saveRatingToServer(newCommentRating, newCommentText.trim(), newCommentRating >= 8);
    setNewCommentText('');
  };

  const toggleLikeComment = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const isLiked = !c.isLiked;
          return {
            ...c,
            isLiked,
            likes: isLiked ? c.likes + 1 : c.likes - 1,
          };
        }
        return c;
      })
    );
  };

  if (isLoading || !media) {
    return (
      <div className="w-screen h-screen bg-cinema-dark flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-brand-main border-t-transparent rounded-full animate-spin shadow-brand-glow" />
        <p className="text-sm font-medium text-cinema-muted">
          Загрузка информации о фильме 67movies...
        </p>
      </div>
    );
  }

  const isTv = media.type === 'tv';
  const is18Plus =
    media.ageRating === '18+' ||
    media.ageRating === 'R' ||
    media.ageRating === 'NC-17' ||
    media.ageRating === 'TV-MA' ||
    Boolean((media as any).adult);

  if (is18Plus && !ageVerified18) {
    return (
      <div className="relative min-h-screen bg-[#09090D] flex items-center justify-center px-4 py-16 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center blur-2xl opacity-25 scale-110"
          style={{
            backgroundImage: `url(${media.backdropPath || media.posterPath || ''})`,
          }}
        />
        <div className="relative z-10 w-full max-w-md bg-[#111119]/95 backdrop-blur-xl border border-red-500/40 rounded-3xl p-7 sm:p-8 text-center shadow-2xl space-y-5 animate-scaleIn">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-2xl font-black text-red-400">
            18+
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-white">
              Возрастное ограничение 18+
            </h1>
            <p className="text-xs sm:text-sm text-[#92929F] leading-relaxed">
              Фильм <strong className="text-white">«{media.title}»</strong> предназначен только для
              зрителей старше 18 лет. Подтвердите свой возраст, чтобы продолжить.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setAgeVerified18(true)}
              className="w-full py-3.5 rounded-xl brand-btn text-white text-sm font-bold"
            >
              Мне есть 18 лет — Открыть фильм
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full py-3 rounded-xl bg-[#181821] hover:bg-[#20202C] border border-[#292936] text-xs font-semibold text-[#92929F] hover:text-white transition-all"
            >
              ← Вернуться назад
            </button>
          </div>
        </div>
      </div>
    );
  }
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || 'https://six7movies-api.onrender.com/api';
  const kpParam = media.kinopoiskId
    ? `&kinopoiskId=${encodeURIComponent(String(media.kinopoiskId))}`
    : '';
  const kinopoiskUrl = `${apiBase}/media/kinopoisk-redirect?tmdbId=${encodeURIComponent(
    String(media.tmdbId || media.id)
  )}${kpParam}&type=${encodeURIComponent(media.type || 'movie')}&title=${encodeURIComponent(
    media.title || ''
  )}&year=${encodeURIComponent(String(media.releaseYear || ''))}`;

  const allSeasons: Season[] =
    media.seasons?.map((s) => {
      if (s.seasonNumber === selectedSeason && seasonData?.episodes) {
        return { ...s, episodes: seasonData.episodes };
      }
      return s;
    }) || (seasonData ? [seasonData] : []);

  return (
    <div className="bg-cinema-dark min-h-screen text-cinema-text pb-24">
      {/* 1. Backdrop Hero Header with Vignettes */}
      <div className="relative w-full h-[46vh] sm:h-[60vh] min-h-[340px] sm:min-h-[460px] max-h-[680px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url(${media.backdropPath || media.posterPath || ''})`,
          }}
        >
          {/* Gradients for text readability */}
          <div className="absolute inset-0 bg-hero-vignette-x w-full lg:w-4/5" />
          <div className="absolute inset-0 bg-hero-vignette-y" />
        </div>

        {/* Back navigation button (clears fixed header on mobile & desktop) */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 z-20">
          <button
            onClick={() => router.back()}
            data-nav-item="true"
            aria-label="Назад"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-white backdrop-blur-md transition-all text-xs font-semibold hero-keep-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Card with Poster & Info */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 sm:-mt-56 z-20">
        <div className="flex flex-col md:flex-row gap-6 sm:gap-8 lg:gap-12 items-start">
          {/* Left: Poster Card */}
          <div className="w-40 sm:w-56 lg:w-72 flex-shrink-0 mx-auto md:mx-0 rounded-2xl overflow-hidden bg-cinema-card border border-cinema-border shadow-2xl relative group">
            <div className="aspect-[2/3] w-full relative">
              {media.posterPath || media.backdropPath ? (
                <img
                  src={media.posterPath || media.backdropPath || ''}
                  alt={media.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#14141F] text-[#92929F] p-4 text-center">
                  <Film className="w-10 h-10 text-[#8065FF]/70 mb-2" />
                  <span className="text-xs font-bold text-white/80">{media.title}</span>
                </div>
              )}
              <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider text-brand-light bg-cinema-dark/80 border border-brand-main/40 rounded backdrop-blur-md">
                4K Ultra HD
              </span>
            </div>
          </div>

          {/* Right: Details & Action Buttons */}
          <div className="flex-1 space-y-5">
            {/* Badges & Meta */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
              {/* TMDB Rating */}
              <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-400/10 text-amber-300 border border-amber-400/30 rounded-lg backdrop-blur-md">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-bold">{media.voteAverage}</span>
                {media.voteCount && (
                  <span className="text-[11px] text-amber-300/60 font-normal">
                    ({media.voteCount.toLocaleString()})
                  </span>
                )}
              </span>

              {/* Age Rating */}
              <span className="px-2.5 py-1 text-xs font-bold text-cinema-text bg-cinema-surface border border-cinema-border rounded-lg">
                {media.ageRating || '16+'}
              </span>

              {/* Release Year */}
              <span className="flex items-center gap-1 text-cinema-muted bg-cinema-card px-2.5 py-1 rounded-lg border border-cinema-border">
                <Calendar className="w-3.5 h-3.5" />
                <span>{media.releaseYear}</span>
              </span>

              {/* Duration */}
              {media.durationMinutes && (
                <span className="flex items-center gap-1 text-cinema-muted bg-cinema-card px-2.5 py-1 rounded-lg border border-cinema-border">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{media.durationMinutes} мин</span>
                </span>
              )}

              {/* Genres */}
              <div className="flex flex-wrap gap-1.5 ml-1">
                {media.genres?.map((g) => (
                  <span
                    key={g.id}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-main/10 text-brand-light border border-brand-main/20"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Title & Tagline */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-cinema-text tracking-tight leading-tight">
                {media.title}
              </h1>
              {media.originalTitle && media.originalTitle !== media.title && (
                <p className="text-sm sm:text-base text-cinema-muted mt-1 font-medium">
                  {media.originalTitle}
                </p>
              )}
              {media.tagline && (
                <p className="text-sm sm:text-base font-medium text-brand-light italic mt-2">
                  «{media.tagline}»
                </p>
              )}
            </div>

            {/* Synopsis / Description */}
            <div className="space-y-2">
              <h2 className="text-xs uppercase tracking-wider font-bold text-cinema-muted">
                Описание фильма
              </h2>
              <p className="text-sm sm:text-base text-cinema-muted leading-relaxed max-w-3xl">
                {media.overview}
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Button: «Смотреть» -> built-in HLS player (AniLiberty) or Kinopoisk */}
              {anilibertyTargetId ? (
                <Link
                  href={`/watch/${encodeURIComponent(anilibertyTargetId)}?season=1&episode=${selectedEpisode}`}
                  data-nav-item="true"
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 sm:px-8 py-3.5 brand-btn text-white font-bold rounded-xl text-sm sm:text-base"
                >
                  <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                  <span>
                    {isTv ? `Смотреть серию ${selectedEpisode}` : 'Смотреть'}
                  </span>
                </Link>
              ) : (
                <a
                  href={kinopoiskUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-nav-item="true"
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 sm:px-8 py-3.5 brand-btn text-white font-bold rounded-xl text-sm sm:text-base"
                >
                  <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                  <span>Смотреть на Кинопоиске</span>
                </a>
              )}

              {/* Button: «Трейлер» (Official YouTube Trailer) */}
              {extras.trailers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTrailerUrl(extras.trailers[0].embedUrl)}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl font-semibold border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-200 transition-all text-sm"
                >
                  <Youtube className="w-4 h-4 text-red-400" />
                  <span>Трейлер</span>
                </button>
              )}

              {/* Button: «+ В подборку» (Letterboxd-style Lists) */}
              {accessToken && (
                <button
                  type="button"
                  onClick={openCollectionModal}
                  className="flex items-center gap-2 px-4 py-3.5 rounded-xl font-semibold border border-cinema-border bg-cinema-card hover:bg-cinema-surface hover:border-[#8065FF] text-cinema-text transition-all text-sm"
                >
                  <FolderPlus className="w-4 h-4 text-[#A18BFF]" />
                  <span>В подборку</span>
                </button>
              )}

              {/* Button: «Отправить другу» (Direct Movie Share in Messenger) */}
              {accessToken && (
                <button
                  type="button"
                  onClick={openSendFriendModal}
                  className="flex items-center gap-2 px-4 py-3.5 rounded-xl font-semibold border border-[#8065FF]/40 bg-[#8065FF]/15 hover:bg-[#8065FF]/25 hover:border-[#8065FF] text-[#A18BFF] transition-all text-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>Отправить другу</span>
                </button>
              )}

              {/* Button: «Оценить» */}
              <button
                onClick={() => setIsRatingModalOpen(true)}
                data-nav-item="true"
                className={`flex items-center gap-2 px-5 py-3.5 rounded-xl font-semibold border backdrop-blur-md transition-all text-sm ${
                  userRating
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                    : 'bg-cinema-card hover:bg-cinema-surface border-cinema-border text-cinema-text hover:border-brand-main/50'
                }`}
              >
                <Star
                  className={`w-4 h-4 ${
                    userRating ? 'fill-amber-400 text-amber-400' : 'text-amber-400'
                  }`}
                />
                <span>{userRating ? `Ваша оценка: ${userRating}/10` : 'Оценить'}</span>
              </button>

              {/* Button: «В вотчлист» */}
              <button
                onClick={() => {
                  const added = toggleWatchlist(media);
                  setIsFavorite(added);
                }}
                data-nav-item="true"
                aria-label="В вотчлист"
                className={`flex items-center gap-2 px-4 py-3.5 rounded-xl border backdrop-blur-md transition-all text-sm font-semibold ${
                  watchlist.some((w) => String(w.id) === String(media.tmdbId || media.id))
                    ? 'bg-[#8065FF]/20 border-[#8065FF] text-[#A18BFF]'
                    : 'bg-cinema-card hover:bg-cinema-surface border-cinema-border text-cinema-muted hover:text-white hover:border-brand-main/50'
                }`}
              >
                <Heart
                  className={`w-5 h-5 ${
                    watchlist.some((w) => String(w.id) === String(media.tmdbId || media.id))
                      ? 'fill-[#A18BFF] text-[#A18BFF]'
                      : ''
                  }`}
                />
              </button>
            </div>

            {collectionToast && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-semibold text-emerald-200 animate-fadeIn">
                {collectionToast}
              </div>
            )}

            {/* Multi-Source Ratings & Anime/Awards Info (OMDb, KinopoiskDev, Jikan/MAL) */}
            {(extras.omdb || extras.kinopoisk || extras.anime) && (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {extras.omdb?.imdbRating && (
                  <span className="px-3 py-1 rounded-xl bg-amber-400/15 border border-amber-400/35 text-xs font-bold text-amber-300">
                    IMDb {extras.omdb.imdbRating}
                  </span>
                )}
                {extras.omdb?.rottenTomatoes && (
                  <span className="px-3 py-1 rounded-xl bg-red-500/15 border border-red-500/35 text-xs font-bold text-red-300">
                    🍅 RT {extras.omdb.rottenTomatoes}
                  </span>
                )}
                {extras.omdb?.metacritic && (
                  <span className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs font-bold text-emerald-300">
                    Metacritic {extras.omdb.metacritic}
                  </span>
                )}
                {extras.kinopoisk?.kpRating && (
                  <span className="px-3 py-1 rounded-xl bg-orange-500/15 border border-orange-500/35 text-xs font-bold text-orange-300">
                    КП {extras.kinopoisk.kpRating}
                  </span>
                )}
                {extras.anime?.score && (
                  <a
                    href={extras.anime.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-xl bg-sky-500/15 border border-sky-500/35 text-xs font-bold text-sky-300 hover:bg-sky-500/25 transition-colors"
                  >
                    MAL ★ {extras.anime.score}
                    {extras.anime.studios.length > 0 ? ` • ${extras.anime.studios[0]}` : ''}
                  </a>
                )}
                {extras.omdb?.awards && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs font-medium text-yellow-200">
                    <Award className="w-3.5 h-3.5 text-yellow-400" />
                    {extras.omdb.awards}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Cast Section (Актеры) */}
        {media.cast && media.cast.length > 0 && (
          <section className="mt-14 pt-8 border-t border-cinema-border">
            <h2 className="text-xl sm:text-2xl font-bold text-cinema-text mb-4">
              В главных ролях
            </h2>

            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
              {media.cast.map((person) => (
                <div
                  key={person.id}
                  className="flex-none w-28 sm:w-32 bg-cinema-card border border-cinema-border rounded-xl p-2.5 text-center flex flex-col items-center hover:border-brand-main/50 transition-colors"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-cinema-surface mb-2.5 ring-2 ring-cinema-border">
                    {person.profilePath ? (
                      <img
                        src={person.profilePath}
                        alt={person.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-cinema-muted text-xs">
                        Нет фото
                      </div>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-cinema-text line-clamp-1">
                    {person.name}
                  </h3>
                  {person.character && (
                    <p className="text-[11px] text-cinema-muted line-clamp-1 mt-0.5">
                      {person.character}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3b. Voiceover team (AniLiberty) */}
        {media.voiceovers && media.voiceovers.length > 0 && (
          <section className="mt-14 pt-8 border-t border-cinema-border">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-cinema-text">Озвучка</h2>
              <span className="px-3 py-1 rounded-xl bg-[#8065FF]/15 border border-[#8065FF]/40 text-xs font-bold text-[#A18BFF]">
                {media.voiceTeamName || 'AniLibria'} • русская озвучка
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {media.voiceovers.map((m, idx) => (
                <span
                  key={`${m.name}-${idx}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cinema-card border border-cinema-border text-xs"
                >
                  <span className="font-bold text-cinema-text">{m.name}</span>
                  <span className="text-cinema-muted">{m.role}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 4. Episodes Section (for TV Series) */}
        {isTv && allSeasons.length > 0 && (
          <section className="mt-12 pt-8 border-t border-cinema-border">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl sm:text-2xl font-bold text-cinema-text">
                Сезоны и серии
              </h2>
            </div>
            <EpisodePicker
              seasons={allSeasons}
              activeSeason={selectedSeason}
              activeEpisode={selectedEpisode}
              onSelectSeason={handleSeasonChange}
              onSelectEpisode={handleEpisodeChange}
            />
          </section>
        )}

        {/* 5. Comments & Reviews Section (Комментарии и отзывы 67movies) */}
        <section className="mt-14 pt-8 border-t border-cinema-border">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-5 h-5 text-brand-main" />
              <h2 className="text-xl sm:text-2xl font-bold text-cinema-text">
                Оценки и отзывы ({communityStats.totalRatings})
              </h2>
            </div>

            {communityStats.totalRatings > 0 && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#8065FF]/15 border border-[#8065FF]/40">
                <Star className="w-4 h-4 fill-[#A18BFF] text-[#A18BFF]" />
                <span className="text-sm font-black text-white">
                  {communityStats.averageRating}
                </span>
                <span className="text-xs text-[#92929F]">
                  рейтинг 67movies ({communityStats.totalRatings})
                </span>
              </div>
            )}
          </div>

          {/* New Review Input Form */}
          <form
            onSubmit={handleAddComment}
            className="bg-cinema-card border border-cinema-border rounded-2xl p-5 mb-8 shadow-xl"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#8065FF] text-white font-bold flex items-center justify-center uppercase flex-shrink-0">
                {(authUser?.name || 'К').slice(0, 1)}
              </div>
              <div className="flex-1 space-y-3">
                <textarea
                  rows={3}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Напишите ваш отзыв о фильме — он сохранится в базе и появится в вашем профиле..."
                  className="w-full bg-cinema-surface border border-cinema-border rounded-xl p-3.5 text-sm text-cinema-text placeholder-cinema-muted focus:outline-none focus:border-brand-main transition-colors resize-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-cinema-muted">Ваша оценка:</span>
                    <select
                      value={newCommentRating}
                      onChange={(e) => setNewCommentRating(Number(e.target.value))}
                      className="bg-cinema-surface border border-cinema-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#A18BFF] focus:outline-none"
                    >
                      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((num) => (
                        <option key={num} value={num}>
                          ★ {num}/10
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={!newCommentText.trim() || savingReview}
                    className="flex items-center gap-2 px-5 py-2.5 brand-btn disabled:opacity-50 text-white font-semibold text-xs rounded-xl"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{savingReview ? 'Сохранение...' : 'Опубликовать отзыв'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Real Reviews List from Neon PostgreSQL */}
          {communityStats.reviews.length === 0 ? (
            <div className="text-center py-12 bg-cinema-card/60 border border-cinema-border rounded-2xl p-6">
              <p className="text-sm font-semibold text-white">Пока нет отзывов</p>
              <p className="text-xs text-cinema-muted mt-1">
                Будьте первым, кто оценит «{media.title}» на 67movies!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {communityStats.reviews.map((rev) => {
                const isMine = authUser && rev.userId === authUser.id;
                return (
                  <div
                    key={rev.id}
                    className="bg-cinema-card border border-cinema-border/80 rounded-2xl p-5 space-y-3 hover:border-[#8065FF]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/user/${rev.userId}`}
                        className="flex items-center gap-3 group"
                      >
                        {rev.authorAvatar ? (
                          <img
                            src={rev.authorAvatar}
                            alt={rev.authorName}
                            className="w-9 h-9 rounded-full object-cover ring-1 ring-cinema-border group-hover:ring-[#8065FF]"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#8065FF]/20 text-[#A18BFF] font-bold text-sm flex items-center justify-center uppercase">
                            {rev.authorName.slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-bold text-cinema-text group-hover:text-[#A18BFF] transition-colors">
                            {rev.authorName}
                          </h4>
                          <span className="text-[11px] text-cinema-muted">
                            {new Date(rev.updatedAt).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </Link>

                      <div className="flex items-center gap-2">
                        {rev.isFavorite && (
                          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-semibold">
                            <Heart className="w-3 h-3 fill-rose-400 text-rose-400" />
                            Любимый
                          </span>
                        )}
                        <span className="flex items-center gap-1 px-2.5 py-0.5 bg-[#8065FF]/15 text-[#A18BFF] border border-[#8065FF]/35 rounded-md text-xs font-bold">
                          <Star className="w-3 h-3 fill-[#A18BFF] text-[#A18BFF]" />
                          <span>{rev.rating}/10</span>
                        </span>
                        {isMine && (
                          <button
                            type="button"
                            onClick={handleDeleteOwnReview}
                            className="text-xs text-red-400 hover:text-red-300 font-semibold ml-1"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>

                    {rev.review && (
                      <p className="text-sm text-cinema-text/90 leading-relaxed whitespace-pre-line">
                        {rev.review}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 6. Similar / Recommended Rail */}
        {media.recommendations && media.recommendations.length > 0 && (
          <section className="mt-14 pt-8 border-t border-cinema-border">
            <MediaRail
              title="Похожие фильмы и рекомендации"
              items={media.recommendations}
            />
          </section>
        )}
      </div>

      {/* 7. Interactive Rating & Review Modal (10 Stars + Optional Review) */}
      {isRatingModalOpen && (
        <div
          onClick={() => setIsRatingModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-cinema-surface border border-cinema-border rounded-3xl p-6 text-white shadow-2xl space-y-5 animate-scaleIn"
          >
            <div className="flex items-center justify-between border-b border-cinema-border pb-3">
              <h3 className="text-lg font-bold truncate pr-3">Оцените «{media.title}»</h3>
              <button
                onClick={() => setIsRatingModalOpen(false)}
                className="p-1 text-cinema-muted hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 10 Stars Row */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1 py-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => {
                      setModalRating(star);
                      if (star >= 8) setModalFavorite(true);
                    }}
                    className="p-1 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        (hoverRating || modalRating) >= star
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-cinema-border hover:text-amber-400/50'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div className="text-sm font-bold text-[#A18BFF]">
                {(() => {
                  const val = hoverRating || modalRating;
                  const text =
                    val >= 9
                      ? 'Шедевр'
                      : val >= 8
                      ? 'Отлично'
                      : val >= 6
                      ? 'Хорошо'
                      : val >= 4
                      ? 'Средне'
                      : 'Слабо';
                  return `${val} из 10 — ${text}`;
                })()}
              </div>
            </div>

            {/* Optional Review Input */}
            <textarea
              rows={3}
              value={modalReview}
              onChange={(e) => setModalReview(e.target.value)}
              placeholder="Короткий отзыв (необязательно)..."
              className="w-full rounded-xl bg-[#09090D] border border-[#292936] p-3 text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF] resize-none"
            />

            <label className="flex items-center gap-2.5 text-xs text-cinema-muted cursor-pointer">
              <input
                type="checkbox"
                checked={modalFavorite}
                onChange={(e) => setModalFavorite(e.target.checked)}
                className="w-4 h-4 accent-[#8065FF]"
              />
              <span>Показать в «Любимых фильмах» в профиле для друзей</span>
            </label>

            <button
              type="button"
              disabled={savingReview}
              onClick={async () => {
                await saveRatingToServer(modalRating, modalReview, modalFavorite);
                setIsRatingModalOpen(false);
              }}
              className="w-full py-3 rounded-xl brand-btn text-white text-sm font-bold disabled:opacity-50"
            >
              {savingReview ? 'Сохранение...' : 'Сохранить оценку'}
            </button>
          </div>
        </div>
      )}
      {/* 8. Official YouTube Trailer Modal */}
      {activeTrailerUrl && (
        <div
          onClick={() => setActiveTrailerUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-[#09090D] border border-[#292936] rounded-3xl overflow-hidden shadow-2xl animate-scaleIn"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#292936]">
              <span className="text-sm font-bold text-white truncate">
                Трейлер — {media.title}
              </span>
              <button
                type="button"
                onClick={() => setActiveTrailerUrl(null)}
                className="p-1 text-[#92929F] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={activeTrailerUrl}
                title={`Трейлер ${media.title}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* 9. Add to Custom Collection Modal */}
      {isCollectionModalOpen && (
        <div
          onClick={() => setIsCollectionModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#111119] border border-[#292936] rounded-3xl p-6 text-white shadow-2xl space-y-4 animate-scaleIn"
          >
            <div className="flex items-center justify-between border-b border-[#292936] pb-3">
              <h3 className="text-base font-bold">Добавить в подборку</h3>
              <button
                type="button"
                onClick={() => setIsCollectionModalOpen(false)}
                className="p-1 text-[#92929F] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {myCollections.length > 0 && (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {myCollections.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleAddToCollection(col.id, col.title)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#181821] hover:bg-[#8065FF]/20 border border-[#292936] hover:border-[#8065FF] text-left transition-all"
                  >
                    <span className="text-sm font-semibold text-white">{col.title}</span>
                    <span className="text-xs text-[#92929F]">
                      {col.items?.length || 0} шт.
                    </span>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleCreateAndAddCollection} className="flex gap-2 pt-2">
              <input
                type="text"
                required
                minLength={2}
                value={newCollectionTitle}
                onChange={(e) => setNewCollectionTitle(e.target.value)}
                placeholder="Новая подборка (напр. Топ фантастики)"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl brand-btn text-white text-xs font-bold shrink-0"
              >
                Создать
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 10. Send Movie to Friend Modal */}
      {isSendFriendModalOpen && (
        <div
          onClick={() => setIsSendFriendModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#111119] border border-[#292936] rounded-3xl p-6 text-white shadow-2xl space-y-4 animate-scaleIn"
          >
            <div className="flex items-center justify-between border-b border-[#292936] pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#A18BFF]" />
                <h3 className="text-base font-bold">Отправить фильм другу</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSendFriendModalOpen(false)}
                className="p-1 text-[#92929F] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Movie Preview */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#181821] border border-[#292936]">
              {media.posterPath ? (
                <img
                  src={media.posterPath}
                  alt={media.title}
                  className="w-11 h-16 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-11 h-16 rounded-lg bg-[#09090D] flex items-center justify-center shrink-0">
                  <Film className="w-5 h-5 text-[#92929F]" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-white line-clamp-1">{media.title}</p>
                <p className="text-xs text-[#92929F] mt-0.5">
                  {media.type === 'tv' ? 'Сериал' : 'Фильм'}
                  {media.releaseYear ? ` • ${media.releaseYear}` : ''}
                </p>
              </div>
            </div>

            {/* Optional Note */}
            <input
              type="text"
              value={sendNote}
              onChange={(e) => setSendNote(e.target.value)}
              placeholder="Добавить комментарий (напр. Обязательно посмотри!)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
            />

            {/* Friends List */}
            {loadingFriends ? (
              <p className="text-xs text-[#92929F] text-center py-6">Загрузка списка друзей...</p>
            ) : friendsList.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-[#92929F]">
                  У вас пока нет добавленных друзей. Добавьте друга по email в профиле!
                </p>
                <Link
                  href="/profile"
                  onClick={() => setIsSendFriendModalOpen(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl brand-btn text-white text-xs font-bold"
                >
                  Перейти в профиль
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {friendsList.map((f) => {
                  const alreadySent = sentToFriendIds.includes(f.user.id);
                  const isBusy = sendingToFriendId === f.user.id;
                  return (
                    <div
                      key={f.friendshipId}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#181821] border border-[#292936]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#09090D] flex items-center justify-center shrink-0">
                          {f.user.avatarUrl ? (
                            <img
                              src={f.user.avatarUrl}
                              alt={f.user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-black text-[#A18BFF] uppercase">
                              {f.user.name.slice(0, 1)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white truncate">{f.user.name}</p>
                      </div>

                      {alreadySent ? (
                        <Link
                          href={`/messages?friend=${f.user.id}`}
                          onClick={() => setIsSendFriendModalOpen(false)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>В чат</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSendMovieToFriend(f.user.id, f.user.name)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl brand-btn text-white text-xs font-bold disabled:opacity-50 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isBusy ? '...' : 'Отправить'}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api-client';
import { VideoPlayer } from '../../../components/player/VideoPlayer';
import { MediaItem, Season, StreamSourceGroup } from '@cinemaflow/types';
import { EpisodePicker } from '../../../components/media/EpisodePicker';

export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const mediaId = String(params?.id || '');
  const titleHint = searchParams?.get('title') || '';
  const origTitleHint = searchParams?.get('originalTitle') || '';
  const malIdHint = searchParams?.get('malId') ? Number(searchParams.get('malId')) || undefined : undefined;
  const isAnimeParam = searchParams?.get('anime') === '1';

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [sourceGroups, setSourceGroups] = useState<StreamSourceGroup[]>([]);
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [currentSeason, setCurrentSeason] = useState<number>(
    parseInt(searchParams?.get('season') || '1', 10)
  );
  const [currentEpisode, setCurrentEpisode] = useState<number>(
    parseInt(searchParams?.get('episode') || '1', 10)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showEpisodes, setShowEpisodes] = useState(false);

  // Load Media details and resolve HLS streams
  useEffect(() => {
    if (!mediaId) return;

    let isMounted = true;
    setIsLoading(true);

    api.media
      .getById(mediaId)
      .catch(() => null)
      .then(async (data) => {
        if (!isMounted) return [];

        const isAnimeItem = Boolean(
          isAnimeParam ||
            /^al-\d+$/i.test(mediaId) ||
            /^mal-\d+$/i.test(mediaId) ||
            data?.source === 'aniliberty' ||
            data?.source === 'jikan' ||
            data?.source === 'shikimori' ||
            data?.anilibertyId ||
            data?.malId ||
            data?.genres?.some(
              (g) => g.id === 16 || /аниме|anime|сёнэн|сёнен|исекай|меха|сейнен/i.test(g.name)
            ) ||
            (data?.originalTitle && /[\u3040-\u30ff\u4e00-\u9faf]/.test(data.originalTitle))
        );

        let resolvedMedia = data;

        // If this is an anime without AniLiberty episodes/id yet, auto-resolve from AniLiberty
        if (
          isAnimeItem &&
          (!resolvedMedia?.anilibertyId || !resolvedMedia?.seasons?.[0]?.episodes?.length)
        ) {
          const alMatch = /^al-(\d+)$/i.exec(mediaId);
          const alRelease = await api.media
            .resolveAniLibertyRelease({
              anilibertyId: resolvedMedia?.anilibertyId || (alMatch ? Number(alMatch[1]) : undefined),
              malId: resolvedMedia?.malId || malIdHint,
              title: resolvedMedia?.title || titleHint,
              originalTitle: resolvedMedia?.originalTitle || origTitleHint,
            })
            .catch(() => null);

          if (alRelease) {
            resolvedMedia = resolvedMedia
              ? {
                  ...resolvedMedia,
                  anilibertyId: alRelease.anilibertyId || resolvedMedia.anilibertyId,
                  voiceovers: alRelease.voiceovers || resolvedMedia.voiceovers,
                  seasons: alRelease.seasons?.length ? alRelease.seasons : resolvedMedia.seasons,
                }
              : alRelease;
          }
        }

        if (!isMounted) return [];
        setMedia(resolvedMedia);

        if (resolvedMedia?.seasons?.[0]?.episodes?.length) {
          setSeasonData(resolvedMedia.seasons[0]);
        } else if (resolvedMedia?.type === 'tv') {
          const seasonTargetId = resolvedMedia.anilibertyId
            ? `al-${resolvedMedia.anilibertyId}`
            : mediaId;
          api.media
            .getTvSeason(seasonTargetId, currentSeason)
            .then((s) => {
              if (isMounted && s) setSeasonData(s);
            })
            .catch(() => {});
        }

        if (isAnimeItem) {
          return api.sources.getAnimeStreams(
            resolvedMedia?.anilibertyId ? `al-${resolvedMedia.anilibertyId}` : mediaId,
            currentEpisode,
            {
              anilibertyId: resolvedMedia?.anilibertyId,
              malId: resolvedMedia?.malId || malIdHint,
              title: resolvedMedia?.title || titleHint,
              originalTitle: resolvedMedia?.originalTitle || origTitleHint,
            }
          );
        }

        return api.sources
          .resolve({
            title: resolvedMedia?.title || titleHint || 'Video',
            type: resolvedMedia?.type || 'movie',
            year: resolvedMedia?.releaseYear || 2024,
            tmdbId: resolvedMedia?.tmdbId,
            season: resolvedMedia?.type === 'tv' ? currentSeason : undefined,
            episode: resolvedMedia?.type === 'tv' ? currentEpisode : undefined,
          })
          .catch(() => []);
      })
      .then((groups) => {
        if (!isMounted) return;
        setSourceGroups(groups || []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load video or sources:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [mediaId, currentSeason, currentEpisode, isAnimeParam, titleHint, origTitleHint, malIdHint]);

  const handleSeasonChange = (seasonNum: number) => {
    setCurrentSeason(seasonNum);
    setCurrentEpisode(1);
    const seasonTargetId = media?.anilibertyId ? `al-${media.anilibertyId}` : mediaId;
    api.media
      .getTvSeason(seasonTargetId, seasonNum)
      .then((s) => {
        if (s) setSeasonData(s);
      })
      .catch(() => {});
  };

  const handleEpisodeChange = (seasonNum: number, episodeNum: number) => {
    setCurrentSeason(seasonNum);
    setCurrentEpisode(episodeNum);
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-cinema-dark flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-brand-main border-t-transparent rounded-full animate-spin shadow-brand-glow" />
        <p className="text-sm font-medium text-cinema-muted">
          Подключение к источникам и загрузка видеопотока...
        </p>
      </div>
    );
  }

  const isTv = media?.type === 'tv' || Boolean(seasonData?.episodes?.length);
  const isAnimeWatch = Boolean(
    isAnimeParam ||
      /^al-\d+$/i.test(mediaId) ||
      /^mal-\d+$/i.test(mediaId) ||
      media?.anilibertyId ||
      media?.source === 'aniliberty' ||
      media?.source === 'jikan' ||
      media?.source === 'shikimori'
  );
  const currentEpData = seasonData?.episodes?.find((e) => e.episodeNumber === currentEpisode);
  const displaySubtitle = isTv
    ? isAnimeWatch
      ? `Серия ${currentEpisode}${currentEpData?.name ? `: ${currentEpData.name}` : ''}`
      : `Сезон ${currentSeason}, Серия ${currentEpisode}: ${currentEpData?.name || ''}`
    : `${media?.releaseYear || ''} • ${media?.genres?.map((g) => g.name).join(', ') || ''}`;

  const allSeasons: Season[] =
    media?.seasons?.map((s) => {
      if (s.seasonNumber === currentSeason && seasonData?.episodes) {
        return { ...s, episodes: seasonData.episodes };
      }
      return s;
    }) || (seasonData ? [seasonData] : []);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <VideoPlayer
        mediaId={mediaId}
        title={media?.title || titleHint || '67movies Stream'}
        subtitle={displaySubtitle}
        sourceGroups={sourceGroups}
        seasonNumber={isTv ? currentSeason : undefined}
        episodeNumber={isTv ? currentEpisode : undefined}
      />

      {/* No streams available for this episode */}
      {isAnimeWatch && sourceGroups.length === 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 text-white p-6 text-center">
          <p className="text-xl font-bold text-red-400 mb-2">Серия недоступна</p>
          <p className="text-slate-300 mb-6 max-w-md">
            Для этого аниме или выбранной серии пока нет HLS-потока в базе AniLiberty.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2.5 brand-btn text-white font-semibold rounded-xl"
          >
            Назад
          </button>
        </div>
      )}

      {/* Explicit episodes toggle button inside the player */}
      {isAnimeWatch && isTv && allSeasons.length > 0 && (
        <button
          type="button"
          onClick={() => setShowEpisodes((v) => !v)}
          data-nav-item="true"
          className="fixed bottom-28 right-4 z-40 px-4 py-2 rounded-xl bg-black/70 hover:bg-black/90 border border-white/20 text-white text-xs font-bold backdrop-blur-md"
        >
          {showEpisodes ? 'Скрыть серии' : `Серии (${allSeasons[0]?.episodeCount || allSeasons[0]?.episodes?.length || 0})`}
        </button>
      )}

      {/* Episode selector drawer for TV shows / Anime */}
      {isTv && allSeasons.length > 0 && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 p-4 bg-cinema-surface/95 border-t border-cinema-border max-h-52 overflow-y-auto transition-all ${
            isAnimeWatch ? (showEpisodes ? 'block' : 'hidden') : 'hidden hover:block'
          }`}
        >
          <EpisodePicker
            seasons={allSeasons}
            activeSeason={currentSeason}
            activeEpisode={currentEpisode}
            onSelectSeason={handleSeasonChange}
            onSelectEpisode={(s, ep) => {
              handleEpisodeChange(s, ep);
              setShowEpisodes(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

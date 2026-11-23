'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api-client';
import { VideoPlayer } from '../../../components/player/VideoPlayer';
import { MediaItem, Season, StreamSourceGroup } from '@cinemaflow/types';
import { usePlayerStore } from '../../../stores/player.store';

export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const mediaId = String(params?.id || '');
  const titleHint = searchParams?.get('title') || '';
  const origTitleHint = searchParams?.get('originalTitle') || '';
  const malIdHint = searchParams?.get('malId')
    ? Number(searchParams.get('malId')) || undefined
    : undefined;
  const isAnimeParam = searchParams?.get('anime') === '1';
  const voiceHint = searchParams?.get('voice') || 'aniliberty';

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [sourceGroups, setSourceGroups] = useState<StreamSourceGroup[]>([]);
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [currentSeason, setCurrentSeason] = useState<number>(
    parseInt(searchParams?.get('season') || '1', 10)
  );
  const [currentEpisode, setCurrentEpisode] = useState<number>(
    parseInt(searchParams?.get('episode') || '1', 10)
  );
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // 1. Load Media details & episodes list once per mediaId
  useEffect(() => {
    if (!mediaId) return;

    let isMounted = true;
    setIsInitialLoading(true);

    api.media
      .getById(mediaId)
      .catch(() => null)
      .then(async (data) => {
        if (!isMounted) return;

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

        if (isAnimeItem) {
          const alMatch = /^al-(\d+)$/i.exec(mediaId);
          const alRelease = await api.media
            .resolveAniLibertyRelease({
              anilibertyId:
                resolvedMedia?.anilibertyId || (alMatch ? Number(alMatch[1]) : undefined),
              malId: resolvedMedia?.malId || malIdHint,
              title: resolvedMedia?.title || titleHint,
              originalTitle: resolvedMedia?.originalTitle || origTitleHint,
            })
            .catch(() => null);

          if (alRelease) {
            const newCount = alRelease.seasons?.[0]?.episodes?.length || 0;
            const oldCount = resolvedMedia?.seasons?.[0]?.episodes?.length || 0;
            resolvedMedia = resolvedMedia
              ? {
                  ...resolvedMedia,
                  anilibertyId: alRelease.anilibertyId || resolvedMedia.anilibertyId,
                  voiceovers: alRelease.voiceovers || resolvedMedia.voiceovers,
                  episodesTotal: Math.max(
                    newCount,
                    alRelease.episodesTotal || 0,
                    resolvedMedia.episodesTotal || 0
                  ),
                  seasons:
                    newCount >= oldCount && alRelease.seasons?.length
                      ? alRelease.seasons
                      : resolvedMedia.seasons,
                }
              : alRelease;
          }
        }

        if (!isMounted) return;
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
      });

    return () => {
      isMounted = false;
    };
  }, [mediaId, isAnimeParam, titleHint, origTitleHint, malIdHint]);

  // 2. Resolve HLS stream whenever episode / season / media changes (keeps VideoPlayer mounted so Fullscreen is preserved!)
  useEffect(() => {
    if (!mediaId) return;
    let isMounted = true;
    usePlayerStore.getState().setIsBuffering(true);

    const isAnimeItem = Boolean(
      isAnimeParam ||
        /^al-\d+$/i.test(mediaId) ||
        /^mal-\d+$/i.test(mediaId) ||
        media?.source === 'aniliberty' ||
        media?.source === 'jikan' ||
        media?.source === 'shikimori' ||
        media?.anilibertyId ||
        media?.malId ||
        media?.genres?.some(
          (g) => g.id === 16 || /аниме|anime|сёнэн|сёнен|исекай|меха|сейнен/i.test(g.name)
        ) ||
        (media?.originalTitle && /[\u3040-\u30ff\u4e00-\u9faf]/.test(media.originalTitle))
    );

    const fetchStreams = async () => {
      if (isAnimeItem) {
        if (
          !media?.title &&
          !titleHint &&
          !origTitleHint &&
          !/^al-\d+$/i.test(mediaId) &&
          !malIdHint
        ) {
          return [];
        }
        return api.sources.getAnimeStreams(
          media?.anilibertyId ? `al-${media.anilibertyId}` : mediaId,
          currentEpisode,
          {
            anilibertyId: media?.anilibertyId,
            malId: media?.malId || malIdHint,
            title: media?.title || titleHint,
            originalTitle: media?.originalTitle || origTitleHint,
          }
        );
      }

      return api.sources
        .resolve({
          title: media?.title || titleHint || 'Video',
          type: media?.type || 'movie',
          year: media?.releaseYear || 2024,
          tmdbId: media?.tmdbId,
          season: media?.type === 'tv' ? currentSeason : undefined,
          episode: media?.type === 'tv' ? currentEpisode : undefined,
        })
        .catch(() => []);
    };

    fetchStreams()
      .then((groups) => {
        if (!isMounted) return;
        setSourceGroups(groups || []);
        setIsInitialLoading(false);
      })
      .catch(() => {
        if (isMounted) setIsInitialLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    mediaId,
    media?.anilibertyId,
    media?.malId,
    media?.title,
    media?.originalTitle,
    media?.type,
    media?.releaseYear,
    media?.tmdbId,
    currentSeason,
    currentEpisode,
    isAnimeParam,
    titleHint,
    origTitleHint,
    malIdHint,
  ]);

  const handleSeasonChange = (seasonNum: number) => {
    setCurrentSeason(seasonNum);
    setCurrentEpisode(1);
    const existingSeason = media?.seasons?.find((s) => s.seasonNumber === seasonNum);
    if (existingSeason?.episodes?.length) {
      setSeasonData(existingSeason);
      return;
    }
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

  const allSeasons: Season[] = useMemo(() => {
    return (
      media?.seasons?.map((s) => {
        if (s.seasonNumber === currentSeason && seasonData?.episodes) {
          return { ...s, episodes: seasonData.episodes };
        }
        return s;
      }) || (seasonData ? [seasonData] : [])
    );
  }, [media?.seasons, currentSeason, seasonData]);

  // Compute sorted episodes list for current season so Prev / Next episode navigation works even with non-contiguous episode numbers
  const episodesList = useMemo(() => {
    const activeS =
      allSeasons.find((s) => s.seasonNumber === currentSeason) || allSeasons[0];
    if (activeS?.episodes && activeS.episodes.length > 0) {
      return [...activeS.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
    }
    const total = activeS?.episodeCount || media?.episodesTotal || 0;
    if (total > 1) {
      return Array.from({ length: total }, (_, idx) => ({
        id: `ep-${idx + 1}`,
        seasonNumber: currentSeason,
        episodeNumber: idx + 1,
        name: `Серия ${idx + 1}`,
      }));
    }
    return [];
  }, [allSeasons, currentSeason, media?.episodesTotal]);

  const currentEpIndex = episodesList.findIndex(
    (e) => Number(e.episodeNumber) === Number(currentEpisode)
  );
  const prevEp = currentEpIndex > 0 ? episodesList[currentEpIndex - 1] : null;
  const nextEp =
    currentEpIndex !== -1 && currentEpIndex < episodesList.length - 1
      ? episodesList[currentEpIndex + 1]
      : null;

  if (isInitialLoading && sourceGroups.length === 0) {
    return (
      <div className="w-screen h-screen bg-cinema-dark flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-brand-main border-t-transparent rounded-full animate-spin shadow-brand-glow" />
        <p className="text-sm font-medium text-cinema-muted">
          Подключение к источникам и загрузка видеопотока...
        </p>
      </div>
    );
  }

  const isTv =
    media?.type === 'tv' ||
    Boolean(seasonData?.episodes?.length) ||
    episodesList.length > 0;
  const isAnimeWatch = Boolean(
    isAnimeParam ||
      /^al-\d+$/i.test(mediaId) ||
      /^mal-\d+$/i.test(mediaId) ||
      media?.anilibertyId ||
      media?.source === 'aniliberty' ||
      media?.source === 'jikan' ||
      media?.source === 'shikimori'
  );
  const currentEpData = episodesList.find((e) => e.episodeNumber === currentEpisode);
  const displaySubtitle = isTv
    ? isAnimeWatch
      ? `Серия ${currentEpisode}${
          currentEpData?.name && currentEpData.name !== `Серия ${currentEpisode}`
            ? `: ${currentEpData.name}`
            : ''
        }${episodesList.length > 0 ? ` (из ${episodesList.length})` : ''}`
      : `Сезон ${currentSeason}, Серия ${currentEpisode}${
          currentEpData?.name ? `: ${currentEpData.name}` : ''
        }`
    : `${media?.releaseYear || ''} • ${media?.genres?.map((g) => g.name).join(', ') || ''}`;

  // Preserve the user's currently active voiceover provider across episode changes
  const activeVoiceId =
    usePlayerStore.getState().activeStream?.providerId || voiceHint;
  const preferredGroup =
    sourceGroups.find((g) => g.providerId === activeVoiceId) ||
    sourceGroups.find((g) => g.providerId === voiceHint) ||
    sourceGroups[0];
  const initialStream =
    preferredGroup?.streams?.find((s) => s.quality === '1080p') ||
    preferredGroup?.streams?.find((s) => s.quality === '720p') ||
    preferredGroup?.streams?.[0];

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <VideoPlayer
        mediaId={mediaId}
        title={media?.title || titleHint || '67movies Stream'}
        subtitle={displaySubtitle}
        sourceGroups={sourceGroups}
        initialStream={initialStream}
        seasonNumber={isTv ? currentSeason : undefined}
        episodeNumber={isTv ? currentEpisode : undefined}
        seasons={allSeasons}
        hasPrevEpisode={Boolean(prevEp)}
        hasNextEpisode={Boolean(nextEp)}
        nextEpisodeLabel={
          nextEp ? `Серия ${nextEp.episodeNumber}${nextEp.name ? `: ${nextEp.name}` : ''}` : undefined
        }
        onPrevEpisode={
          prevEp ? () => handleEpisodeChange(currentSeason, prevEp.episodeNumber) : undefined
        }
        onNextEpisode={
          nextEp ? () => handleEpisodeChange(currentSeason, nextEp.episodeNumber) : undefined
        }
        onSelectSeason={handleSeasonChange}
        onSelectEpisode={handleEpisodeChange}
      />

      {/* No streams available for this episode */}
      {!isInitialLoading && isAnimeWatch && sourceGroups.length === 0 && (
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
    </div>
  );
}

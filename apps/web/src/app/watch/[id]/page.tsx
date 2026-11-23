'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api-client';
import { VideoPlayer } from '../../../components/player/VideoPlayer';
import { MediaItem, MediaType, Season, StreamSourceGroup } from '@cinemaflow/types';

function WatchContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const mediaId = String(params?.id || '');
  const typeParam = searchParams?.get('type');
  const mediaTypeParam: MediaType | undefined =
    typeParam === 'tv' ? 'tv' : typeParam === 'movie' ? 'movie' : undefined;
  const titleParam = searchParams?.get('title') || undefined;
  const originalTitleParam = searchParams?.get('originalTitle') || undefined;
  const alIdParam = searchParams?.get('anilibertyId')
    ? Number(searchParams.get('anilibertyId')) || undefined
    : undefined;
  const malIdParam = searchParams?.get('malId')
    ? Number(searchParams.get('malId')) || undefined
    : undefined;

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [sourceGroups, setSourceGroups] = useState<StreamSourceGroup[]>([]);
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [currentSeason, setCurrentSeason] = useState<number>(
    parseInt(searchParams?.get('season') || '1', 10) || 1
  );
  const [currentEpisode, setCurrentEpisode] = useState<number>(
    parseInt(searchParams?.get('episode') || '1', 10) || 1
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!mediaId) return;

    let isMounted = true;
    setIsLoading(true);

    api.media
      .getById(mediaId, mediaTypeParam)
      .then(async (data) => {
        if (!isMounted) return;
        setMedia(data);

        const resolvedTitle = data?.title || titleParam || '67movies';
        const resolvedOriginal = data?.originalTitle || originalTitleParam;
        const resolvedAlId = data?.anilibertyId || alIdParam;
        const resolvedMalId = data?.malId || malIdParam;

        const isAnimeTitle = Boolean(
          mediaId.startsWith('al-') ||
            mediaId.startsWith('mal-') ||
            data?.source === 'aniliberty' ||
            resolvedAlId ||
            (data?.genres?.some((g) => g.id === 16) &&
              ((data as any)?.originalLanguage === 'ja' ||
                /[\u3040-\u30ff\u4e00-\u9faf]/.test(resolvedOriginal || '') ||
                (data as any)?.originCountry?.includes('JP')))
        );

        if (isAnimeTitle) {
          if (data?.seasons && data.seasons.length > 0 && data.seasons[0].episodes?.length) {
            setSeasonData(data.seasons[0]);
          } else {
            api.media
              .resolveAniLibertyRelease({
                anilibertyId: resolvedAlId,
                malId: resolvedMalId,
                title: resolvedTitle,
                originalTitle: resolvedOriginal,
              })
              .then((rel: MediaItem | null) => {
                if (isMounted && rel?.seasons?.[0]) {
                  setSeasonData(rel.seasons[0]);
                }
              })
              .catch(() => {});
          }

          const groups = await api.sources
            .getAnimeStreams(mediaId, currentEpisode, {
              title: resolvedTitle,
              originalTitle: resolvedOriginal,
              malId: resolvedMalId,
              anilibertyId: resolvedAlId,
            })
            .catch(() => []);

          if (isMounted) {
            setSourceGroups(groups || []);
            setIsLoading(false);
          }
          return;
        }

        // Non-anime TV season metadata
        if (data?.type === 'tv') {
          api.media
            .getTvSeason(mediaId, currentSeason)
            .then((s) => {
              if (isMounted && s) setSeasonData(s);
            })
            .catch(() => {});
        }

        // Direct movie/series streams resolver
        try {
          const sp = new URLSearchParams({
            title: resolvedTitle,
            type: data?.type || mediaTypeParam || 'movie',
          });
          if (resolvedOriginal) sp.set('originalTitle', resolvedOriginal);
          if (data?.imdbId) sp.set('imdbId', data.imdbId);
          if (data?.kinopoiskId) sp.set('kinopoiskId', String(data.kinopoiskId));
          if (data?.releaseYear) sp.set('year', String(data.releaseYear));
          if ((data?.type || mediaTypeParam) === 'tv') {
            sp.set('season', String(currentSeason));
            sp.set('episode', String(currentEpisode));
          }
          const res = await fetch(`/api/movie-streams?${sp.toString()}`, { cache: 'no-store' });
          const json = res.ok ? await res.json() : { sourceGroups: [] };
          if (isMounted) {
            setSourceGroups(json?.sourceGroups || []);
            setIsLoading(false);
          }
        } catch {
          if (isMounted) {
            setSourceGroups([]);
            setIsLoading(false);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load video or sources:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    mediaId,
    mediaTypeParam,
    titleParam,
    originalTitleParam,
    alIdParam,
    malIdParam,
    currentSeason,
    currentEpisode,
  ]);

  const handleSeasonChange = (seasonNum: number) => {
    setCurrentSeason(seasonNum);
    setCurrentEpisode(1);
    if (media?.type === 'tv' && !mediaId.startsWith('al-')) {
      api.media
        .getTvSeason(mediaId, seasonNum)
        .then((s) => {
          if (s) setSeasonData(s);
        })
        .catch(() => {});
    }
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
          Загрузка плеера и потоков AniLiberty...
        </p>
      </div>
    );
  }

  const isTv =
    media?.type === 'tv' ||
    mediaId.startsWith('al-') ||
    Boolean(seasonData?.episodes?.length);
  const currentEpData = seasonData?.episodes?.find((e) => e.episodeNumber === currentEpisode);
  const displaySubtitle = isTv
    ? `Сезон ${currentSeason}, Серия ${currentEpisode}${currentEpData?.name ? `: ${currentEpData.name}` : ''}`
    : `${media?.releaseYear || ''} ${
        media?.genres?.length ? `• ${media.genres.map((g) => g.name).join(', ')}` : ''
      }`.trim();

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
        title={media?.title || titleParam || '67movies Stream'}
        subtitle={displaySubtitle}
        posterPath={media?.backdropPath || media?.posterPath}
        mediaType={isTv ? 'tv' : 'movie'}
        originalTitle={media?.originalTitle || originalTitleParam}
        sourceGroups={sourceGroups}
        seasonNumber={isTv ? currentSeason : undefined}
        episodeNumber={isTv ? currentEpisode : undefined}
        seasons={allSeasons}
        onSelectSeason={handleSeasonChange}
        onSelectEpisode={handleEpisodeChange}
      />
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen bg-cinema-dark flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-brand-main border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <WatchContent />
    </Suspense>
  );
}

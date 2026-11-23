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

  // Load real Media details from TMDB via Backend API
  useEffect(() => {
    if (!mediaId) return;

    let isMounted = true;
    setIsLoading(true);

    api.media
      .getById(mediaId)
      .then((data) => {
        if (!isMounted) return;
        setMedia(data);

        // If it's a TV series, fetch real episodes for the active season
        if (data?.type === 'tv') {
          api.media
            .getTvSeason(mediaId, currentSeason)
            .then((s) => {
              if (isMounted && s) setSeasonData(s);
            })
            .catch(() => {});
        }

        // Fetch streams: AniLiberty anime -> HLS from AniLiberty API, others -> sources orchestrator
        if (/^al-\d+$/i.test(mediaId)) {
          return api.sources.getAnimeStreams(mediaId, data?.type === 'tv' ? currentEpisode : 1);
        }
        return api.sources
          .resolve({
            title: data?.title || 'Video',
            type: data?.type || 'movie',
            year: data?.releaseYear || 2024,
            tmdbId: data?.tmdbId,
            season: data?.type === 'tv' ? currentSeason : undefined,
            episode: data?.type === 'tv' ? currentEpisode : undefined,
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
  }, [mediaId, currentSeason, currentEpisode]);

  // When season changes, fetch new season's episodes
  const handleSeasonChange = (seasonNum: number) => {
    setCurrentSeason(seasonNum);
    setCurrentEpisode(1);
    api.media
      .getTvSeason(mediaId, seasonNum)
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
          Подключение к источникам и загрузка метаданных TMDB...
        </p>
      </div>
    );
  }

  const isTv = media?.type === 'tv';
  const isAniLiberty = /^al-\d+$/i.test(mediaId);
  const currentEpData = seasonData?.episodes?.find((e) => e.episodeNumber === currentEpisode);
  const displaySubtitle = isTv
    ? isAniLiberty
      ? `Серия ${currentEpisode}${currentEpData?.name ? `: ${currentEpData.name}` : ''}`
      : `Сезон ${currentSeason}, Серия ${currentEpisode}: ${currentEpData?.name || ''}`
    : `${media?.releaseYear} • ${media?.genres?.map((g) => g.name).join(', ')}`;

  // Combine seasons overview with detailed episodes
  const allSeasons: Season[] = media?.seasons?.map((s) => {
    if (s.seasonNumber === currentSeason && seasonData?.episodes) {
      return { ...s, episodes: seasonData.episodes };
    }
    return s;
  }) || (seasonData ? [seasonData] : []);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <VideoPlayer
        mediaId={mediaId}
        title={media?.title || '67movies Stream'}
        subtitle={displaySubtitle}
        sourceGroups={sourceGroups}
        seasonNumber={isTv ? currentSeason : undefined}
        episodeNumber={isTv ? currentEpisode : undefined}
      />

      {/* No streams available for this episode (AniLiberty) */}
      {isAniLiberty && sourceGroups.length === 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 text-white p-6 text-center">
          <p className="text-xl font-bold text-red-400 mb-2">Серия недоступна</p>
          <p className="text-slate-300 mb-6 max-w-md">
            Для этой серии пока нет видеопотока (релиз ещё не вышел или ограничен правообладателем).
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2.5 brand-btn text-white font-semibold rounded-xl"
          >
            Назад
          </button>
        </div>
      )}

      {/* AniLiberty: explicit episodes toggle (the hover drawer is not reachable on touch) */}
      {isAniLiberty && isTv && allSeasons.length > 0 && (
        <button
          type="button"
          onClick={() => setShowEpisodes((v) => !v)}
          data-nav-item="true"
          className="fixed bottom-28 right-4 z-40 px-4 py-2 rounded-xl bg-black/70 hover:bg-black/90 border border-white/20 text-white text-xs font-bold backdrop-blur-md"
        >
          {showEpisodes ? 'Скрыть серии' : `Серии (${allSeasons[0]?.episodeCount || 0})`}
        </button>
      )}

      {/* Episode selector drawer for TV shows */}
      {isTv && allSeasons.length > 0 && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 p-4 bg-cinema-surface/95 border-t border-cinema-border max-h-52 overflow-y-auto transition-all ${
            isAniLiberty ? (showEpisodes ? 'block' : 'hidden') : 'hidden hover:block'
          }`}
        >
          <EpisodePicker
            seasons={allSeasons}
            activeSeason={currentSeason}
            activeEpisode={currentEpisode}
            onSelectSeason={handleSeasonChange}
            onSelectEpisode={handleEpisodeChange}
          />
        </div>
      )}
    </div>
  );
}

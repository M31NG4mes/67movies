'use client';

import { useEffect, useRef } from 'react';
import { api } from '../lib/api-client';
import { useUiStore } from '../stores/ui.store';

interface SyncOptions {
  mediaId: string;
  seasonNumber?: number;
  episodeNumber?: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

export function usePlayerSync({
  mediaId,
  seasonNumber,
  episodeNumber,
  currentTime,
  duration,
  isPlaying,
}: SyncOptions) {
  const profile = useUiStore((s) => s.activeProfile);
  const lastSyncedTime = useRef(0);

  useEffect(() => {
    if (!mediaId || duration <= 0) return;

    // Sync only if at least 5 seconds have elapsed since last sync
    if (Math.abs(currentTime - lastSyncedTime.current) >= 5 || !isPlaying) {
      lastSyncedTime.current = currentTime;
      api.history
        .sync(
          {
            mediaId,
            seasonNumber,
            episodeNumber,
            currentTime,
            duration,
            completed: currentTime / duration >= 0.92,
          },
          profile.id
        )
        .catch(() => {});
    }
  }, [mediaId, seasonNumber, episodeNumber, currentTime, duration, isPlaying, profile.id]);
}

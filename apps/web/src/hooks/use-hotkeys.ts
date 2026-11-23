'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '../stores/player.store';

export interface PlayerHotkeysOptions {
  onToggleFullscreen?: () => void;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
}

export function usePlayerHotkeys(
  videoRef: React.RefObject<HTMLVideoElement>,
  options?: PlayerHotkeysOptions
) {
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const setIsControlsVisible = usePlayerStore((s) => s.setIsControlsVisible);
  const showOsd = usePlayerStore((s) => s.showOsd);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toUpperCase() || '';
      const inputType = (target as HTMLInputElement | null)?.type?.toLowerCase() || '';

      // Ignore only when typing in a text input or textarea (allow range sliders and buttons)
      if (
        tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        (tagName === 'INPUT' && inputType !== 'range' && inputType !== 'checkbox')
      ) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      setIsControlsVisible(true);

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          if (video.paused) {
            video.play().catch(() => {});
            setIsPlaying(true);
            showOsd('▶️ Воспроизведение');
          } else {
            video.pause();
            setIsPlaying(false);
            showOsd('⏸️ Пауза');
          }
          break;

        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey && options?.onPrevEpisode) {
            options.onPrevEpisode();
            showOsd('⏮️ Предыдущая серия');
            break;
          }
          {
            const nextTime = Math.max(0, (video.currentTime || 0) - 10);
            video.currentTime = nextTime;
            setCurrentTime(nextTime);
            showOsd('⏪ -10 сек');
          }
          break;

        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey && options?.onNextEpisode) {
            options.onNextEpisode();
            showOsd('⏭️ Следующая серия');
            break;
          }
          {
            const maxDur =
              Number.isFinite(video.duration) && video.duration > 0
                ? video.duration
                : (video.currentTime || 0) + 10;
            const nextTime = Math.min(maxDur, (video.currentTime || 0) + 10);
            video.currentTime = nextTime;
            setCurrentTime(nextTime);
            showOsd('⏩ +10 сек');
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          {
            const currentEffective = isMuted ? 0 : volume;
            const nextVol = Math.min(1.0, Math.round((currentEffective + 0.05) * 100) / 100);
            setVolume(nextVol);
            video.muted = false;
            video.volume = nextVol;
            showOsd(`🔊 Громкость: ${Math.round(nextVol * 100)}%`);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          {
            const currentEffective = isMuted ? 0 : volume;
            const nextVol = Math.max(0.0, Math.round((currentEffective - 0.05) * 100) / 100);
            setVolume(nextVol);
            video.muted = nextVol === 0;
            video.volume = nextVol;
            showOsd(
              nextVol === 0
                ? '🔇 Без звука (0%)'
                : `🔉 Громкость: ${Math.round(nextVol * 100)}%`
            );
          }
          break;

        case 'KeyM':
          e.preventDefault();
          toggleMute();
          showOsd(!isMuted ? '🔇 Без звука' : `🔊 Громкость: ${Math.round((volume || 0.5) * 100)}%`);
          break;

        case 'KeyF':
          e.preventDefault();
          if (options?.onToggleFullscreen) {
            options.onToggleFullscreen();
          }
          break;

        case 'KeyN':
          if (options?.onNextEpisode) {
            e.preventDefault();
            options.onNextEpisode();
            showOsd('⏭️ Следующая серия');
          }
          break;

        case 'KeyP':
          if (options?.onPrevEpisode) {
            e.preventDefault();
            options.onPrevEpisode();
            showOsd('⏮️ Предыдущая серия');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [
    videoRef,
    volume,
    isMuted,
    setIsPlaying,
    setCurrentTime,
    setVolume,
    toggleMute,
    setIsControlsVisible,
    showOsd,
    options,
  ]);
}

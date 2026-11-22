'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '../stores/player.store';

export function usePlayerHotkeys(videoRef: React.RefObject<HTMLVideoElement>) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen);
  const setIsControlsVisible = usePlayerStore((s) => s.setIsControlsVisible);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
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
            video.play();
            setIsPlaying(true);
          } else {
            video.pause();
            setIsPlaying(false);
          }
          break;

        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;

        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;

        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1.0, volume + 0.1));
          video.volume = Math.min(1.0, volume + 0.1);
          break;

        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0.0, volume - 0.1));
          video.volume = Math.max(0.0, volume - 0.1);
          break;

        case 'KeyM':
          e.preventDefault();
          toggleMute();
          video.muted = !video.muted;
          break;

        case 'KeyF':
          e.preventDefault();
          if (!document.fullscreenElement) {
            video.parentElement?.requestFullscreen();
            setIsFullscreen(true);
          } else {
            document.exitFullscreen();
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoRef, isPlaying, volume, isFullscreen, setIsPlaying, setVolume, toggleMute, setIsFullscreen, setIsControlsVisible]);
}

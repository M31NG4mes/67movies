import { create } from 'zustand';
import {
  PlayerQualityOption,
  VideoAudioTrack,
  VideoQuality,
  VideoStream,
  VideoSubtitle,
} from '@cinemaflow/types';

let osdTimeout: ReturnType<typeof setTimeout> | null = null;
let centerIconTimeout: ReturnType<typeof setTimeout> | null = null;

interface PlayerStore {
  // Playback state
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  volume: number;
  isMuted: boolean;
  audioBoost: number;
  playbackRate: number;
  isFullscreen: boolean;
  isControlsVisible: boolean;
  autoPlayNext: boolean;
  autoSkipIntro: boolean;
  autoSkipOutro: boolean;
  showManualSkipButtons: boolean;
  useSafeProxy: boolean | undefined;
  isUsingProxy: boolean;
  osdMessage: string | null;
  centerActionIcon: 'play' | 'pause' | null;

  // Active stream and tracks
  activeStream: VideoStream | null;
  activeQuality: VideoQuality;
  availableQualities: PlayerQualityOption[];
  activeAudioTrackId: string | null;
  availableAudioTracks: VideoAudioTrack[];
  activeSubtitleId: string | null;
  availableSubtitles: VideoSubtitle[];

  // Modals state
  isAudioSubsModalOpen: boolean;
  isQualityModalOpen: boolean;
  isSourceModalOpen: boolean;
  error: string | null;

  // Actions
  setIsPlaying: (isPlaying: boolean) => void;
  setIsBuffering: (isBuffering: boolean) => void;
  setCurrentTime: (currentTime: number) => void;
  setDuration: (duration: number) => void;
  setBufferedEnd: (bufferedEnd: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setAudioBoost: (boost: number) => void;
  setPlaybackRate: (rate: number) => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  setIsControlsVisible: (visible: boolean) => void;
  setAutoPlayNext: (autoPlayNext: boolean) => void;
  setAutoSkipIntro: (autoSkipIntro: boolean) => void;
  setAutoSkipOutro: (autoSkipOutro: boolean) => void;
  setShowManualSkipButtons: (show: boolean) => void;
  setUseSafeProxy: (useSafeProxy: boolean | undefined) => void;
  setIsUsingProxy: (isUsingProxy: boolean) => void;
  showOsd: (msg: string) => void;
  flashCenterIcon: (icon: 'play' | 'pause') => void;
  setActiveStream: (stream: VideoStream | null) => void;
  setActiveQuality: (quality: VideoQuality) => void;
  setAvailableQualities: (qualities: PlayerQualityOption[]) => void;
  setActiveAudioTrackId: (id: string | null) => void;
  setAvailableAudioTracks: (tracks: VideoAudioTrack[]) => void;
  setActiveSubtitleId: (id: string | null) => void;
  setAvailableSubtitles: (subs: VideoSubtitle[]) => void;
  openAudioSubsModal: (open: boolean) => void;
  openQualityModal: (open: boolean) => void;
  openSourceModal: (open: boolean) => void;
  setError: (err: string | null) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  isPlaying: false,
  isBuffering: true,
  currentTime: 0,
  duration: 0,
  bufferedEnd: 0,
  volume: 1.0,
  isMuted: false,
  audioBoost: 1.0,
  playbackRate: 1.0,
  isFullscreen: false,
  isControlsVisible: true,
  autoPlayNext: true,
  autoSkipIntro:
    typeof window !== 'undefined' && localStorage.getItem('67m_auto_skip_op') === '1',
  autoSkipOutro:
    typeof window !== 'undefined' && localStorage.getItem('67m_auto_skip_ed') === '1',
  showManualSkipButtons:
    typeof window !== 'undefined'
      ? localStorage.getItem('67m_show_skip_btns') !== '0'
      : true,
  useSafeProxy: undefined,
  isUsingProxy: false,
  osdMessage: null,
  centerActionIcon: null,

  activeStream: null,
  activeQuality: 'auto',
  availableQualities: [],
  activeAudioTrackId: null,
  availableAudioTracks: [],
  activeSubtitleId: null,
  availableSubtitles: [],

  isAudioSubsModalOpen: false,
  isQualityModalOpen: false,
  isSourceModalOpen: false,
  error: null,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsBuffering: (isBuffering) => set({ isBuffering }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setBufferedEnd: (bufferedEnd) => set({ bufferedEnd }),
  setVolume: (rawVolume) => {
    const clamped = Math.max(0, Math.min(1, Math.round(rawVolume * 100) / 100));
    set({ volume: clamped, isMuted: clamped === 0 });
  },
  toggleMute: () =>
    set((state) => {
      const nextMuted = !state.isMuted;
      const nextVol = !nextMuted && state.volume === 0 ? 0.5 : state.volume;
      return { isMuted: nextMuted, volume: nextVol };
    }),
  setAudioBoost: (audioBoost) => set({ audioBoost }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  setIsControlsVisible: (isControlsVisible) => set({ isControlsVisible }),
  setAutoPlayNext: (autoPlayNext) => set({ autoPlayNext }),
  setAutoSkipIntro: (autoSkipIntro) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('67m_auto_skip_op', autoSkipIntro ? '1' : '0');
    }
    set({ autoSkipIntro });
  },
  setAutoSkipOutro: (autoSkipOutro) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('67m_auto_skip_ed', autoSkipOutro ? '1' : '0');
    }
    set({ autoSkipOutro });
  },
  setShowManualSkipButtons: (showManualSkipButtons) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('67m_show_skip_btns', showManualSkipButtons ? '1' : '0');
    }
    set({ showManualSkipButtons });
  },
  setUseSafeProxy: (useSafeProxy) => set({ useSafeProxy }),
  setIsUsingProxy: (isUsingProxy) => set({ isUsingProxy }),
  showOsd: (msg) => {
    if (osdTimeout) clearTimeout(osdTimeout);
    set({ osdMessage: msg });
    osdTimeout = setTimeout(() => {
      set({ osdMessage: null });
    }, 1400);
  },
  flashCenterIcon: (icon) => {
    if (centerIconTimeout) clearTimeout(centerIconTimeout);
    set({ centerActionIcon: icon });
    centerIconTimeout = setTimeout(() => {
      set({ centerActionIcon: null });
    }, 650);
  },
  setActiveStream: (activeStream) => set({ activeStream, error: null }),
  setActiveQuality: (activeQuality) => set({ activeQuality }),
  setAvailableQualities: (availableQualities) => set({ availableQualities }),
  setActiveAudioTrackId: (activeAudioTrackId) => set({ activeAudioTrackId }),
  setAvailableAudioTracks: (availableAudioTracks) => set({ availableAudioTracks }),
  setActiveSubtitleId: (activeSubtitleId) => set({ activeSubtitleId }),
  setAvailableSubtitles: (availableSubtitles) => set({ availableSubtitles }),
  openAudioSubsModal: (isAudioSubsModalOpen) => set({ isAudioSubsModalOpen }),
  openQualityModal: (isQualityModalOpen) => set({ isQualityModalOpen }),
  openSourceModal: (isSourceModalOpen) => set({ isSourceModalOpen }),
  setError: (error) => set({ error, isBuffering: false }),
  reset: () =>
    set({
      isPlaying: false,
      isBuffering: true,
      currentTime: 0,
      duration: 0,
      bufferedEnd: 0,
      error: null,
    }),
}));

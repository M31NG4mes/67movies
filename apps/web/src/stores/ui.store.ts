import { create } from 'zustand';
import { UserProfile } from '@cinemaflow/types';

interface UiStore {
  activeProfile: UserProfile;
  isSidebarExpanded: boolean;
  activeFocusId: string | null;
  setActiveProfile: (profile: UserProfile) => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setActiveFocusId: (id: string | null) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activeProfile: {
    id: 'default-profile',
    name: 'Основной',
    isKidsMode: false,
    language: 'ru',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
  },
  isSidebarExpanded: false,
  activeFocusId: null,
  setActiveProfile: (activeProfile) => set({ activeProfile }),
  setSidebarExpanded: (isSidebarExpanded) => set({ isSidebarExpanded }),
  setActiveFocusId: (activeFocusId) => set({ activeFocusId }),
}));

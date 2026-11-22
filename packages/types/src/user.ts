export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  isKidsMode: boolean;
  language: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  profiles: UserProfile[];
  createdAt: string;
}

export interface WatchProgress {
  id: string;
  profileId: string;
  mediaId: string;
  seasonNumber?: number;
  episodeNumber?: number;
  currentTime: number;
  duration: number;
  percentage: number;
  isCompleted: boolean;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  profileId: string;
  mediaId: string;
  type: 'favorite' | 'watchlist' | 'history';
  createdAt: string;
}

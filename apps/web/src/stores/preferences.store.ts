import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';
export type AppLanguage = 'ru' | 'en';

export interface AccentPreset {
  id: string;
  nameRu: string;
  nameEn: string;
  main: string;
  light: string;
  glow: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'purple',
    nameRu: 'Фиолетовый',
    nameEn: 'Purple',
    main: '#8065FF',
    light: '#A18BFF',
    glow: 'rgba(128, 101, 255, 0.5)',
  },
  {
    id: 'amber',
    nameRu: 'Янтарный',
    nameEn: 'Amber',
    main: '#E2952A',
    light: '#F2AE4B',
    glow: 'rgba(226, 149, 42, 0.5)',
  },
  {
    id: 'emerald',
    nameRu: 'Изумрудный',
    nameEn: 'Emerald',
    main: '#10B981',
    light: '#34D399',
    glow: 'rgba(16, 185, 129, 0.5)',
  },
  {
    id: 'rose',
    nameRu: 'Малиновый',
    nameEn: 'Rose',
    main: '#F43F5E',
    light: '#FB7185',
    glow: 'rgba(244, 63, 94, 0.5)',
  },
  {
    id: 'blue',
    nameRu: 'Синий',
    nameEn: 'Blue',
    main: '#3B82F6',
    light: '#60A5FA',
    glow: 'rgba(59, 130, 246, 0.5)',
  },
];

export const TRANSLATIONS = {
  ru: {
    movies: 'Фильмы',
    series: 'Сериалы',
    catalog: 'Каталог',
    history: 'История',
    watchlist: 'Вотчлист',
    favorites: 'Вотчлист',
    home: 'Главная',
    explore: 'Каталог',
    signIn: 'Войти',
    searchPlaceholder: 'Название фильма, сериала или персоны...',
    oftenSearched: 'Часто ищут',
    watch: 'Смотреть',
    profileSettings: 'Настройки интерфейса и воспроизведения',
    themeLabel: 'Тема оформления',
    themeDark: 'Тёмная',
    themeLight: 'Светлая',
    accentLabel: 'Цветовая гамма',
    languageLabel: 'Язык интерфейса',
    autoplayNext: 'Автопереход к следующей серии',
    subtitlesDefault: 'Включать субтитры по умолчанию',
    defaultQuality: 'Качество по умолчанию',
    profilesTitle: 'Аккаунт',
    activeSessions: 'Активные сессии',
    logout: 'Выйти',
    uploadBanner: 'Загрузить баннер',
    uploadAvatar: 'Загрузить аватар',
    gallery: 'Галерея',
    choosePreset: 'Выбрать готовый',
  },
  en: {
    movies: 'Movies',
    series: 'TV Shows',
    catalog: 'Catalog',
    history: 'History',
    watchlist: 'Watchlist',
    favorites: 'Watchlist',
    home: 'Home',
    explore: 'Catalog',
    signIn: 'Sign In',
    searchPlaceholder: 'Search movies, TV shows or people...',
    oftenSearched: 'Popular searches',
    watch: 'Watch Now',
    profileSettings: 'Interface & Playback Settings',
    themeLabel: 'Appearance Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    accentLabel: 'Accent Color',
    languageLabel: 'Interface Language',
    autoplayNext: 'Auto-play next episode',
    subtitlesDefault: 'Enable subtitles by default',
    defaultQuality: 'Default quality',
    profilesTitle: 'Account',
    activeSessions: 'Active Sessions',
    logout: 'Sign Out',
    uploadBanner: 'Upload Banner',
    uploadAvatar: 'Upload Avatar',
    gallery: 'Gallery',
    choosePreset: 'Choose preset',
  },
} as const;

const PREFS_KEY = '67movies_prefs_v1';

function applyPreferencesToDom(
  theme: ThemeMode,
  accentColor: string,
  language: AppLanguage,
  newYearMode: boolean
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-newyear', newYearMode ? 'true' : 'false');
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.lang = language;

  const preset =
    ACCENT_PRESETS.find((p) => p.main.toLowerCase() === accentColor.toLowerCase()) ||
    ACCENT_PRESETS[0];

  root.style.setProperty('--brand-main', preset.main);
  root.style.setProperty('--brand-light', preset.light);
  root.style.setProperty('--brand-glow', preset.glow);
}

interface PreferencesStore {
  theme: ThemeMode;
  accentColor: string;
  language: AppLanguage;
  newYearMode: boolean;
  ageVerified18: boolean;
  hydrated: boolean;

  hydrate: () => void;
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (color: string) => void;
  setLanguage: (lang: AppLanguage) => void;
  setNewYearMode: (enabled: boolean) => void;
  setAgeVerified18: (verified: boolean) => void;
  syncFromServer: (s: { theme?: string; accentColor?: string; language?: string }) => void;
}

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  theme: 'dark',
  accentColor: '#8065FF',
  language: 'ru',
  newYearMode: false,
  ageVerified18: false,
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const theme: ThemeMode = parsed.theme === 'light' ? 'light' : 'dark';
        const accentColor: string = parsed.accentColor || '#8065FF';
        const language: AppLanguage = parsed.language === 'en' ? 'en' : 'ru';
        const newYearMode = Boolean(parsed.newYearMode);
        const ageVerified18 = Boolean(parsed.ageVerified18);
        applyPreferencesToDom(theme, accentColor, language, newYearMode);
        set({ theme, accentColor, language, newYearMode, ageVerified18, hydrated: true });
        return;
      }
    } catch {
      // ignore storage errors
    }
    const { theme, accentColor, language, newYearMode } = get();
    applyPreferencesToDom(theme, accentColor, language, newYearMode);
    set({ hydrated: true });
  },

  setTheme: (theme) => {
    const { accentColor, language, newYearMode, ageVerified18 } = get();
    applyPreferencesToDom(theme, accentColor, language, newYearMode);
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ theme, accentColor, language, newYearMode, ageVerified18 })
      );
    } catch {}
    set({ theme });
  },

  setAccentColor: (accentColor) => {
    const { theme, language, newYearMode, ageVerified18 } = get();
    applyPreferencesToDom(theme, accentColor, language, newYearMode);
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ theme, accentColor, language, newYearMode, ageVerified18 })
      );
    } catch {}
    set({ accentColor });
  },

  setLanguage: (language) => {
    const { theme, accentColor, newYearMode, ageVerified18 } = get();
    applyPreferencesToDom(theme, accentColor, language, newYearMode);
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ theme, accentColor, language, newYearMode, ageVerified18 })
      );
    } catch {}
    set({ language });
  },

  setNewYearMode: (newYearMode) => {
    const { theme, accentColor, language, ageVerified18 } = get();
    applyPreferencesToDom(theme, accentColor, language, newYearMode);
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ theme, accentColor, language, newYearMode, ageVerified18 })
      );
    } catch {}
    set({ newYearMode });
  },

  setAgeVerified18: (ageVerified18) => {
    const { theme, accentColor, language, newYearMode } = get();
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ theme, accentColor, language, newYearMode, ageVerified18 })
      );
    } catch {}
    set({ ageVerified18 });
  },

  syncFromServer: (s) => {
    const theme: ThemeMode = s.theme === 'light' ? 'light' : get().theme;
    const accentColor = s.accentColor || get().accentColor;
    const language: AppLanguage = s.language === 'en' ? 'en' : s.language === 'ru' ? 'ru' : get().language;
    const { newYearMode, ageVerified18 } = get();
    applyPreferencesToDom(theme, accentColor, language, newYearMode);
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ theme, accentColor, language, newYearMode, ageVerified18 })
      );
    } catch {}
    set({ theme, accentColor, language });
  },
}));

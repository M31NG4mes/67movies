import { create } from 'zustand';

export type ThemeMode = 'dark' | 'midnight' | 'oled' | 'cinema' | 'light';
export type AppLanguage = 'ru' | 'en';

export interface ThemePreset {
  id: ThemeMode;
  nameRu: string;
  nameEn: string;
  bg: string;
  card: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'dark', nameRu: 'Тёмная', nameEn: 'Dark', bg: '#09090D', card: '#111119' },
  { id: 'midnight', nameRu: 'Полночь', nameEn: 'Midnight', bg: '#070B16', card: '#0E1526' },
  { id: 'oled', nameRu: 'OLED Чёрная', nameEn: 'OLED Black', bg: '#000000', card: '#0A0A0E' },
  { id: 'cinema', nameRu: 'Кинозал', nameEn: 'Cinema', bg: '#11090E', card: '#1B1016' },
  { id: 'light', nameRu: 'Светлая', nameEn: 'Light', bg: '#E4E6EE', card: '#F4F5F8' },
];

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
  {
    id: 'cyan',
    nameRu: 'Неон Циан',
    nameEn: 'Neon Cyan',
    main: '#06B6D4',
    light: '#22D3EE',
    glow: 'rgba(6, 182, 212, 0.5)',
  },
  {
    id: 'coral',
    nameRu: 'Коралловый',
    nameEn: 'Coral',
    main: '#FF6B4A',
    light: '#FF8A70',
    glow: 'rgba(255, 107, 74, 0.5)',
  },
  {
    id: 'gold',
    nameRu: 'Золотой',
    nameEn: 'Gold',
    main: '#EAB308',
    light: '#FACC15',
    glow: 'rgba(234, 179, 8, 0.5)',
  },
];

export const TRANSLATIONS = {
  ru: {
    movies: 'Фильмы',
    series: 'Сериалы',
    cartoons: 'Мультфильмы',
    anime: 'Аниме',
    documentary: 'Документалки',
    dorama: 'Дорамы',
    catalog: 'Каталог',
    calendar: 'Календарь',
    chat: 'Чат',
    adminPanel: 'Админ-панель',
    history: 'История',
    watchlist: 'Вотчлист',
    favorites: 'Вотчлист',
    home: 'Главная',
    explore: 'Каталог',
    signIn: 'Войти',
    myProfile: 'Личный кабинет',
    signInAccount: 'Войти в аккаунт',
    searchPlaceholder: 'Название фильма, сериала или персоны...',
    oftenSearched: 'Часто ищут',
    showAllResults: 'Показать все результаты для',
    watch: 'Смотреть',
    addToWatchlist: 'В вотчлист',
    inWatchlist: 'В вотчлисте',
    trending: 'В тренде',
    popularMovies: 'Популярные фильмы',
    popularSeries: 'Популярные сериалы',
    editorsChoice: 'Выбор редакции',
    newMovies: 'Новинки кино',
    newSeries: 'Новые сериалы',
    movieBadge: 'Фильм',
    seriesBadge: 'Сериал',
    catalogSubtitle: 'Выбирайте категорию, сортировку и фильтры по годам, странам и рейтингу',
    sortBy: 'Сортировка',
    sortPopularity: 'По популярности',
    sortRating: 'По рейтингу',
    sortDate: 'По дате выхода',
    sortVotes: 'По числу оценок',
    filters: 'Фильтры',
    advancedFilters: 'Расширенные фильтры каталога',
    reset: 'Сбросить',
    applyFilters: 'Применить фильтры',
    yearLabel: 'Год выхода',
    yearFrom: 'От (напр. 2015)',
    yearTo: 'До (напр. 2026)',
    minRating: 'Минимальный рейтинг',
    anyRating: 'Любой',
    countryLang: 'Страна / Язык',
    anyCountry: 'Любая страна',
    genres: 'Жанры',
    allGenres: 'Все жанры',
    nothingFound: 'Ничего не найдено',
    tryRelaxFilters: 'Попробуйте ослабить фильтры по годам или минимальному рейтингу.',
    prevPage: 'Назад',
    nextPage: 'Далее',
    pageLabel: 'Страница',
    ofLabel: 'из',
    calendarEyebrow: 'График релизов',
    calendarTitle: 'Календарь премьер',
    calendarSubtitle: 'Даты выхода фильмов и сериалов по дням из базы TMDB',
    allTypes: 'Все',
    onAirToday: 'Сегодня в эфире (TVMaze)',
    onAirSubtitle: 'Свежие серии сериалов, выходящие сегодня',
    noReleasesMonth: 'На этот месяц премьер не найдено',
    openMenu: 'Открыть меню',
    closeMenu: 'Закрыть меню',
    winterLabel: 'Зима',
    langShort: 'Язык',
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
    cartoons: 'Cartoons',
    anime: 'Anime',
    documentary: 'Documentaries',
    dorama: 'K-Dramas',
    catalog: 'Catalog',
    calendar: 'Calendar',
    chat: 'Messages',
    adminPanel: 'Admin Panel',
    history: 'History',
    watchlist: 'Watchlist',
    favorites: 'Watchlist',
    home: 'Home',
    explore: 'Catalog',
    signIn: 'Sign In',
    myProfile: 'My Profile',
    signInAccount: 'Sign in to account',
    searchPlaceholder: 'Search movies, TV shows or people...',
    oftenSearched: 'Popular searches',
    showAllResults: 'Show all results for',
    watch: 'Watch Now',
    addToWatchlist: 'Add to Watchlist',
    inWatchlist: 'In Watchlist',
    trending: 'Trending',
    popularMovies: 'Popular Movies',
    popularSeries: 'Popular TV Shows',
    editorsChoice: "Editor's Choice",
    newMovies: 'New Movies',
    newSeries: 'New TV Shows',
    movieBadge: 'Movie',
    seriesBadge: 'Series',
    catalogSubtitle: 'Browse by category, sort order, release year, country and rating',
    sortBy: 'Sort by',
    sortPopularity: 'Most Popular',
    sortRating: 'Highest Rated',
    sortDate: 'Release Date',
    sortVotes: 'Most Voted',
    filters: 'Filters',
    advancedFilters: 'Advanced Catalog Filters',
    reset: 'Reset',
    applyFilters: 'Apply Filters',
    yearLabel: 'Release Year',
    yearFrom: 'From (e.g. 2015)',
    yearTo: 'To (e.g. 2026)',
    minRating: 'Minimum Rating',
    anyRating: 'Any',
    countryLang: 'Country / Language',
    anyCountry: 'Any Country',
    genres: 'Genres',
    allGenres: 'All Genres',
    nothingFound: 'Nothing found',
    tryRelaxFilters: 'Try relaxing year or minimum rating filters.',
    prevPage: 'Previous',
    nextPage: 'Next',
    pageLabel: 'Page',
    ofLabel: 'of',
    calendarEyebrow: 'Release Schedule',
    calendarTitle: 'Premiere Calendar',
    calendarSubtitle: 'Daily movie and series release dates from TMDB',
    allTypes: 'All',
    onAirToday: 'On Air Today (TVMaze)',
    onAirSubtitle: 'Fresh TV episodes airing today across networks & streaming',
    noReleasesMonth: 'No releases found for this month',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    winterLabel: 'Winter',
    langShort: 'Lang',
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
  const isLight = theme === 'light';
  root.classList.toggle('dark', !isLight);
  root.classList.toggle('light', isLight);
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
        const validThemes: ThemeMode[] = ['dark', 'midnight', 'oled', 'cinema', 'light'];
        const theme: ThemeMode = validThemes.includes(parsed.theme) ? parsed.theme : 'dark';
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
    const validThemes: ThemeMode[] = ['dark', 'midnight', 'oled', 'cinema', 'light'];
    const theme: ThemeMode = validThemes.includes(s.theme as ThemeMode)
      ? (s.theme as ThemeMode)
      : get().theme;
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

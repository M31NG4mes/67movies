'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Bookmark,
  Users,
  Film,
  Star,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { ACCENT_PRESETS, usePreferencesStore } from '../../stores/preferences.store';

const PROD_API_FALLBACK = 'https://six7movies-api.onrender.com/api';
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000/api'
      : PROD_API_FALLBACK
    : PROD_API_FALLBACK);

const FORBIDDEN_NICK_ROOTS = [
  'хуй',
  'хуя',
  'хуе',
  'хуи',
  'пизд',
  'еба',
  'ебл',
  'ебн',
  'ебу',
  'ебт',
  'бляд',
  'блять',
  'блят',
  'сука',
  'сучк',
  'мудак',
  'мудил',
  'гандон',
  'гондон',
  'пидор',
  'пидар',
  'педик',
  'шлюх',
  'шалав',
  'мраз',
  'ублюд',
  'залуп',
  'манда',
  'дроч',
  'сперм',
  'порно',
  'даун',
  'дебил',
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'asshole',
  'whore',
  'slut',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'hitler',
  'nazi',
  'porn',
  'admin',
  'administrator',
  'moderator',
  'support',
  '67movies',
  'админ',
  'модератор',
];

function validateNicknameClient(rawName: string): string | null {
  const clean = (rawName || '').trim();
  if (clean.length < 2) return 'Никнейм должен содержать минимум 2 символа';
  if (clean.length > 32) return 'Никнейм не должен превышать 32 символа';
  if (clean.includes('@')) return 'Никнейм не может содержать символ @';
  if (!/^[a-zA-Zа-яА-ЯёЁ0-9 _.-]+$/.test(clean)) {
    return 'Никнейм может содержать только буквы, цифры, пробел, дефис, точку и _';
  }
  const leet: Record<string, string> = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '6': 'б',
    '7': 't',
    '@': 'a',
    '$': 's',
    'ё': 'е',
    'й': 'и',
  };
  let mapped = '';
  for (const ch of clean.toLowerCase()) mapped += leet[ch] ?? ch;
  const collapsed = mapped.replace(/[^a-zа-я0-9]+/gi, '');
  const cyr = collapsed
    .replace(/x/g, 'х')
    .replace(/y/g, 'у')
    .replace(/p/g, 'р')
    .replace(/c/g, 'с')
    .replace(/a/g, 'а')
    .replace(/e/g, 'е')
    .replace(/o/g, 'о')
    .replace(/k/g, 'к')
    .replace(/m/g, 'м')
    .replace(/b/g, 'в');

  for (const root of FORBIDDEN_NICK_ROOTS) {
    if (collapsed.includes(root) || cyr.includes(root)) {
      return 'Этот никнейм содержит запрещённые слова или недопустим';
    }
  }
  return null;
}

type AuthMode = 'register' | 'login' | 'forgot' | 'reset';

const SHOWCASE_MOVIES = [
  {
    title: 'Дюна: Часть вторая',
    year: 2024,
    rating: '8.3',
    tagline: 'Да здравствуют бойцы',
    poster: 'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg',
  },
  {
    title: 'Интерстеллар',
    year: 2014,
    rating: '8.7',
    tagline: 'Следующий шаг человечества станет величайшим',
    poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg',
  },
  {
    title: 'Оппенгеймер',
    year: 2023,
    rating: '8.1',
    tagline: 'Мир изменится навсегда',
    poster: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
  },
];

function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-ZА-Я]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^a-zA-Zа-яА-Я0-9]/.test(pw) || pw.length >= 12) score += 1;

  const labels = ['', 'Слабый', 'Средний', 'Хороший', 'Надёжный'];
  const colors = ['', '#EF4444', '#F59E0B', '#3B82F6', '#10B981'];
  return { score, label: labels[score] || '', color: colors[score] || '#292936' };
}

export default function AuthPage() {
  const router = useRouter();
  const { user, hydrate, setSession } = useAuthStore();
  const { accentColor, setAccentColor } = usePreferencesStore();

  const [mode, setMode] = useState<AuthMode>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Interactive showcase & mouse spotlight state
  const [showcaseMovies, setShowcaseMovies] = useState(SHOWCASE_MOVIES);
  const [activeMovieIdx, setActiveMovieIdx] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 50, y: 40 });

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Fetch top popular movies and pick 3 random ones on each visit
  useEffect(() => {
    let isMounted = true;
    fetch(`${API_BASE}/media/popular/movies?page=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.items?.length) return;
        const valid = data.items.filter(
          (m: any) => m.posterPath && m.backdropPath && m.title
        );
        if (valid.length < 3) return;
        // Fisher-Yates shuffle
        const shuffled = [...valid];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const picked = shuffled.slice(0, 3).map((m: any) => ({
          title: m.title,
          year: m.releaseYear || 2024,
          rating: Number(m.voteAverage || 8).toFixed(1),
          tagline: m.overview ? m.overview.slice(0, 68) + (m.overview.length > 68 ? '…' : '') : 'Популярное сейчас',
          poster: m.posterPath,
          backdrop: m.backdropPath,
        }));
        setShowcaseMovies(picked);
        setActiveMovieIdx(0);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  // Auto-cycle background showcase every 7s
  useEffect(() => {
    const t = setInterval(() => {
      setActiveMovieIdx((prev) => (prev + 1) % showcaseMovies.length);
    }, 7000);
    return () => clearInterval(t);
  }, [showcaseMovies.length]);

  const activeMovie = showcaseMovies[activeMovieIdx] || SHOWCASE_MOVIES[0];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Не удалось отправить код');
        if (data.devResetCode) {
          setDevCodeHint(data.devResetCode);
          setResetCode(data.devResetCode);
        } else {
          setDevCodeHint(null);
          setResetCode('');
        }
        setSuccessMsg(
          data.message || 'Код восстановления отправлен на вашу почту (действителен 15 минут).'
        );
        setMode('reset');
        return;
      }

      if (mode === 'reset') {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            code: resetCode.trim(),
            newPassword,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = Array.isArray(data?.message)
            ? data.message.join('. ')
            : data?.message || 'Не удалось сбросить пароль';
          throw new Error(msg);
        }
        setDevCodeHint(null);
        setResetCode('');
        setNewPassword('');
        setPassword('');
        setSuccessMsg('Пароль успешно обновлён! Теперь войдите с новым паролем.');
        setMode('login');
        return;
      }

      if (mode === 'register') {
        const nickErr = validateNicknameClient(name);
        if (nickErr) {
          throw new Error(nickErr);
        }
      }

      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const body =
        mode === 'register'
          ? {
              name: name.trim(),
              email: email.trim(),
              password,
              deviceName: 'Web Browser',
              rememberDevice,
            }
          : {
              email: email.trim(),
              login: email.trim(),
              password,
              deviceName: 'Web Browser',
              rememberDevice,
            };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(data?.message)
          ? data.message.join('. ')
          : data?.message || 'Ошибка авторизации';
        throw new Error(msg);
      }

      let profiles = data.user?.profiles || [];
      if (profiles.length === 0 && data.accessToken) {
        const profRes = await fetch(`${API_BASE}/profiles`, {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        }).catch(() => null);
        if (profRes?.ok) profiles = await profRes.json();
      }

      setSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        profiles,
        rememberDevice,
      });

      router.push('/');
    } catch (err: any) {
      setError(
        err?.message === 'Failed to fetch'
          ? 'Не удалось подключиться к API (:4000). Убедитесь, что бэкенд запущен.'
          : err?.message || 'Произошла ошибка'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative min-h-screen w-full bg-[#09090D] flex items-center justify-center overflow-hidden px-4 py-10"
    >
      {/* Interactive Crossfading Movie Backdrops */}
      {showcaseMovies.map((movie, idx) => (
        <div
          key={`${movie.title}-${idx}`}
          className={`absolute inset-0 bg-cover bg-center scale-105 transition-opacity duration-1000 ${
            idx === activeMovieIdx ? 'opacity-30' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url(${movie.backdrop})` }}
        />
      ))}

      {/* Deep Cinematic Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#09090D]/95 via-[#09090D]/82 to-[#09090D]/95" />

      {/* Interactive Cursor-Following Spotlight */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(560px circle at ${mousePos.x}% ${mousePos.y}%, var(--brand-glow), transparent 65%)`,
          opacity: 0.32,
        }}
      />

      {/* Main Split Container */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center animate-fadeIn">
        {/* Left Interactive Cinematic Showcase (Desktop) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between space-y-7 pr-4 hero-keep-white">
          <div className="flex flex-col items-start space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl brand-logo-badge flex items-center justify-center text-xl font-black text-white tracking-tighter">
                67
              </div>
              <div className="flex items-baseline">
                <span className="text-3xl font-black text-white tracking-tight">67</span>
                <span className="text-lg font-semibold text-[#A18BFF] ml-0.5">movies</span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#A18BFF]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Премиальный каталог кино</span>
            </div>

            <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight">
              Твой личный <br />
              <span className="text-[#A18BFF]">кинотеатр</span> и клуб друзей
            </h2>

            <p className="text-sm text-white/65 leading-relaxed max-w-md">
              Нажми на любой постер ниже, чтобы сменить атмосферу, или выбери свою цветовую гамму
              интерфейса прямо сейчас.
            </p>
          </div>

          {/* Interactive Clickable Poster Showcase */}
          <div className="space-y-3">
            <div className="flex items-center gap-4 pt-1">
              {showcaseMovies.map((movie, idx) => {
                const isSelected = idx === activeMovieIdx;
                return (
                  <button
                    key={`${movie.title}-${idx}`}
                    type="button"
                    onClick={() => setActiveMovieIdx(idx)}
                    onMouseEnter={() => setActiveMovieIdx(idx)}
                    className={`relative w-28 aspect-[2/3] rounded-2xl overflow-hidden border transition-all duration-300 text-left focus:outline-none ${
                      isSelected
                        ? '-translate-y-2.5 scale-105 border-[#8065FF] shadow-[0_18px_36px_-10px_var(--brand-glow)]'
                        : 'border-white/15 opacity-65 hover:opacity-100 hover:-translate-y-1'
                    }`}
                  >
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/75 text-[10px] font-bold text-white flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-[#A18BFF] text-[#A18BFF]" />
                      {movie.rating}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Backdrop Movie Caption */}
            <div
              key={activeMovie.title}
              className="flex items-center gap-2 text-xs text-white/75 animate-fadeIn"
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--brand-main)' }}
              />
              <span className="font-semibold text-white">{activeMovie.title}</span>
              <span className="text-white/40">•</span>
              <span>{activeMovie.year}</span>
              <span className="text-white/40">•</span>
              <span className="italic text-white/60 truncate">«{activeMovie.tagline}»</span>
            </div>
          </div>

          {/* Feature Pills + Live Accent Color Dots */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Film, text: 'Фильмы, аниме и сериалы' },
                { icon: Bookmark, text: 'Вотчлист и история' },
                { icon: Users, text: 'Друзья и оценки' },
              ].map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.text}
                    className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md space-y-1.5"
                  >
                    <Icon className="w-4 h-4 text-[#A18BFF]" />
                    <p className="text-[11px] font-medium text-white/80 leading-snug">{feat.text}</p>
                  </div>
                );
              })}
            </div>

            {/* Live Theme Color Picker */}
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-medium text-white/50">Цвет темы:</span>
              {ACCENT_PRESETS.map((preset) => {
                const selected = accentColor.toLowerCase() === preset.main.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAccentColor(preset.main)}
                    title={preset.nameRu}
                    className={`w-5 h-5 rounded-full transition-transform hover:scale-125 ${
                      selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#09090D] scale-110' : 'opacity-75'
                    }`}
                    style={{ backgroundColor: preset.main }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Frosted-Glass Auth Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="bg-[#111119]/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-7 sm:p-9 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.85)] animate-scaleIn">
            {/* Mobile Logo */}
            <div className="flex lg:hidden items-center justify-center gap-2.5 mb-5">
              <div className="w-10 h-10 rounded-xl brand-logo-badge flex items-center justify-center text-base font-black text-white">
                67
              </div>
              <div className="flex items-baseline">
                <span className="text-2xl font-black text-white">67</span>
                <span className="text-base font-semibold text-[#A18BFF] ml-0.5">movies</span>
              </div>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-black text-white tracking-tight">
                {mode === 'register'
                  ? 'Создать аккаунт'
                  : mode === 'login'
                  ? 'С возвращением'
                  : 'Восстановление пароля'}
              </h1>
              <p className="text-xs text-[#92929F] mt-1">
                {mode === 'register'
                  ? 'Заполните данные, чтобы войти в 67movies'
                  : mode === 'login'
                  ? 'Войдите в свой аккаунт, чтобы продолжить'
                  : 'Введите email для получения кода сброса'}
              </p>
            </div>

            {/* Segmented Mode Tabs */}
            {(mode === 'register' || mode === 'login') && (
              <div className="grid grid-cols-2 gap-1.5 bg-[#09090D]/90 border border-[#292936] p-1 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                    mode === 'register'
                      ? 'brand-btn text-white'
                      : 'text-[#92929F] hover:text-white'
                  }`}
                >
                  Регистрация
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                    mode === 'login'
                      ? 'brand-btn text-white'
                      : 'text-[#92929F] hover:text-white'
                  }`}
                >
                  Вход
                </button>
              </div>
            )}

            {/* Success Banner */}
            {successMsg && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 space-y-1 animate-fadeIn">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
                {devCodeHint && (
                  <p className="text-[11px] text-white font-mono bg-black/35 px-2.5 py-1 rounded-lg mt-1.5">
                    Локальный код (dev): <strong>{devCodeHint}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200 flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-[#92929F] mb-1.5">
                    Никнейм
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#92929F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ваш ник"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#09090D]/90 border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF] transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#92929F] mb-1.5">
                  {mode === 'login' ? 'Email или никнейм' : 'Email'}
                </label>
                <div className="relative">
                  {mode === 'login' && !email.includes('@') ? (
                    <User className="w-4 h-4 text-[#92929F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  ) : (
                    <Mail className="w-4 h-4 text-[#92929F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  )}
                  <input
                    type={mode === 'login' ? 'text' : 'email'}
                    required
                    minLength={2}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      mode === 'login' ? 'you@example.com или ваш ник' : 'you@example.com'
                    }
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#09090D]/90 border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF] transition-colors"
                  />
                </div>
              </div>

              {(mode === 'register' || mode === 'login') && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#92929F]">
                      Пароль {mode === 'register' && '(от 8 символов)'}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError(null);
                          setSuccessMsg(null);
                        }}
                        className="text-xs font-semibold text-[#A18BFF] hover:text-white transition-colors"
                      >
                        Забыли пароль?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#92929F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={mode === 'register' ? 8 : 1}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-3 rounded-xl bg-[#09090D]/90 border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Показать пароль"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#92929F] hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Live Password Strength Meter */}
                  {mode === 'register' && password.length > 0 && (
                    <div className="mt-2.5 space-y-1.5 animate-fadeIn">
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((lvl) => (
                          <div
                            key={lvl}
                            className="h-1 rounded-full transition-all duration-300"
                            style={{
                              backgroundColor:
                                strength.score >= lvl ? strength.color : '#292936',
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#92929F]">Надёжность пароля</span>
                        <span className="font-semibold" style={{ color: strength.color }}>
                          {strength.label}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Remember This Device toggle */}
                  <button
                    type="button"
                    onClick={() => setRememberDevice((v) => !v)}
                    className="mt-3 w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#09090D]/70 hover:bg-[#09090D] border border-[#292936] hover:border-[#8065FF]/50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                          rememberDevice
                            ? 'bg-[#8065FF] border-[#8065FF] text-white'
                            : 'bg-transparent border-[#92929F]/60 group-hover:border-white'
                        }`}
                      >
                        {rememberDevice && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-semibold text-white/90">
                        Запомнить это устройство
                      </span>
                    </div>
                    <span className="text-[11px] text-[#92929F]">
                      {rememberDevice ? 'На 30 дней' : 'Только сессия'}
                    </span>
                  </button>
                </div>
              )}

              {mode === 'reset' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#92929F] mb-1.5">
                      Код восстановления (6 цифр)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#92929F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        placeholder="123456"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#09090D]/90 border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF] font-mono tracking-widest"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#92929F] mb-1.5">
                      Новый пароль (от 8 символов)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#92929F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-11 py-3 rounded-xl bg-[#09090D]/90 border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Показать пароль"
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#92929F] hover:text-white transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 rounded-xl brand-btn text-white font-bold text-sm disabled:opacity-50"
              >
                <span>
                  {loading
                    ? 'Подождите...'
                    : mode === 'register'
                    ? 'Создать аккаунт'
                    : mode === 'login'
                    ? 'Войти в 67movies'
                    : mode === 'forgot'
                    ? 'Получить код восстановления'
                    : 'Сохранить новый пароль'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {(mode === 'forgot' || mode === 'reset') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="w-full py-2 text-xs font-semibold text-[#92929F] hover:text-white transition-colors"
                >
                  ← Вернуться ко входу
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

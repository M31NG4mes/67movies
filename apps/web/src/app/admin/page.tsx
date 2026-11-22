'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  BarChart3,
  Users,
  Server,
  AlertTriangle,
  Settings,
  RefreshCw,
  Plus,
  Trash2,
  Ban,
  CheckCircle2,
  XCircle,
  Search,
  Activity,
  Edit3,
  X,
  LogOut,
  Power,
  Eye,
  Clock,
  Lock,
  Sparkles,
} from 'lucide-react';
import { authFetch, useAuthStore } from '../../stores/auth.store';

type AdminTab = 'overview' | 'users' | 'sources' | 'errors' | 'settings';

interface AccessState {
  role: 'ADMIN' | 'MODERATOR' | 'USER';
  canAccessAdmin: boolean;
  canBootstrapAdmin: boolean;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, accessToken, hydrated, hydrate } = useAuthStore();

  const [access, setAccess] = useState<AccessState | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [toast, setToast] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

  // Dashboard Stats
  const [daysRange, setDaysRange] = useState(14);
  const [stats, setStats] = useState<any>(null);

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  // Sources
  const [sources, setSources] = useState<any[]>([]);
  const [sourceTypeFilter, setSourceTypeFilter] = useState('');
  const [checkingSourceId, setCheckingSourceId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [sourceModal, setSourceModal] = useState<{ mode: 'create' | 'edit'; item?: any } | null>(
    null
  );
  const [sourceForm, setSourceForm] = useState({
    name: '',
    code: '',
    type: 'METADATA',
    baseUrl: '',
    healthPath: '',
    priority: 10,
    timeoutMs: 6000,
    isEnabled: true,
  });

  // Errors
  const [errors, setErrors] = useState<any[]>([]);
  const [errorSourceFilter, setErrorSourceFilter] = useState('');

  // Site Settings
  const [siteSettings, setSiteSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const notify = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast((prev) => (prev?.text === text ? null : prev)), 4000);
  };

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace('/auth');
    }
  }, [hydrated, accessToken, router]);

  const checkAccess = useCallback(async () => {
    if (!accessToken) return;
    setLoadingAccess(true);
    try {
      const res = await authFetch('/admin/access', { cache: 'no-store' });
      if (res.ok) {
        setAccess(await res.json());
      } else {
        setAccess({ role: 'USER', canAccessAdmin: false, canBootstrapAdmin: false });
      }
    } finally {
      setLoadingAccess(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) checkAccess();
  }, [accessToken, checkAccess]);

  const loadStats = useCallback(async () => {
    const res = await authFetch(`/admin/stats?days=${daysRange}`, { cache: 'no-store' }).catch(
      () => null
    );
    if (res?.ok) setStats(await res.json());
  }, [daysRange]);

  const loadUsers = useCallback(async () => {
    const sp = new URLSearchParams();
    if (userSearch.trim()) sp.set('search', userSearch.trim());
    if (userRoleFilter) sp.set('role', userRoleFilter);
    if (userStatusFilter) sp.set('status', userStatusFilter);
    const res = await authFetch(`/admin/users?${sp.toString()}`, { cache: 'no-store' }).catch(
      () => null
    );
    if (res?.ok) setUsers(await res.json());
  }, [userSearch, userRoleFilter, userStatusFilter]);

  const loadSources = useCallback(async () => {
    const res = await authFetch('/admin/sources', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setSources(await res.json());
  }, []);

  const loadErrors = useCallback(async () => {
    const q = errorSourceFilter ? `?sourceId=${encodeURIComponent(errorSourceFilter)}` : '';
    const res = await authFetch(`/admin/source-errors${q}`, { cache: 'no-store' }).catch(
      () => null
    );
    if (res?.ok) setErrors(await res.json());
  }, [errorSourceFilter]);

  const loadSiteSettings = useCallback(async () => {
    const res = await authFetch('/admin/site-settings', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setSiteSettings(await res.json());
  }, []);

  useEffect(() => {
    if (!access?.canAccessAdmin) return;
    loadStats();
    loadSources();
    loadErrors();
    loadSiteSettings();
  }, [access?.canAccessAdmin, loadStats, loadSources, loadErrors, loadSiteSettings]);

  useEffect(() => {
    if (!access?.canAccessAdmin) return;
    const timer = setTimeout(() => {
      loadUsers();
    }, 200);
    return () => clearTimeout(timer);
  }, [access?.canAccessAdmin, loadUsers]);

  const isAdmin = access?.role === 'ADMIN';

  const handleBootstrapAdmin = async () => {
    const res = await authFetch('/admin/bootstrap', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      notify('Вы назначены первым администратором!');
      await checkAccess();
    } else {
      notify(data?.message || 'Не удалось получить права администратора', 'err');
    }
  };

  // --- User Actions ---
  const handleUpdateUser = async (targetId: string, patch: Record<string, any>) => {
    const res = await authFetch(`/admin/users/${targetId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      notify('Учетная запись обновлена');
      loadUsers();
      loadStats();
    } else {
      notify(data?.message || 'Нет прав для этого действия', 'err');
    }
  };

  const handleRevokeUserSessions = async (targetId: string) => {
    const res = await authFetch(`/admin/users/${targetId}/revoke-sessions`, { method: 'POST' });
    if (res.ok) {
      notify('Все активные сессии пользователя завершены');
      loadUsers();
    } else {
      notify('Ошибка завершения сессий', 'err');
    }
  };

  const handleDeleteUser = async (targetId: string, name: string) => {
    if (!window.confirm(`Удалить аккаунт «${name}»? Это действие необратимо.`)) return;
    const res = await authFetch(`/admin/users/${targetId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      notify('Учетная запись удалена');
      loadUsers();
      loadStats();
    } else {
      notify(data?.message || 'Не удалось удалить аккаунт', 'err');
    }
  };

  // --- Source Actions ---
  const openCreateSource = () => {
    setSourceForm({
      name: '',
      code: '',
      type: 'METADATA',
      baseUrl: '',
      healthPath: '',
      priority: 10,
      timeoutMs: 6000,
      isEnabled: true,
    });
    setSourceModal({ mode: 'create' });
  };

  const openEditSource = (item: any) => {
    setSourceForm({
      name: item.name || '',
      code: item.code || '',
      type: item.type || 'METADATA',
      baseUrl: item.baseUrl || '',
      healthPath: item.healthPath || '',
      priority: Number(item.priority || 10),
      timeoutMs: Number(item.timeoutMs || 6000),
      isEnabled: Boolean(item.isEnabled),
    });
    setSourceModal({ mode: 'edit', item });
  };

  const handleSaveSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceModal) return;

    const isCreate = sourceModal.mode === 'create';
    const url = isCreate ? '/admin/sources' : `/admin/sources/${sourceModal.item.id}`;
    const method = isCreate ? 'POST' : 'PATCH';
    const payload = isCreate
      ? sourceForm
      : {
          name: sourceForm.name,
          type: sourceForm.type,
          baseUrl: sourceForm.baseUrl,
          healthPath: sourceForm.healthPath,
          priority: Number(sourceForm.priority),
          timeoutMs: Number(sourceForm.timeoutMs),
          isEnabled: sourceForm.isEnabled,
        };

    const res = await authFetch(url, { method, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      notify(isCreate ? 'Источник добавлен' : 'Настройки источника сохранены');
      setSourceModal(null);
      loadSources();
      loadStats();
    } else {
      notify(
        Array.isArray(data?.message) ? data.message.join(', ') : data?.message || 'Ошибка сохранения',
        'err'
      );
    }
  };

  const handleToggleSource = async (item: any) => {
    const res = await authFetch(`/admin/sources/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled: !item.isEnabled }),
    });
    if (res.ok) {
      notify(item.isEnabled ? `Источник «${item.name}» отключён` : `Источник «${item.name}» включён`);
      loadSources();
      loadStats();
    }
  };

  const handleDeleteSource = async (item: any) => {
    if (!window.confirm(`Удалить источник «${item.name}»?`)) return;
    const res = await authFetch(`/admin/sources/${item.id}`, { method: 'DELETE' });
    if (res.ok) {
      notify('Источник удалён');
      loadSources();
      loadStats();
    } else {
      const data = await res.json().catch(() => ({}));
      notify(data?.message || 'Нет прав на удаление источника', 'err');
    }
  };

  const handleCheckSource = async (id: string) => {
    setCheckingSourceId(id);
    try {
      const res = await authFetch(`/admin/sources/${id}/check`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        notify(
          `Проверка завершена: ${updated.name} — ${updated.lastStatus} (${updated.lastLatencyMs} мс)`
        );
        loadSources();
        loadErrors();
        loadStats();
      }
    } finally {
      setCheckingSourceId(null);
    }
  };

  const handleCheckAllSources = async () => {
    setCheckingAll(true);
    try {
      const res = await authFetch('/admin/sources/check-all', { method: 'POST' });
      if (res.ok) {
        notify('Проверка всех источников завершена');
        loadSources();
        loadErrors();
        loadStats();
      }
    } finally {
      setCheckingAll(false);
    }
  };

  const handleClearErrors = async () => {
    const q = errorSourceFilter ? `?sourceId=${encodeURIComponent(errorSourceFilter)}` : '';
    const res = await authFetch(`/admin/source-errors${q}`, { method: 'DELETE' });
    if (res.ok) {
      notify('Логи ошибок очищены');
      loadErrors();
      loadStats();
    } else {
      const data = await res.json().catch(() => ({}));
      notify(data?.message || 'Только администратор может очищать логи', 'err');
    }
  };

  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteSettings) return;
    setSavingSettings(true);
    try {
      const res = await authFetch('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify(siteSettings),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSiteSettings(data);
        notify('Глобальные настройки сайта сохранены');
      } else {
        notify(data?.message || 'Нет прав для изменения настроек сайта', 'err');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  if (!hydrated || loadingAccess) {
    return (
      <div className="min-h-screen bg-[#09090D] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#8065FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Server-enforced Access Denied screen
  if (!access?.canAccessAdmin) {
    return (
      <div className="min-h-screen bg-[#09090D] flex items-center justify-center px-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#111119] border border-[#292936] text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white">Доступ запрещён (403)</h1>
          <p className="text-sm text-[#92929F] leading-relaxed">
            Административная панель доступна только пользователям с ролью{' '}
            <span className="text-white font-bold">Admin</span> или{' '}
            <span className="text-white font-bold">Moderator</span>. Ваша текущая роль:{' '}
            <span className="text-[#A18BFF] font-bold">{access?.role || 'USER'}</span>.
          </p>

          {access?.canBootstrapAdmin && (
            <div className="pt-2 space-y-2 border-t border-[#292936]">
              <p className="text-xs text-emerald-300">
                В базе ещё нет ни одного администратора. Вы можете активировать права главного
                администратора для аккаунта <b>{user?.email}</b>:
              </p>
              <button
                type="button"
                onClick={handleBootstrapAdmin}
                className="w-full py-3 rounded-xl brand-btn text-white text-sm font-bold inline-flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Стать первым администратором</span>
              </button>
            </div>
          )}

          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#181821] hover:bg-[#292936] text-white text-xs font-bold transition-colors"
          >
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  const filteredSources = sourceTypeFilter
    ? sources.filter((s) => s.type === sourceTypeFilter)
    : sources;

  const maxDailyViews = Math.max(
    1,
    ...(stats?.dailyViews || []).map((d: any) => Number(d.views || 0))
  );

  const navItems: { id: AdminTab; label: string; icon: any; badge?: number }[] = [
    { id: 'overview', label: 'Статистика', icon: BarChart3 },
    { id: 'users', label: 'Пользователи', icon: Users },
    { id: 'sources', label: 'Источники', icon: Server },
    { id: 'errors', label: 'Ошибки', icon: AlertTriangle, badge: errors.length },
    { id: 'settings', label: 'Настройки сайта', icon: Settings },
  ];

  return (
    <div
      data-theme="dark"
      className="min-h-screen bg-[#07070B] text-white pt-16 md:pt-8 pb-20 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-[1480px] mx-auto space-y-6">
        {/* Top Admin Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[#111119] border border-[#292936]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#8065FF]/20 border border-[#8065FF]/40 flex items-center justify-center text-[#A18BFF]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  67movies Admin Panel
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase ${
                    isAdmin
                      ? 'bg-[#8065FF]/20 text-[#A18BFF] border border-[#8065FF]/40'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  }`}
                >
                  {access.role}
                </span>
              </div>
              <p className="text-xs text-[#92929F] mt-0.5">
                Управление пользователями, источниками, мониторингом доступности и настройками
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                loadStats();
                loadUsers();
                loadSources();
                loadErrors();
                notify('Данные обновлены');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#181821] hover:bg-[#232330] border border-[#292936] text-xs font-bold text-white transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#A18BFF]" />
              <span>Обновить</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#181821] hover:bg-[#232330] border border-[#292936] text-xs font-bold text-[#92929F] hover:text-white transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>На сайт</span>
            </Link>
          </div>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div
            className={`px-4 py-3 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between animate-fadeIn ${
              toast.type === 'err'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <span>{toast.text}</span>
            <button type="button" onClick={() => setToast(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Grid: Admin Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Navigation */}
          <aside className="lg:col-span-3 xl:col-span-2">
            <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0 p-2 rounded-3xl bg-[#111119] border border-[#292936]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center justify-between gap-2.5 px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                      active
                        ? 'bg-[#8065FF] text-white shadow-lg shadow-[#8065FF]/25'
                        : 'text-[#92929F] hover:text-white hover:bg-[#181821]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {Boolean(item.badge) && (
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                          active ? 'bg-white/20 text-white' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right Workspace */}
          <main className="lg:col-span-9 xl:col-span-10 space-y-6">
            {/* ===============================================================
                TAB 1: OVERVIEW & ANALYTICS
               =============================================================== */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-6 animate-fadeIn">
                {/* 4 KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="p-5 rounded-3xl bg-[#111119] border border-[#292936] space-y-2">
                    <div className="flex items-center justify-between text-[#92929F]">
                      <span className="text-xs font-bold uppercase">Пользователи</span>
                      <Users className="w-4 h-4 text-[#A18BFF]" />
                    </div>
                    <p className="text-3xl font-black text-white">{stats.kpi.totalUsers}</p>
                    <p className="text-xs text-[#92929F]">
                      Активных: <span className="text-emerald-400 font-bold">{stats.kpi.activeUsers}</span> • Бан:{' '}
                      <span className="text-rose-400 font-bold">{stats.kpi.bannedUsers}</span>
                    </p>
                  </div>

                  <div className="p-5 rounded-3xl bg-[#111119] border border-[#292936] space-y-2">
                    <div className="flex items-center justify-between text-[#92929F]">
                      <span className="text-xs font-bold uppercase">Просмотры</span>
                      <Eye className="w-4 h-4 text-sky-400" />
                    </div>
                    <p className="text-3xl font-black text-white">{stats.kpi.totalViews}</p>
                    <p className="text-xs text-[#92929F]">
                      Оценок на сайте: <span className="text-[#A18BFF] font-bold">{stats.kpi.totalRatings}</span>
                    </p>
                  </div>

                  <div className="p-5 rounded-3xl bg-[#111119] border border-[#292936] space-y-2">
                    <div className="flex items-center justify-between text-[#92929F]">
                      <span className="text-xs font-bold uppercase">Источники</span>
                      <Server className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-3xl font-black text-white">
                      {stats.kpi.enabledSources}/{stats.kpi.totalSources}
                    </p>
                    <p className="text-xs text-[#92929F]">
                      Онлайн после проверки:{' '}
                      <span className="text-emerald-400 font-bold">{stats.kpi.onlineSources}</span>
                    </p>
                  </div>

                  <div className="p-5 rounded-3xl bg-[#111119] border border-[#292936] space-y-2">
                    <div className="flex items-center justify-between text-[#92929F]">
                      <span className="text-xs font-bold uppercase">Ошибки источников</span>
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    </div>
                    <p className="text-3xl font-black text-white">{stats.kpi.recentErrors}</p>
                    <p className="text-xs text-[#92929F]">Зафиксировано в журнале сбоев</p>
                  </div>
                </div>

                {/* Daily Views Bar Chart + Role Distribution */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-white">
                          Динамика просмотров по дням
                        </h2>
                        <p className="text-xs text-[#92929F]">
                          Количество открытий фильмов и сериалов пользователями
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-[#09090D] p-1 rounded-xl border border-[#292936]">
                        {[7, 14, 30].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDaysRange(d)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              daysRange === d
                                ? 'bg-[#8065FF] text-white'
                                : 'text-[#92929F] hover:text-white'
                            }`}
                          >
                            {d} дн.
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-56 flex items-end gap-1.5 sm:gap-2 pt-4">
                      {(stats.dailyViews || []).map((point: any) => {
                        const pct = Math.max(6, Math.round((point.views / maxDailyViews) * 100));
                        return (
                          <div
                            key={point.date}
                            className="flex-1 flex flex-col items-center gap-2 group h-full justify-end"
                          >
                            <div className="relative w-full flex-1 flex items-end">
                              <div
                                style={{ height: `${pct}%` }}
                                className="w-full rounded-t-lg bg-gradient-to-t from-[#8065FF]/60 to-[#A18BFF] group-hover:from-[#8065FF] group-hover:to-white transition-all relative"
                              >
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-[#181821] border border-[#292936] text-[10px] font-bold text-white whitespace-nowrap z-10">
                                  {point.views} просм.
                                </span>
                              </div>
                            </div>
                            <span className="text-[9px] text-[#92929F] font-medium">
                              {point.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Role Distribution */}
                  <div className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-5">
                    <h2 className="text-base font-bold text-white">Распределение ролей</h2>
                    <div className="space-y-4">
                      {(
                        [
                          { key: 'ADMIN', label: 'Admin', color: 'bg-[#8065FF]' },
                          { key: 'MODERATOR', label: 'Moderator', color: 'bg-sky-400' },
                          { key: 'USER', label: 'User', color: 'bg-emerald-400' },
                        ] as const
                      ).map((r) => {
                        const count = stats.roleCounts?.[r.key] || 0;
                        const total = Math.max(1, stats.kpi.totalUsers);
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={r.key} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white">{r.label}</span>
                              <span className="text-[#92929F]">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2.5 rounded-full bg-[#181821] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${r.color}`}
                                style={{ width: `${Math.max(4, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Top Watched Titles Table */}
                <div className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-4">
                  <h2 className="text-base font-bold text-white">
                    Самые популярные тайтлы за {daysRange} дней
                  </h2>
                  {!stats.topTitles || stats.topTitles.length === 0 ? (
                    <p className="text-xs text-[#92929F]">
                      Пока нет данных о просмотрах за выбранный период.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[#92929F] uppercase border-b border-[#292936]">
                          <tr>
                            <th className="py-2.5 pr-4">#</th>
                            <th className="py-2.5 pr-4">Название</th>
                            <th className="py-2.5 pr-4">Тип</th>
                            <th className="py-2.5 text-right">Просмотры</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#292936]/60">
                          {stats.topTitles.map((item: any, idx: number) => (
                            <tr key={`${item.mediaType}-${item.tmdbId}`} className="hover:bg-[#181821]/60">
                              <td className="py-3 pr-4 font-black text-[#A18BFF]">{idx + 1}</td>
                              <td className="py-3 pr-4 font-bold text-white">
                                <Link
                                  href={`/movie/${item.tmdbId}?type=${
                                    item.mediaType === 'SERIES' ? 'tv' : 'movie'
                                  }`}
                                  className="hover:text-[#A18BFF] transition-colors"
                                >
                                  {item.title}
                                </Link>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="px-2 py-0.5 rounded bg-[#181821] border border-[#292936] text-[10px] font-bold">
                                  {item.mediaType === 'SERIES' ? 'Сериал' : 'Фильм'}
                                </span>
                              </td>
                              <td className="py-3 text-right font-black text-white">
                                {item.views}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 2: USERS & ACCOUNTS MANAGEMENT
               =============================================================== */}
            {activeTab === 'users' && (
              <div className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-5 animate-fadeIn">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Пользователи и роли ({users.length})
                    </h2>
                    <p className="text-xs text-[#92929F]">
                      Все права и блокировки проверяются на сервере при каждом запросе
                    </p>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#92929F] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Имя или email..."
                        className="pl-8 pr-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
                      />
                    </div>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white focus:outline-none focus:border-[#8065FF]"
                    >
                      <option value="">Все роли</option>
                      <option value="ADMIN">Admin</option>
                      <option value="MODERATOR">Moderator</option>
                      <option value="USER">User</option>
                    </select>
                    <select
                      value={userStatusFilter}
                      onChange={(e) => setUserStatusFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white focus:outline-none focus:border-[#8065FF]"
                    >
                      <option value="">Все статусы</option>
                      <option value="active">Активные</option>
                      <option value="banned">Заблокированные</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[#92929F] uppercase border-b border-[#292936]">
                      <tr>
                        <th className="py-3 pr-4">Пользователь</th>
                        <th className="py-3 pr-4">Роль</th>
                        <th className="py-3 pr-4">Статус</th>
                        <th className="py-3 pr-4">Активность</th>
                        <th className="py-3 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#292936]/60">
                      {users.map((u) => {
                        const isSelf = u.id === user?.id;
                        return (
                          <tr key={u.id} className="hover:bg-[#181821]/50">
                            <td className="py-3.5 pr-4">
                              <p className="font-bold text-white">
                                {u.name}{' '}
                                {isSelf && (
                                  <span className="text-[10px] text-[#A18BFF] font-semibold">
                                    (Вы)
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-[#92929F]">{u.email}</p>
                            </td>
                            <td className="py-3.5 pr-4">
                              {isAdmin && !isSelf ? (
                                <select
                                  value={u.role}
                                  onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#181821] border border-[#292936] text-xs font-bold text-white focus:outline-none focus:border-[#8065FF]"
                                >
                                  <option value="USER">User</option>
                                  <option value="MODERATOR">Moderator</option>
                                  <option value="ADMIN">Admin</option>
                                </select>
                              ) : (
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                    u.role === 'ADMIN'
                                      ? 'bg-[#8065FF]/20 text-[#A18BFF]'
                                      : u.role === 'MODERATOR'
                                      ? 'bg-sky-500/20 text-sky-300'
                                      : 'bg-[#181821] text-[#92929F]'
                                  }`}
                                >
                                  {u.role}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pr-4">
                              {u.isActive ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Активен
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Заблокирован
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pr-4 text-[#92929F]">
                              Оценок: <b className="text-white">{u.ratingsCount}</b> • Подборок:{' '}
                              <b className="text-white">{u.collectionsCount}</b> • Сессий:{' '}
                              <b className="text-white">{u.sessionsCount}</b>
                            </td>
                            <td className="py-3.5 text-right">
                              {!isSelf && (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateUser(u.id, { isActive: !u.isActive })
                                    }
                                    title={u.isActive ? 'Заблокировать' : 'Разблокировать'}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                                      u.isActive
                                        ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300'
                                        : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300'
                                    }`}
                                  >
                                    {u.isActive ? 'Бан' : 'Разбан'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeUserSessions(u.id)}
                                    title="Сбросить все сессии"
                                    className="p-1.5 rounded-lg bg-[#181821] hover:bg-[#292936] text-[#92929F] hover:text-white"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u.id, u.name)}
                                      title="Удалить аккаунт"
                                      className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 3: MEDIA SOURCES MANAGEMENT & HEALTH CHECKS
               =============================================================== */}
            {activeTab === 'sources' && (
              <div className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-5 animate-fadeIn">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Источники данных и платформ ({filteredSources.length})
                    </h2>
                    <p className="text-xs text-[#92929F]">
                      Добавление, отключение, приоритеты, таймауты и проверка доступности (Health
                      Check)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={sourceTypeFilter}
                      onChange={(e) => setSourceTypeFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white"
                    >
                      <option value="">Все типы</option>
                      <option value="METADATA">METADATA</option>
                      <option value="STREAMING">STREAMING</option>
                      <option value="SCHEDULE">SCHEDULE</option>
                      <option value="ANIME">ANIME</option>
                      <option value="TRAILERS">TRAILERS</option>
                    </select>
                    <button
                      type="button"
                      disabled={checkingAll}
                      onClick={handleCheckAllSources}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#181821] hover:bg-[#292936] border border-[#292936] text-xs font-bold text-emerald-300 disabled:opacity-50"
                    >
                      <Activity className={`w-3.5 h-3.5 ${checkingAll ? 'animate-pulse' : ''}`} />
                      <span>{checkingAll ? 'Проверка...' : 'Проверить все'}</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={openCreateSource}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl brand-btn text-white text-xs font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Добавить источник</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[#92929F] uppercase border-b border-[#292936]">
                      <tr>
                        <th className="py-3 pr-4">Источник</th>
                        <th className="py-3 pr-4">Тип / Приоритет</th>
                        <th className="py-3 pr-4">Доступность</th>
                        <th className="py-3 pr-4">Ошибки</th>
                        <th className="py-3 pr-4">Включён</th>
                        <th className="py-3 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#292936]/60">
                      {filteredSources.map((s) => (
                        <tr key={s.id} className="hover:bg-[#181821]/50">
                          <td className="py-3.5 pr-4">
                            <p className="font-bold text-white">{s.name}</p>
                            <p className="text-[11px] text-[#92929F] truncate max-w-[260px]">
                              {s.baseUrl}
                              {s.healthPath}
                            </p>
                          </td>
                          <td className="py-3.5 pr-4">
                            <span className="px-2 py-0.5 rounded bg-[#181821] border border-[#292936] text-[10px] font-bold text-[#A18BFF]">
                              {s.type}
                            </span>
                            <span className="ml-2 text-[#92929F]">P{s.priority}</span>
                            <span className="ml-2 text-[#92929F]">{s.timeoutMs}мс</span>
                          </td>
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  s.lastStatus === 'ONLINE'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : s.lastStatus === 'DEGRADED'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : s.lastStatus === 'OFFLINE'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-[#181821] text-[#92929F]'
                                }`}
                              >
                                {s.lastStatus || 'UNKNOWN'}
                              </span>
                              {s.lastLatencyMs !== null && s.lastLatencyMs !== undefined && (
                                <span className="text-[11px] text-[#92929F] flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" />
                                  {s.lastLatencyMs} мс
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 pr-4">
                            <span
                              className={`font-bold ${
                                s.errorCount > 0 ? 'text-rose-400' : 'text-[#92929F]'
                              }`}
                            >
                              {s.errorCount || 0}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4">
                            <button
                              type="button"
                              onClick={() => handleToggleSource(s)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                s.isEnabled
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-[#181821] text-[#92929F] border border-[#292936]'
                              }`}
                            >
                              <Power className="w-3 h-3" />
                              <span>{s.isEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
                            </button>
                          </td>
                          <td className="py-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={checkingSourceId === s.id}
                                onClick={() => handleCheckSource(s.id)}
                                title="Проверить доступность"
                                className="px-2.5 py-1.5 rounded-lg bg-[#181821] hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-bold disabled:opacity-50"
                              >
                                {checkingSourceId === s.id ? '...' : 'Ping'}
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditSource(s)}
                                title="Изменить настройки"
                                className="p-1.5 rounded-lg bg-[#181821] hover:bg-[#8065FF]/20 text-[#A18BFF]"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSource(s)}
                                  title="Удалить источник"
                                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 4: SOURCE ERROR LOGS
               =============================================================== */}
            {activeTab === 'errors' && (
              <div className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-5 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Журнал ошибок источников ({errors.length})
                    </h2>
                    <p className="text-xs text-[#92929F]">
                      Автоматически пополняется при сбоях, таймаутах и HTTP-ошибках проверок
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={errorSourceFilter}
                      onChange={(e) => setErrorSourceFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white"
                    >
                      <option value="">Все источники</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {isAdmin && errors.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearErrors}
                        className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold"
                      >
                        Очистить логи
                      </button>
                    )}
                  </div>
                </div>

                {errors.length === 0 ? (
                  <div className="p-10 rounded-2xl bg-[#181821] border border-[#292936] text-center space-y-2">
                    <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
                    <p className="text-sm font-bold text-white">Ошибок не зафиксировано</p>
                    <p className="text-xs text-[#92929F]">
                      Нажмите «Проверить все» во вкладке Источники, чтобы просканировать доступность.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[#92929F] uppercase border-b border-[#292936]">
                        <tr>
                          <th className="py-3 pr-4">Время</th>
                          <th className="py-3 pr-4">Источник</th>
                          <th className="py-3 pr-4">Код</th>
                          <th className="py-3 pr-4">Эндпоинт</th>
                          <th className="py-3">Сообщение</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#292936]/60">
                        {errors.map((err) => (
                          <tr key={err.id} className="hover:bg-[#181821]/50">
                            <td className="py-3 pr-4 text-[#92929F] whitespace-nowrap">
                              {new Date(err.createdAt).toLocaleString('ru-RU')}
                            </td>
                            <td className="py-3 pr-4 font-bold text-white">
                              {err.source?.name || err.sourceId}
                            </td>
                            <td className="py-3 pr-4">
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-black">
                                {err.statusCode || 'NET'}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-[#92929F] max-w-[220px] truncate">
                              {err.endpoint}
                            </td>
                            <td className="py-3 text-rose-200">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                TAB 5: GLOBAL SITE SETTINGS
               =============================================================== */}
            {activeTab === 'settings' && siteSettings && (
              <form
                onSubmit={handleSaveSiteSettings}
                className="p-6 rounded-3xl bg-[#111119] border border-[#292936] space-y-5 animate-fadeIn"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Глобальные настройки сайта</h2>
                    <p className="text-xs text-[#92929F]">
                      {isAdmin
                        ? 'Изменения применяются ко всей платформе 67movies'
                        : 'Режим только для чтения (редактирование доступно только Admin)'}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="px-5 py-2.5 rounded-xl brand-btn text-white text-xs font-bold disabled:opacity-50"
                    >
                      {savingSettings ? 'Сохранение...' : 'Сохранить настройки'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#92929F]">Название сайта</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={siteSettings.siteName || ''}
                      onChange={(e) =>
                        setSiteSettings({ ...siteSettings, siteName: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-sm text-white disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#92929F]">Слоган</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={siteSettings.siteTagline || ''}
                      onChange={(e) =>
                        setSiteSettings({ ...siteSettings, siteTagline: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-sm text-white disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#92929F]">
                    Объявление / системный баннер (необязательно)
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={siteSettings.announcementBanner || ''}
                    onChange={(e) =>
                      setSiteSettings({ ...siteSettings, announcementBanner: e.target.value })
                    }
                    placeholder="Например: Технические работы запланированы на 03:00 МСК..."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-sm text-white placeholder-[#92929F] disabled:opacity-60"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {[
                    {
                      key: 'registrationEnabled',
                      title: 'Регистрация новых пользователей',
                      desc: 'Разрешить создание новых аккаунтов на /auth',
                    },
                    {
                      key: 'maintenanceMode',
                      title: 'Режим технического обслуживания',
                      desc: 'Показать уведомление о работах для обычных пользователей',
                    },
                    {
                      key: 'defaultAgeRestriction18',
                      title: 'Фильтр 18+ по умолчанию',
                      desc: 'Размывать взрослый контент для новых гостей',
                    },
                    {
                      key: 'newYearForceEnabled',
                      title: 'Праздничная новогодняя тема',
                      desc: 'Включить глобальную зимнюю атмосферу на сайте',
                    },
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#181821] border border-[#292936] cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{opt.title}</p>
                        <p className="text-xs text-[#92929F] mt-0.5">{opt.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        disabled={!isAdmin}
                        checked={Boolean(siteSettings[opt.key])}
                        onChange={(e) =>
                          setSiteSettings({ ...siteSettings, [opt.key]: e.target.checked })
                        }
                        className="w-4 h-4 accent-[#8065FF]"
                      />
                    </label>
                  ))}
                </div>
              </form>
            )}
          </main>
        </div>
      </div>

      {/* Create / Edit Source Modal */}
      {sourceModal && (
        <div
          onClick={() => setSourceModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
        >
          <form
            onSubmit={handleSaveSource}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#111119] border border-[#292936] rounded-3xl p-6 text-white shadow-2xl space-y-4 animate-scaleIn"
          >
            <div className="flex items-center justify-between border-b border-[#292936] pb-3">
              <h3 className="text-base font-bold">
                {sourceModal.mode === 'create'
                  ? 'Добавить новый источник'
                  : `Настройки источника: ${sourceModal.item?.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setSourceModal(null)}
                className="p-1 text-[#92929F] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[#92929F]">Название</label>
                <input
                  type="text"
                  required
                  value={sourceForm.name}
                  onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                  placeholder="Напр. Okko API"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#92929F]">Уникальный код</label>
                <input
                  type="text"
                  required
                  disabled={sourceModal.mode === 'edit'}
                  value={sourceForm.code}
                  onChange={(e) => setSourceForm({ ...sourceForm, code: e.target.value })}
                  placeholder="okko-api"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[#92929F]">Базовый URL</label>
                <input
                  type="url"
                  required
                  value={sourceForm.baseUrl}
                  onChange={(e) => setSourceForm({ ...sourceForm, baseUrl: e.target.value })}
                  placeholder="https://api.example.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#92929F]">Путь проверки (Health Path)</label>
                <input
                  type="text"
                  value={sourceForm.healthPath}
                  onChange={(e) => setSourceForm({ ...sourceForm, healthPath: e.target.value })}
                  placeholder="/health"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[#92929F]">Тип</label>
                <select
                  value={sourceForm.type}
                  onChange={(e) => setSourceForm({ ...sourceForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white"
                >
                  <option value="METADATA">METADATA</option>
                  <option value="STREAMING">STREAMING</option>
                  <option value="SCHEDULE">SCHEDULE</option>
                  <option value="ANIME">ANIME</option>
                  <option value="TRAILERS">TRAILERS</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#92929F]">Приоритет (1–100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={sourceForm.priority}
                  onChange={(e) =>
                    setSourceForm({ ...sourceForm, priority: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#92929F]">Таймаут (мс)</label>
                <input
                  type="number"
                  min={500}
                  max={30000}
                  value={sourceForm.timeoutMs}
                  onChange={(e) =>
                    setSourceForm({ ...sourceForm, timeoutMs: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSourceModal(null)}
                className="px-4 py-2 rounded-xl bg-[#181821] text-xs font-bold text-[#92929F] hover:text-white"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl brand-btn text-white text-xs font-bold"
              >
                Сохранить
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

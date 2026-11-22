import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LocalStoreService } from '../../common/storage/local-store.service';
import {
  AdminRoleDto,
  CreateMediaSourceDto,
  UpdateAdminUserDto,
  UpdateMediaSourceDto,
  UpdateSiteSettingsDto,
} from './dto/admin.dto';

const DEFAULT_SOURCES = [
  {
    name: 'TMDB Metadata API',
    code: 'tmdb',
    type: 'METADATA',
    baseUrl: 'https://api.themoviedb.org/3',
    healthPath: '/configuration',
    isEnabled: true,
    priority: 1,
    timeoutMs: 6000,
    config: { language: 'ru-RU', includeAdult: false },
  },
  {
    name: 'TVMaze Schedule API',
    code: 'tvmaze',
    type: 'SCHEDULE',
    baseUrl: 'https://api.tvmaze.com',
    healthPath: '/schedule?country=US',
    isEnabled: true,
    priority: 2,
    timeoutMs: 6000,
    config: { country: 'US' },
  },
  {
    name: 'Jikan (MyAnimeList)',
    code: 'jikan',
    type: 'ANIME',
    baseUrl: 'https://api.jikan.moe/v4',
    healthPath: '/top/anime?limit=1',
    isEnabled: true,
    priority: 3,
    timeoutMs: 7000,
    config: { sfw: true },
  },
  {
    name: 'OMDb Ratings API',
    code: 'omdb',
    type: 'METADATA',
    baseUrl: 'https://www.omdbapi.com',
    healthPath: '/',
    isEnabled: true,
    priority: 4,
    timeoutMs: 6000,
    config: { ratings: ['IMDb', 'Rotten Tomatoes', 'Metacritic'] },
  },
  {
    name: 'Кинопоиск (Официальный)',
    code: 'kinopoisk-official',
    type: 'STREAMING',
    baseUrl: 'https://www.kinopoisk.ru',
    healthPath: '/',
    isEnabled: true,
    priority: 5,
    timeoutMs: 6000,
    config: { region: 'RU' },
  },
  {
    name: 'Иви (Официальный)',
    code: 'ivi-official',
    type: 'STREAMING',
    baseUrl: 'https://www.ivi.ru',
    healthPath: '/',
    isEnabled: true,
    priority: 6,
    timeoutMs: 6000,
    config: { region: 'RU' },
  },
];

const DEFAULT_SITE_SETTINGS = {
  siteName: '67movies',
  siteTagline: 'Премиальный онлайн-кинотеатр',
  maintenanceMode: false,
  registrationEnabled: true,
  announcementBanner: '',
  defaultAgeRestriction18: true,
  defaultTheme: 'dark',
  newYearForceEnabled: false,
};

@Injectable()
export class AdminService {
  private readonly memSources = new Map<string, any>();
  private readonly memErrors = new Map<string, any>();
  private memSiteSettings: Record<string, any> = { ...DEFAULT_SITE_SETTINGS };

  constructor(
    private readonly prisma: PrismaService,
    private readonly localStore: LocalStoreService,
  ) {
    for (const [k, v] of Object.entries(this.localStore.data.adminSources || {})) {
      this.memSources.set(k, v);
    }
    for (const [k, v] of Object.entries(this.localStore.data.sourceErrors || {})) {
      this.memErrors.set(k, v);
    }
    if (this.localStore.data.siteSettings && Object.keys(this.localStore.data.siteSettings).length > 0) {
      this.memSiteSettings = { ...DEFAULT_SITE_SETTINGS, ...this.localStore.data.siteSettings };
    }
  }

  private get db() {
    return this.prisma.client;
  }

  private persistLocal() {
    this.localStore.data.adminSources = Object.fromEntries(this.memSources.entries());
    this.localStore.data.sourceErrors = Object.fromEntries(this.memErrors.entries());
    this.localStore.data.siteSettings = this.memSiteSettings;
    this.localStore.save();
  }

  private async ensureDefaultSourcesSeeded() {
    const sourceModel = (this.db as any)?.mediaSource;
    if (sourceModel) {
      const count = await sourceModel.count();
      if (count === 0) {
        for (const s of DEFAULT_SOURCES) {
          await sourceModel
            .upsert({
              where: { code: s.code },
              update: {},
              create: s,
            })
            .catch(() => {});
        }
      }
      return;
    }

    if (this.memSources.size === 0) {
      for (const s of DEFAULT_SOURCES) {
        const id = crypto.randomUUID();
        this.memSources.set(id, {
          id,
          ...s,
          lastStatus: 'UNKNOWN',
          lastLatencyMs: null,
          lastCheckedAt: null,
          errorCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      this.persistLocal();
    }
  }

  // =========================================================================
  // 1. Access Info & Safe One-Time First Admin Bootstrap
  // =========================================================================

  async getAccessStatus(userId: string) {
    let userRole = 'USER';
    let hasAnyAdmin = false;

    if (this.db) {
      const [me, adminCount] = await Promise.all([
        this.db.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } }),
        this.db.user.count({ where: { role: 'ADMIN' } }),
      ]);
      userRole = me?.role || 'USER';
      hasAnyAdmin = adminCount > 0;
    } else {
      const me = this.localStore.data.users[userId];
      userRole = me?.role || 'USER';
      hasAnyAdmin = Object.values(this.localStore.data.users).some((u: any) => u.role === 'ADMIN');
    }

    return {
      role: userRole,
      canAccessAdmin: userRole === 'ADMIN' || userRole === 'MODERATOR',
      canBootstrapAdmin: !hasAnyAdmin,
    };
  }

  /**
   * Secure one-time bootstrap: promotes the caller to ADMIN ONLY if 0 ADMINs exist in DB.
   * Once at least one ADMIN exists, this endpoint permanently returns 403 Forbidden.
   */
  async bootstrapFirstAdmin(userId: string) {
    if (this.db) {
      const adminCount = await this.db.user.count({ where: { role: 'ADMIN' } });
      if (adminCount > 0) {
        throw new ForbiddenException('Администратор уже назначен в системе');
      }
      const updated = await this.db.user.update({
        where: { id: userId },
        data: { role: 'ADMIN' },
        select: { id: true, email: true, name: true, role: true },
      });
      return { success: true, user: updated };
    }

    const adminExists = Object.values(this.localStore.data.users).some(
      (u: any) => u.role === 'ADMIN',
    );
    if (adminExists) {
      throw new ForbiddenException('Администратор уже назначен в системе');
    }
    const u = this.localStore.data.users[userId];
    if (!u) throw new NotFoundException('Пользователь не найден');
    u.role = 'ADMIN';
    this.localStore.save();
    return { success: true, user: { id: u.id, email: u.email, name: u.name, role: u.role } };
  }

  // =========================================================================
  // 2. Dashboard Analytics & Watch Statistics
  // =========================================================================

  async getDashboardStats(days = 14) {
    await this.ensureDefaultSourcesSeeded();
    const safeDays = Math.min(30, Math.max(7, Number(days) || 14));
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - (safeDays - 1));
    sinceDate.setHours(0, 0, 0, 0);

    let totalUsers = 0;
    let activeUsers = 0;
    let roleCounts = { ADMIN: 0, MODERATOR: 0, USER: 0 };
    let totalViews = 0;
    let totalRatings = 0;
    let historyRows: Array<{ tmdbId: number; title: string; mediaType: string; watchedAt: Date }> = [];

    if (this.db) {
      const [users, viewsCount, ratingsCount, recentHistory] = await Promise.all([
        this.db.user.findMany({ select: { role: true, isActive: true } }),
        this.db.watchHistory.count(),
        this.db.movieRating.count(),
        this.db.watchHistory.findMany({
          where: { watchedAt: { gte: sinceDate } },
          select: { tmdbId: true, title: true, mediaType: true, watchedAt: true },
          orderBy: { watchedAt: 'desc' },
          take: 2000,
        }),
      ]);

      totalUsers = users.length;
      activeUsers = users.filter((u) => u.isActive).length;
      for (const u of users) {
        const r = String(u.role) as keyof typeof roleCounts;
        if (roleCounts[r] !== undefined) roleCounts[r]++;
      }
      totalViews = viewsCount;
      totalRatings = ratingsCount;
      historyRows = recentHistory;
    } else {
      const users = Object.values(this.localStore.data.users || {});
      totalUsers = users.length;
      activeUsers = users.filter((u: any) => u.isActive !== false).length;
      for (const u of users as any[]) {
        const r = (u.role || 'USER') as keyof typeof roleCounts;
        if (roleCounts[r] !== undefined) roleCounts[r]++;
      }
      const hist = Object.values(this.localStore.data.history || {}) as any[];
      totalViews = hist.length;
      totalRatings = Object.keys(this.localStore.data.ratings || {}).length;
      historyRows = hist
        .map((h) => ({
          tmdbId: h.tmdbId,
          title: h.title || 'Без названия',
          mediaType: h.mediaType || 'MOVIE',
          watchedAt: new Date(h.watchedAt || Date.now()),
        }))
        .filter((h) => h.watchedAt >= sinceDate);
    }

    // Build daily series for chart
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(sinceDate);
      d.setDate(sinceDate.getDate() + i);
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }

    const titleCounter = new Map<
      string,
      { tmdbId: number; title: string; mediaType: string; views: number }
    >();

    for (const row of historyRows) {
      const dayKey = new Date(row.watchedAt).toISOString().slice(0, 10);
      if (dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);
      }
      const key = `${row.mediaType}-${row.tmdbId}`;
      const existing = titleCounter.get(key);
      if (existing) {
        existing.views++;
      } else {
        titleCounter.set(key, {
          tmdbId: row.tmdbId,
          title: row.title,
          mediaType: row.mediaType,
          views: 1,
        });
      }
    }

    const dailyViews = [...dailyMap.entries()].map(([date, views]) => ({ date, views }));
    const topTitles = [...titleCounter.values()]
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    const sources = await this.listSources();
    const errors = await this.listSourceErrors();

    return {
      kpi: {
        totalUsers,
        activeUsers,
        bannedUsers: totalUsers - activeUsers,
        totalViews,
        totalRatings,
        totalSources: sources.length,
        enabledSources: sources.filter((s: any) => s.isEnabled).length,
        onlineSources: sources.filter((s: any) => s.lastStatus === 'ONLINE').length,
        recentErrors: errors.length,
      },
      roleCounts,
      dailyViews,
      topTitles,
    };
  }

  // =========================================================================
  // 3. Users & Accounts Management (Strict Server-Side RBAC)
  // =========================================================================

  async listUsers(params: { search?: string; role?: string; status?: string }) {
    const search = (params.search || '').trim().toLowerCase();
    const roleFilter = (params.role || '').trim().toUpperCase();
    const statusFilter = (params.status || '').trim().toLowerCase();

    if (this.db) {
      const where: any = {};
      if (roleFilter && ['ADMIN', 'MODERATOR', 'USER'].includes(roleFilter)) {
        where.role = roleFilter;
      }
      if (statusFilter === 'active') where.isActive = true;
      if (statusFilter === 'banned') where.isActive = false;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const users = await this.db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              sessions: true,
              ratings: true,
              collections: true,
            },
          },
        },
      });

      return users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        sessionsCount: u._count.sessions,
        ratingsCount: u._count.ratings,
        collectionsCount: u._count.collections,
      }));
    }

    let list = Object.values(this.localStore.data.users || {}) as any[];
    if (roleFilter && ['ADMIN', 'MODERATOR', 'USER'].includes(roleFilter)) {
      list = list.filter((u) => (u.role || 'USER') === roleFilter);
    }
    if (statusFilter === 'active') list = list.filter((u) => u.isActive !== false);
    if (statusFilter === 'banned') list = list.filter((u) => u.isActive === false);
    if (search) {
      list = list.filter(
        (u) =>
          String(u.name || '').toLowerCase().includes(search) ||
          String(u.email || '').toLowerCase().includes(search),
      );
    }

    return list.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role || 'USER',
      isActive: u.isActive !== false,
      createdAt: u.createdAt,
      sessionsCount: 0,
      ratingsCount: 0,
      collectionsCount: 0,
    }));
  }

  async updateUser(
    actor: { userId: string; role: string },
    targetUserId: string,
    dto: UpdateAdminUserDto,
  ) {
    // Load target user
    const target = this.db
      ? await this.db.user.findUnique({ where: { id: targetUserId } })
      : this.localStore.data.users[targetUserId];

    if (!target) {
      throw new NotFoundException('Пользователь не найден');
    }

    const isActorAdmin = actor.role === 'ADMIN';

    // Moderators cannot change roles and cannot modify ADMIN or MODERATOR accounts
    if (!isActorAdmin) {
      if (dto.role !== undefined) {
        throw new ForbiddenException('Только администратор может изменять роли пользователей');
      }
      if (target.role === 'ADMIN' || target.role === 'MODERATOR') {
        throw new ForbiddenException('Модератор не может управлять аккаунтами администраторов и модераторов');
      }
    }

    // Prevent self-ban or self-demotion
    if (actor.userId === targetUserId) {
      if (dto.isActive === false) {
        throw new BadRequestException('Нельзя заблокировать собственную учетную запись');
      }
      if (dto.role && dto.role !== AdminRoleDto.ADMIN && target.role === 'ADMIN') {
        throw new BadRequestException('Нельзя снять права администратора с самого себя');
      }
    }

    if (this.db) {
      const updated = await this.db.user.update({
        where: { id: targetUserId },
        data: {
          ...(dto.role !== undefined ? { role: dto.role as any } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        },
        select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      });

      // If banned, immediately revoke all active sessions
      if (dto.isActive === false) {
        await this.db.session.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return updated;
    }

    if (dto.role !== undefined) target.role = dto.role;
    if (dto.isActive !== undefined) target.isActive = dto.isActive;
    if (dto.name !== undefined) target.name = dto.name.trim();
    this.localStore.save();
    return {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      isActive: target.isActive,
    };
  }

  async revokeAllUserSessions(targetUserId: string) {
    if (this.db) {
      const result = await this.db.session.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { success: true, revokedCount: result.count };
    }
    return { success: true, revokedCount: 0 };
  }

  async deleteUser(actor: { userId: string; role: string }, targetUserId: string) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Только администратор может удалять учетные записи');
    }
    if (actor.userId === targetUserId) {
      throw new BadRequestException('Нельзя удалить собственную учетную запись');
    }

    if (this.db) {
      const existing = await this.db.user.findUnique({ where: { id: targetUserId } });
      if (!existing) throw new NotFoundException('Пользователь не найден');
      await this.db.user.delete({ where: { id: targetUserId } });
      return { success: true };
    }

    if (!this.localStore.data.users[targetUserId]) {
      throw new NotFoundException('Пользователь не найден');
    }
    delete this.localStore.data.users[targetUserId];
    this.localStore.save();
    return { success: true };
  }

  // =========================================================================
  // 4. Media Sources Management, Health Checks & Error Logs
  // =========================================================================

  async listSources() {
    await this.ensureDefaultSourcesSeeded();
    const sourceModel = (this.db as any)?.mediaSource;
    if (sourceModel) {
      return sourceModel.findMany({
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      });
    }
    return [...this.memSources.values()].sort((a, b) => (a.priority || 10) - (b.priority || 10));
  }

  async createSource(dto: CreateMediaSourceDto) {
    await this.ensureDefaultSourcesSeeded();
    const code = dto.code.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const sourceModel = (this.db as any)?.mediaSource;

    if (sourceModel) {
      const exists = await sourceModel.findUnique({ where: { code } });
      if (exists) throw new ConflictException(`Источник с кодом "${code}" уже существует`);

      return sourceModel.create({
        data: {
          name: dto.name.trim(),
          code,
          type: dto.type || 'METADATA',
          baseUrl: dto.baseUrl.trim(),
          healthPath: (dto.healthPath || '').trim(),
          isEnabled: dto.isEnabled !== undefined ? dto.isEnabled : true,
          priority: dto.priority ?? 10,
          timeoutMs: dto.timeoutMs ?? 6000,
          config: dto.config || {},
        },
      });
    }

    if ([...this.memSources.values()].some((s) => s.code === code)) {
      throw new ConflictException(`Источник с кодом "${code}" уже существует`);
    }
    const rec = {
      id: crypto.randomUUID(),
      name: dto.name.trim(),
      code,
      type: dto.type || 'METADATA',
      baseUrl: dto.baseUrl.trim(),
      healthPath: (dto.healthPath || '').trim(),
      isEnabled: dto.isEnabled !== undefined ? dto.isEnabled : true,
      priority: dto.priority ?? 10,
      timeoutMs: dto.timeoutMs ?? 6000,
      config: dto.config || {},
      lastStatus: 'UNKNOWN',
      lastLatencyMs: null,
      lastCheckedAt: null,
      errorCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.memSources.set(rec.id, rec);
    this.persistLocal();
    return rec;
  }

  async updateSource(id: string, dto: UpdateMediaSourceDto) {
    const sourceModel = (this.db as any)?.mediaSource;
    if (sourceModel) {
      const existing = await sourceModel.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Источник не найден');

      return sourceModel.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.baseUrl !== undefined ? { baseUrl: dto.baseUrl.trim() } : {}),
          ...(dto.healthPath !== undefined ? { healthPath: dto.healthPath.trim() } : {}),
          ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.timeoutMs !== undefined ? { timeoutMs: dto.timeoutMs } : {}),
          ...(dto.config !== undefined ? { config: dto.config } : {}),
        },
      });
    }

    const existing = this.memSources.get(id);
    if (!existing) throw new NotFoundException('Источник не найден');
    Object.assign(existing, dto, { updatedAt: new Date().toISOString() });
    this.persistLocal();
    return existing;
  }

  async deleteSource(id: string) {
    const sourceModel = (this.db as any)?.mediaSource;
    if (sourceModel) {
      const existing = await sourceModel.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Источник не найден');
      await sourceModel.delete({ where: { id } });
      return { success: true };
    }
    if (!this.memSources.has(id)) throw new NotFoundException('Источник не найден');
    this.memSources.delete(id);
    this.persistLocal();
    return { success: true };
  }

  private async logSourceError(
    sourceId: string,
    endpoint: string,
    message: string,
    statusCode?: number,
  ) {
    const errModel = (this.db as any)?.sourceErrorLog;
    if (errModel) {
      await errModel.create({
        data: {
          sourceId,
          endpoint,
          message,
          statusCode: statusCode ?? null,
        },
      });
      return;
    }

    const id = crypto.randomUUID();
    this.memErrors.set(id, {
      id,
      sourceId,
      endpoint,
      message,
      statusCode: statusCode ?? null,
      createdAt: new Date().toISOString(),
    });
    this.persistLocal();
  }

  async checkSourceHealth(id: string) {
    const sourceModel = (this.db as any)?.mediaSource;
    const source = sourceModel
      ? await sourceModel.findUnique({ where: { id } })
      : this.memSources.get(id);

    if (!source) throw new NotFoundException('Источник не найден');

    const base = String(source.baseUrl || '').replace(/\/+$/, '');
    const path = String(source.healthPath || '');
    const targetUrl = path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : base;
    const timeoutMs = Number(source.timeoutMs) || 6000;

    const start = Date.now();
    let status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' = 'OFFLINE';
    let latencyMs = 0;
    let errorMsg: string | null = null;
    let statusCode: number | undefined;

    try {
      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'User-Agent': '67movies-HealthCheck/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      latencyMs = Date.now() - start;
      statusCode = res.status;

      // 2xx / 3xx / 401 (expected when API requires key on health endpoint) => server is reachable
      if (res.status < 400 || res.status === 401) {
        status = latencyMs > 2500 ? 'DEGRADED' : 'ONLINE';
      } else {
        status = 'OFFLINE';
        errorMsg = `HTTP ${res.status} ${res.statusText}`;
      }
    } catch (err: any) {
      latencyMs = Date.now() - start;
      status = 'OFFLINE';
      errorMsg = err?.name === 'TimeoutError'
        ? `Таймаут ответа (> ${timeoutMs} мс)`
        : err?.message || 'Ошибка сетевого подключения';
    }

    if (errorMsg) {
      await this.logSourceError(source.id, targetUrl, errorMsg, statusCode);
    }

    const checkedAt = new Date();
    if (sourceModel) {
      return sourceModel.update({
        where: { id: source.id },
        data: {
          lastStatus: status,
          lastLatencyMs: latencyMs,
          lastCheckedAt: checkedAt,
          errorCount: errorMsg ? { increment: 1 } : source.errorCount,
        },
      });
    }

    source.lastStatus = status;
    source.lastLatencyMs = latencyMs;
    source.lastCheckedAt = checkedAt.toISOString();
    if (errorMsg) source.errorCount = (source.errorCount || 0) + 1;
    this.persistLocal();
    return source;
  }

  async checkAllSourcesHealth() {
    const sources = await this.listSources();
    const results = await Promise.all(
      sources.map((s: any) => this.checkSourceHealth(s.id).catch(() => s)),
    );
    return results;
  }

  async listSourceErrors(sourceId?: string) {
    const errModel = (this.db as any)?.sourceErrorLog;
    if (errModel) {
      const rows = await errModel.findMany({
        where: sourceId ? { sourceId } : undefined,
        include: {
          source: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return rows;
    }

    let rows = [...this.memErrors.values()];
    if (sourceId) rows = rows.filter((r) => r.sourceId === sourceId);
    return rows
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100)
      .map((r) => {
        const src = this.memSources.get(r.sourceId);
        return {
          ...r,
          source: src ? { id: src.id, name: src.name, code: src.code } : null,
        };
      });
  }

  async clearSourceErrors(sourceId?: string) {
    const errModel = (this.db as any)?.sourceErrorLog;
    if (errModel) {
      await errModel.deleteMany({
        where: sourceId ? { sourceId } : undefined,
      });
      return { success: true };
    }

    if (sourceId) {
      for (const [k, v] of this.memErrors.entries()) {
        if (v.sourceId === sourceId) this.memErrors.delete(k);
      }
    } else {
      this.memErrors.clear();
    }
    this.persistLocal();
    return { success: true };
  }

  // =========================================================================
  // 5. Global Site Settings
  // =========================================================================

  async getSiteSettings() {
    const settingModel = (this.db as any)?.siteSetting;
    if (settingModel) {
      const rows = await settingModel.findMany();
      const merged: Record<string, any> = { ...DEFAULT_SITE_SETTINGS };
      for (const r of rows) {
        merged[r.key] = r.value;
      }
      return merged;
    }
    return { ...DEFAULT_SITE_SETTINGS, ...this.memSiteSettings };
  }

  async updateSiteSettings(actorUserId: string, dto: UpdateSiteSettingsDto) {
    const settingModel = (this.db as any)?.siteSetting;
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);

    if (settingModel) {
      for (const [key, value] of entries) {
        await settingModel.upsert({
          where: { key },
          update: { value: value as any, updatedBy: actorUserId },
          create: { key, value: value as any, updatedBy: actorUserId },
        });
      }
      return this.getSiteSettings();
    }

    for (const [key, value] of entries) {
      this.memSiteSettings[key] = value;
    }
    this.persistLocal();
    return this.getSiteSettings();
  }
}

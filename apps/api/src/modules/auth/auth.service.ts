import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LocalStoreService } from '../../common/storage/local-store.service';
import { MailService } from './mail.service';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from './password.util';
import { validateNickname } from '../../common/security/security.util';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface SessionMeta {
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  rememberDevice?: boolean;
}

interface InMemoryUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: Date;
}

interface InMemorySession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  lastUsedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtlSeconds = 30 * 24 * 60 * 60; // 30 days
  private readonly refreshTtlDays = 30;

  // In-memory fallback stores when PostgreSQL is offline
  private readonly memUsers = new Map<string, InMemoryUser>();
  private readonly memSessions = new Map<string, InMemorySession>();
  // Password reset codes stored ONLY as SHA-256 hashes with 15-minute expiration
  private readonly resetCodes = new Map<
    string,
    { codeHash: string; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly localStore: LocalStoreService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Hydrate in-memory fallback maps from persistent disk store
    for (const [id, u] of Object.entries(this.localStore.data.users)) {
      this.memUsers.set(id, { ...u, createdAt: new Date(u.createdAt) });
    }
    for (const [id, s] of Object.entries(this.localStore.data.sessions)) {
      this.memSessions.set(id, {
        ...s,
        expiresAt: new Date(s.expiresAt),
        createdAt: new Date(s.createdAt),
        lastUsedAt: new Date(s.lastUsedAt),
        revokedAt: s.revokedAt ? new Date(s.revokedAt) : null,
      });
    }
  }

  private persistLocalAuth() {
    this.localStore.data.users = Object.fromEntries(this.memUsers.entries());
    this.localStore.data.sessions = Object.fromEntries(this.memSessions.entries());
    this.localStore.save();
  }

  private get db() {
    return this.prisma.client;
  }

  private get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET', '67movies-dev-jwt-secret-change-in-prod');
  }

  private sanitizeUser(user: any) {
    if (!user) return null;
    const { passwordHash: _removed, ...safe } = user;
    return safe;
  }

  async register(dto: RegisterDto, meta: SessionMeta) {
    const email = dto.email.trim().toLowerCase();
    const cleanName = dto.name.trim();
    const nickError = validateNickname(cleanName);
    if (nickError) {
      throw new BadRequestException(nickError);
    }

    const passwordHash = await hashPassword(dto.password);

    if (this.db) {
      const existing = await this.db.user.findUnique({ where: { email } });
      if (existing) {
        throw new ConflictException('Пользователь с таким email уже существует');
      }

      const existingNick = await this.db.user.findFirst({
        where: { name: { equals: cleanName, mode: 'insensitive' } },
      });
      if (existingNick) {
        throw new ConflictException('Этот никнейм уже занят другим пользователем');
      }

      const user = await this.db.user.create({
        data: {
          email,
          passwordHash,
          name: cleanName,
          profiles: {
            create: {
              name: cleanName,
              language: 'ru',
              isKidsMode: false,
            },
          },
          settings: {
            create: {
              theme: 'dark',
              accentColor: '#8065FF',
              language: 'ru',
              autoplayNext: true,
              defaultQuality: '1080p',
            },
          },
        },
        include: { profiles: true, settings: true },
      });

      const tokens = await this.createSessionAndTokens(user, {
        ...meta,
        deviceName: dto.deviceName || meta.deviceName,
        rememberDevice: dto.rememberDevice ?? true,
      });

      return { user: this.sanitizeUser(user), ...tokens };
    }

    // In-memory fallback
    for (const u of this.memUsers.values()) {
      if (u.email === email) {
        throw new ConflictException('Пользователь с таким email уже существует');
      }
      if (u.name.toLowerCase() === cleanName.toLowerCase()) {
        throw new ConflictException('Этот никнейм уже занят другим пользователем');
      }
    }

    const user: InMemoryUser = {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      name: cleanName,
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
    };
    this.memUsers.set(user.id, user);
    this.persistLocalAuth();

    const tokens = await this.createSessionAndTokens(user, {
      ...meta,
      deviceName: dto.deviceName || meta.deviceName,
      rememberDevice: dto.rememberDevice ?? true,
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto, meta: SessionMeta) {
    const rawIdentifier = (dto.email || dto.login || '').trim();
    if (!rawIdentifier) {
      throw new BadRequestException('Введите email или никнейм');
    }
    const lowerIdentifier = rawIdentifier.toLowerCase();
    let user: any = null;

    if (this.db) {
      if (rawIdentifier.includes('@')) {
        user = await this.db.user.findUnique({
          where: { email: lowerIdentifier },
          include: { profiles: true, settings: true },
        });
      }
      if (!user) {
        user = await this.db.user.findFirst({
          where: {
            OR: [
              { email: lowerIdentifier },
              { name: { equals: rawIdentifier, mode: 'insensitive' } },
              { profiles: { some: { name: { equals: rawIdentifier, mode: 'insensitive' } } } },
            ],
          },
          include: { profiles: true, settings: true },
        });
      }
    } else {
      for (const u of this.memUsers.values()) {
        if (u.email === lowerIdentifier || u.name.toLowerCase() === lowerIdentifier) {
          user = u;
          break;
        }
      }
    }

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Неверный email/никнейм или пароль');
    }

    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Неверный email/никнейм или пароль');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }

    const tokens = await this.createSessionAndTokens(user, {
      ...meta,
      deviceName: dto.deviceName || meta.deviceName,
      rememberDevice: dto.rememberDevice ?? true,
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string, meta: SessionMeta) {
    const tokenHash = hashToken(refreshToken);

    if (this.db) {
      const session = await this.db.session.findUnique({
        where: { refreshTokenHash: tokenHash },
        include: { user: { include: { profiles: true, settings: true } } },
      });

      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Сессия недействительна или истекла');
      }

      // Rotate refresh token
      const newRefreshToken = generateOpaqueToken();
      const newHash = hashToken(newRefreshToken);
      const newExpiresAt = new Date(Date.now() + this.refreshTtlDays * 86400 * 1000);

      await this.db.session.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: newHash,
          expiresAt: newExpiresAt,
          lastUsedAt: new Date(),
          userAgent: meta.userAgent ?? session.userAgent,
          ipAddress: meta.ipAddress ?? session.ipAddress,
        },
      });

      const accessToken = await this.signAccessToken(session.user, session.id);
      return {
        user: this.sanitizeUser(session.user),
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.accessTtlSeconds,
      };
    }

    // In-memory fallback
    let found: InMemorySession | undefined;
    for (const s of this.memSessions.values()) {
      if (s.refreshTokenHash === tokenHash) {
        found = s;
        break;
      }
    }

    if (!found || found.revokedAt || found.expiresAt < new Date()) {
      throw new UnauthorizedException('Сессия недействительна или истекла');
    }

    const user = this.memUsers.get(found.userId);
    if (!user) throw new UnauthorizedException('Пользователь не найден');

    const newRefreshToken = generateOpaqueToken();
    found.refreshTokenHash = hashToken(newRefreshToken);
    found.lastUsedAt = new Date();
    found.expiresAt = new Date(Date.now() + this.refreshTtlDays * 86400 * 1000);
    this.persistLocalAuth();

    const accessToken = await this.signAccessToken(user, found.id);
    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.accessTtlSeconds,
    };
  }

  async logout(sessionId: string, refreshToken?: string) {
    if (this.db) {
      if (refreshToken) {
        await this.db.session.updateMany({
          where: { refreshTokenHash: hashToken(refreshToken) },
          data: { revokedAt: new Date() },
        });
      }
      if (sessionId) {
        await this.db.session.updateMany({
          where: { id: sessionId },
          data: { revokedAt: new Date() },
        });
      }
      return { success: true };
    }

    const s = this.memSessions.get(sessionId);
    if (s) s.revokedAt = new Date();
    return { success: true };
  }

  async logoutAll(userId: string) {
    if (this.db) {
      await this.db.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { success: true };
    }

    for (const s of this.memSessions.values()) {
      if (s.userId === userId && !s.revokedAt) s.revokedAt = new Date();
    }
    return { success: true };
  }

  async listSessions(userId: string, currentSessionId: string) {
    if (this.db) {
      const sessions = await this.db.session.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastUsedAt: 'desc' },
        select: {
          id: true,
          deviceName: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      });
      return sessions.map((s: any) => ({ ...s, isCurrent: s.id === currentSessionId }));
    }

    return [...this.memSessions.values()]
      .filter((s) => s.userId === userId && !s.revokedAt && s.expiresAt > new Date())
      .map(({ refreshTokenHash: _h, ...safe }) => ({
        ...safe,
        isCurrent: safe.id === currentSessionId,
      }));
  }

  async revokeSession(userId: string, sessionId: string) {
    if (this.db) {
      const res = await this.db.session.updateMany({
        where: { id: sessionId, userId },
        data: { revokedAt: new Date() },
      });
      if (res.count === 0) throw new NotFoundException('Сессия не найдена');
      return { success: true };
    }

    const s = this.memSessions.get(sessionId);
    if (!s || s.userId !== userId) throw new NotFoundException('Сессия не найдена');
    s.revokedAt = new Date();
    return { success: true };
  }

  async getMe(userId: string) {
    if (this.db) {
      const user = await this.db.user.findUnique({
        where: { id: userId },
        include: { profiles: true, settings: true },
      });
      if (!user) throw new NotFoundException('Пользователь не найден');
      return this.sanitizeUser(user);
    }

    const user = this.memUsers.get(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');
    return this.sanitizeUser(user);
  }

  async findPublicUserById(userId: string) {
    if (this.db) {
      const user = await this.db.user.findUnique({
        where: { id: userId },
        include: { profiles: { take: 1, orderBy: { createdAt: 'asc' } } },
      });
      if (!user) return null;
      const p = user.profiles?.[0];
      return {
        id: user.id,
        name: p?.name || user.name,
        avatarUrl: p?.avatarUrl ?? null,
        bannerUrl: p?.bannerUrl ?? null,
        createdAt: user.createdAt,
      };
    }

    const user = this.memUsers.get(userId);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      avatarUrl: null,
      bannerUrl: null,
      createdAt: user.createdAt,
    };
  }

  async findUserByEmail(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    if (this.db) {
      const user = await this.db.user.findUnique({ where: { email } });
      return user ? { id: user.id, name: user.name, email: user.email } : null;
    }
    for (const u of this.memUsers.values()) {
      if (u.email === email) return { id: u.id, name: u.name, email: u.email };
    }
    return null;
  }

  async searchPublicUsers(query: string, excludeUserId: string) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    if (this.db) {
      const users = await this.db.user.findMany({
        where: {
          id: { not: excludeUserId },
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { profiles: { take: 1, orderBy: { createdAt: 'asc' } } },
        take: 15,
      });
      return users.map((u: any) => ({
        id: u.id,
        name: u.profiles?.[0]?.name || u.name,
        avatarUrl: u.profiles?.[0]?.avatarUrl ?? null,
      }));
    }

    return [...this.memUsers.values()]
      .filter(
        (u) =>
          u.id !== excludeUserId &&
          (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
      )
      .slice(0, 15)
      .map((u) => ({ id: u.id, name: u.name, avatarUrl: null }));
  }

  /**
   * Generates a 6-digit password reset code (stored hashed with 15-min TTL).
   */
  async forgotPassword(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    let userExists = false;

    if (this.db) {
      const u = await this.db.user.findUnique({ where: { email } });
      userExists = Boolean(u);
    } else {
      for (const u of this.memUsers.values()) {
        if (u.email === email) {
          userExists = true;
          break;
        }
      }
    }

    if (!userExists) {
      throw new NotFoundException('Аккаунт с таким email не найден');
    }

    const code = String(crypto.randomInt(100000, 999999));
    this.resetCodes.set(email, {
      codeHash: hashToken(code),
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const delivered = await this.mailService.sendPasswordResetCode(email, code);

    if (delivered) {
      return {
        success: true,
        emailSent: true,
        message: 'Код восстановления отправлен на вашу почту (проверьте «Входящие» и «Спам»)',
      };
    }

    this.logger.log(`SMTP/Resend not configured. Local dev reset code for ${email}: ${code}`);
    return {
      success: true,
      emailSent: false,
      message:
        'Почтовый сервер ещё не настроен в .env — для локального теста используйте код ниже',
      devResetCode: process.env.NODE_ENV === 'production' ? undefined : code,
    };
  }

  /**
   * Verifies reset code, hashes new password with scrypt, and revokes all active sessions.
   */
  async resetPassword(rawEmail: string, code: string, newPassword: string) {
    const email = rawEmail.trim().toLowerCase();
    const record = this.resetCodes.get(email);

    if (!record || record.expiresAt < Date.now()) {
      this.resetCodes.delete(email);
      throw new BadRequestException('Код восстановления недействителен или истёк');
    }

    if (record.codeHash !== hashToken(code.trim())) {
      throw new BadRequestException('Неверный код восстановления');
    }

    const newPasswordHash = await hashPassword(newPassword);

    if (this.db) {
      const user = await this.db.user.findUnique({ where: { email } });
      if (!user) throw new NotFoundException('Пользователь не найден');

      await this.db.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });
      await this.logoutAll(user.id);
    } else {
      let target: InMemoryUser | undefined;
      for (const u of this.memUsers.values()) {
        if (u.email === email) {
          target = u;
          break;
        }
      }
      if (!target) throw new NotFoundException('Пользователь не найден');
      target.passwordHash = newPasswordHash;
      await this.logoutAll(target.id);
    }

    this.resetCodes.delete(email);
    return {
      success: true,
      message: 'Пароль успешно обновлён. Войдите с новым паролем.',
    };
  }

  private async createSessionAndTokens(user: any, meta: SessionMeta) {
    const refreshToken = generateOpaqueToken();
    const refreshTokenHash = hashToken(refreshToken);
    const ttlDays = meta.rememberDevice === false ? 1 : this.refreshTtlDays;
    const expiresAt = new Date(Date.now() + ttlDays * 86400 * 1000);

    let sessionId: string;

    if (this.db) {
      const session = await this.db.session.create({
        data: {
          userId: user.id,
          refreshTokenHash,
          deviceName: meta.deviceName || 'Web Browser',
          userAgent: meta.userAgent,
          ipAddress: meta.ipAddress,
          expiresAt,
        },
      });
      sessionId = session.id;
    } else {
      sessionId = crypto.randomUUID();
      this.memSessions.set(sessionId, {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        deviceName: meta.deviceName || 'Web Browser',
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
        revokedAt: null,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      });
      this.persistLocalAuth();
    }

    const accessToken = await this.signAccessToken(user, sessionId);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds,
    };
  }

  private signAccessToken(user: { id: string; email: string; role: string }, sessionId: string) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        sid: sessionId,
      },
      {
        secret: this.jwtSecret,
        expiresIn: this.accessTtlSeconds,
      },
    );
  }
}

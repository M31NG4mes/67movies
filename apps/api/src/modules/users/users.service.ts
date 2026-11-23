import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LocalStoreService } from '../../common/storage/local-store.service';
import { hashPassword } from '../auth/password.util';
import { validateNickname } from '../../common/security/security.util';
import {
  AddFavoriteDto,
  CreateProfileDto,
  MediaTypeDto,
  SyncProgressDto,
  UpdateProfileDto,
  UpdateUserSettingsDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  private static readonly MAX_PROFILES_PER_USER = 5;

  // In-memory fallback stores when PostgreSQL is offline
  private readonly memProfiles = new Map<string, any>();
  private readonly memFavorites = new Map<string, any>();
  private readonly memHistory = new Map<string, any>();
  private readonly memProgress = new Map<string, any>();
  private readonly memSettings = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly localStore: LocalStoreService,
  ) {
    for (const [k, v] of Object.entries(this.localStore.data.profiles)) this.memProfiles.set(k, v);
    for (const [k, v] of Object.entries(this.localStore.data.favorites)) this.memFavorites.set(k, v);
    for (const [k, v] of Object.entries(this.localStore.data.history)) this.memHistory.set(k, v);
    for (const [k, v] of Object.entries(this.localStore.data.progress)) this.memProgress.set(k, v);
    for (const [k, v] of Object.entries(this.localStore.data.settings)) this.memSettings.set(k, v);
  }

  private persistLocal() {
    this.localStore.data.profiles = Object.fromEntries(this.memProfiles.entries());
    this.localStore.data.favorites = Object.fromEntries(this.memFavorites.entries());
    this.localStore.data.history = Object.fromEntries(this.memHistory.entries());
    this.localStore.data.progress = Object.fromEntries(this.memProgress.entries());
    this.localStore.data.settings = Object.fromEntries(this.memSettings.entries());
    this.localStore.save();
  }

  private get db() {
    return this.prisma.client;
  }

  private async assertProfileOwnership(userId: string, profileId: string) {
    if (this.db) {
      const profile = await this.db.profile.findUnique({ where: { id: profileId } });
      if (!profile) throw new NotFoundException('Профиль не найден');
      if (profile.userId !== userId) throw new ForbiddenException('Нет доступа к этому профилю');
      return profile;
    }

    const profile = this.memProfiles.get(profileId);
    if (!profile) throw new NotFoundException('Профиль не найден');
    if (profile.userId !== userId) throw new ForbiddenException('Нет доступа к этому профилю');
    return profile;
  }

  // =========================================================================
  // PROFILES
  // =========================================================================

  async listProfiles(userId: string) {
    if (this.db) {
      return this.db.profile.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          userId: true,
          name: true,
          avatarUrl: true,
          bannerUrl: true,
          isKidsMode: true,
          language: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const existing = [...this.memProfiles.values()].filter((p) => p.userId === userId);
    if (existing.length === 0) {
      const def = {
        id: crypto.randomUUID(),
        userId,
        name: 'Основной',
        avatarUrl: null,
        bannerUrl: null,
        isKidsMode: false,
        language: 'ru',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.memProfiles.set(def.id, def);
      this.persistLocal();
      return [def];
    }
    return existing;
  }

  async createProfile(userId: string, dto: CreateProfileDto) {
    const nickError = validateNickname(dto.name);
    if (nickError) {
      throw new BadRequestException(nickError);
    }
    const existing = await this.listProfiles(userId);
    if (existing.length >= UsersService.MAX_PROFILES_PER_USER) {
      throw new BadRequestException(
        `Максимум ${UsersService.MAX_PROFILES_PER_USER} профилей на один аккаунт`,
      );
    }

    const pinHash = dto.pin ? await hashPassword(dto.pin) : null;

    if (this.db) {
      return this.db.profile.create({
        data: {
          userId,
          name: dto.name.trim(),
          avatarUrl: dto.avatarUrl,
          bannerUrl: dto.bannerUrl,
          isKidsMode: dto.isKidsMode ?? false,
          language: dto.language || 'ru',
          pinHash,
        },
        select: {
          id: true,
          userId: true,
          name: true,
          avatarUrl: true,
          bannerUrl: true,
          isKidsMode: true,
          language: true,
          createdAt: true,
        },
      });
    }

    const profile = {
      id: crypto.randomUUID(),
      userId,
      name: dto.name.trim(),
      avatarUrl: dto.avatarUrl ?? null,
      bannerUrl: dto.bannerUrl ?? null,
      isKidsMode: dto.isKidsMode ?? false,
      language: dto.language || 'ru',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.memProfiles.set(profile.id, profile);
    this.persistLocal();
    return profile;
  }

  async updateProfile(userId: string, profileId: string, dto: UpdateProfileDto) {
    if (dto.name !== undefined) {
      const nickError = validateNickname(dto.name);
      if (nickError) {
        throw new BadRequestException(nickError);
      }
    }
    await this.assertProfileOwnership(userId, profileId);

    if (this.db) {
      return this.db.profile.update({
        where: { id: profileId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
          ...(dto.bannerUrl !== undefined ? { bannerUrl: dto.bannerUrl } : {}),
          ...(dto.isKidsMode !== undefined ? { isKidsMode: dto.isKidsMode } : {}),
          ...(dto.language !== undefined ? { language: dto.language } : {}),
        },
        select: {
          id: true,
          userId: true,
          name: true,
          avatarUrl: true,
          bannerUrl: true,
          isKidsMode: true,
          language: true,
          updatedAt: true,
        },
      });
    }

    const profile = this.memProfiles.get(profileId);
    const updated = { ...profile, ...dto, updatedAt: new Date() };
    this.memProfiles.set(profileId, updated);
    this.persistLocal();
    return updated;
  }

  async deleteProfile(userId: string, profileId: string) {
    await this.assertProfileOwnership(userId, profileId);
    const profiles = await this.listProfiles(userId);
    if (profiles.length <= 1) {
      throw new BadRequestException('Нельзя удалить единственный профиль аккаунта');
    }

    if (this.db) {
      await this.db.profile.delete({ where: { id: profileId } });
      return { success: true };
    }

    this.memProfiles.delete(profileId);
    return { success: true };
  }

  // =========================================================================
  // FAVORITES
  // =========================================================================

  async listFavorites(userId: string, profileId: string) {
    await this.assertProfileOwnership(userId, profileId);

    if (this.db) {
      return this.db.favorite.findMany({
        where: { profileId },
        orderBy: { createdAt: 'desc' },
      });
    }

    return [...this.memFavorites.values()]
      .filter((f) => f.profileId === profileId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async addFavorite(userId: string, dto: AddFavoriteDto) {
    await this.assertProfileOwnership(userId, dto.profileId);

    if (this.db) {
      return this.db.favorite.upsert({
        where: {
          profileId_mediaType_tmdbId: {
            profileId: dto.profileId,
            mediaType: dto.mediaType,
            tmdbId: dto.tmdbId,
          },
        },
        update: {
          title: dto.title,
          posterPath: dto.posterPath,
        },
        create: {
          profileId: dto.profileId,
          mediaType: dto.mediaType,
          tmdbId: dto.tmdbId,
          title: dto.title,
          posterPath: dto.posterPath,
        },
      });
    }

    const key = `${dto.profileId}:${dto.mediaType}:${dto.tmdbId}`;
    const item = {
      id: this.memFavorites.get(key)?.id || crypto.randomUUID(),
      ...dto,
      createdAt: new Date(),
    };
    this.memFavorites.set(key, item);
    return item;
  }

  async removeFavorite(userId: string, profileId: string, mediaType: MediaTypeDto, tmdbId: number) {
    await this.assertProfileOwnership(userId, profileId);

    if (this.db) {
      await this.db.favorite.deleteMany({
        where: { profileId, mediaType, tmdbId },
      });
      return { success: true };
    }

    this.memFavorites.delete(`${profileId}:${mediaType}:${tmdbId}`);
    return { success: true };
  }

  // =========================================================================
  // WATCH PROGRESS & CROSS-DEVICE SYNC + WATCH HISTORY
  // =========================================================================

  async syncProgress(userId: string, dto: SyncProgressDto) {
    await this.assertProfileOwnership(userId, dto.profileId);

    const seasonNumber = dto.seasonNumber ?? 0;
    const episodeNumber = dto.episodeNumber ?? 0;
    const percentage =
      dto.duration > 0 ? Math.min(100, Math.round((dto.currentTime / dto.duration) * 1000) / 10) : 0;
    const isCompleted = percentage >= 90;

    if (this.db) {
      const progress = await this.db.watchProgress.upsert({
        where: {
          profileId_mediaType_tmdbId_seasonNumber_episodeNumber: {
            profileId: dto.profileId,
            mediaType: dto.mediaType,
            tmdbId: dto.tmdbId,
            seasonNumber,
            episodeNumber,
          },
        },
        update: {
          currentTime: dto.currentTime,
          duration: dto.duration,
          percentage,
          isCompleted,
          deviceId: dto.deviceId,
          ...(dto.title ? { title: dto.title } : {}),
          ...(dto.posterPath ? { posterPath: dto.posterPath } : {}),
        },
        create: {
          profileId: dto.profileId,
          mediaType: dto.mediaType,
          tmdbId: dto.tmdbId,
          seasonNumber,
          episodeNumber,
          title: dto.title,
          posterPath: dto.posterPath,
          currentTime: dto.currentTime,
          duration: dto.duration,
          percentage,
          isCompleted,
          deviceId: dto.deviceId,
        },
      });

      // Record watch history entry
      if (dto.title) {
        await this.db.watchHistory.create({
          data: {
            profileId: dto.profileId,
            mediaType: dto.mediaType,
            tmdbId: dto.tmdbId,
            seasonNumber: seasonNumber > 0 ? seasonNumber : null,
            episodeNumber: episodeNumber > 0 ? episodeNumber : null,
            title: dto.title,
            posterPath: dto.posterPath,
          },
        });
      }

      return progress;
    }

    const key = `${dto.profileId}:${dto.mediaType}:${dto.tmdbId}:${seasonNumber}:${episodeNumber}`;
    const progress = {
      id: this.memProgress.get(key)?.id || crypto.randomUUID(),
      profileId: dto.profileId,
      mediaType: dto.mediaType,
      tmdbId: dto.tmdbId,
      seasonNumber,
      episodeNumber,
      title: dto.title ?? null,
      posterPath: dto.posterPath ?? null,
      currentTime: dto.currentTime,
      duration: dto.duration,
      percentage,
      isCompleted,
      deviceId: dto.deviceId ?? null,
      updatedAt: new Date(),
    };
    this.memProgress.set(key, progress);

    if (dto.title) {
      const histId = crypto.randomUUID();
      this.memHistory.set(histId, {
        id: histId,
        profileId: dto.profileId,
        mediaType: dto.mediaType,
        tmdbId: dto.tmdbId,
        seasonNumber: seasonNumber > 0 ? seasonNumber : null,
        episodeNumber: episodeNumber > 0 ? episodeNumber : null,
        title: dto.title,
        posterPath: dto.posterPath ?? null,
        watchedAt: new Date(),
      });
    }

    return progress;
  }

  async getProgress(
    userId: string,
    profileId: string,
    mediaType: MediaTypeDto,
    tmdbId: number,
    seasonNumber = 0,
    episodeNumber = 0,
  ) {
    await this.assertProfileOwnership(userId, profileId);

    if (this.db) {
      return this.db.watchProgress.findUnique({
        where: {
          profileId_mediaType_tmdbId_seasonNumber_episodeNumber: {
            profileId,
            mediaType,
            tmdbId,
            seasonNumber,
            episodeNumber,
          },
        },
      });
    }

    return this.memProgress.get(`${profileId}:${mediaType}:${tmdbId}:${seasonNumber}:${episodeNumber}`) ?? null;
  }

  async getContinueWatching(userId: string, profileId: string) {
    await this.assertProfileOwnership(userId, profileId);

    if (this.db) {
      return this.db.watchProgress.findMany({
        where: { profileId, isCompleted: false, currentTime: { gt: 0 } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });
    }

    return [...this.memProgress.values()]
      .filter((p) => p.profileId === profileId && !p.isCompleted && p.currentTime > 0)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 20);
  }

  async getWatchHistory(userId: string, profileId: string) {
    await this.assertProfileOwnership(userId, profileId);

    if (this.db) {
      return this.db.watchHistory.findMany({
        where: { profileId },
        orderBy: { watchedAt: 'desc' },
        take: 50,
      });
    }

    return [...this.memHistory.values()]
      .filter((h) => h.profileId === profileId)
      .sort((a, b) => b.watchedAt.getTime() - a.watchedAt.getTime())
      .slice(0, 50);
  }

  async deleteHistoryItem(userId: string, historyId: string) {
    if (this.db) {
      const item = await this.db.watchHistory.findUnique({
        where: { id: historyId },
        include: { profile: true },
      });
      if (!item) throw new NotFoundException('Запись истории не найдена');
      if (item.profile.userId !== userId) throw new ForbiddenException('Нет доступа');
      await this.db.watchHistory.delete({ where: { id: historyId } });
      return { success: true };
    }

    const item = this.memHistory.get(historyId);
    if (!item) throw new NotFoundException('Запись истории не найдена');
    await this.assertProfileOwnership(userId, item.profileId);
    this.memHistory.delete(historyId);
    return { success: true };
  }

  // =========================================================================
  // USER INTERFACE SETTINGS
  // =========================================================================

  async getSettings(userId: string) {
    if (this.db) {
      const existing = await this.db.userSettings.findUnique({ where: { userId } });
      if (existing) return existing;
      return this.db.userSettings.create({ data: { userId } });
    }

    if (!this.memSettings.has(userId)) {
      this.memSettings.set(userId, {
        id: crypto.randomUUID(),
        userId,
        theme: 'dark',
        accentColor: '#8065FF',
        language: 'ru',
        autoplayNext: true,
        defaultQuality: '1080p',
        subtitlesEnabled: false,
        subtitleLanguage: 'ru',
        reducedMotion: false,
        updatedAt: new Date(),
      });
    }
    return this.memSettings.get(userId);
  }

  async updateSettings(userId: string, dto: UpdateUserSettingsDto) {
    if (this.db) {
      return this.db.userSettings.upsert({
        where: { userId },
        update: { ...dto },
        create: { userId, ...dto },
      });
    }

    const current = await this.getSettings(userId);
    const updated = { ...current, ...dto, updatedAt: new Date() };
    this.memSettings.set(userId, updated);
    this.persistLocal();
    return updated;
  }
}

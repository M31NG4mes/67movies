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
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { MediaTypeDto } from '../users/dto/users.dto';
import {
  AddCollectionItemDto,
  CreateCollectionDto,
  SendFriendRequestDto,
  SendMessageDto,
  UpsertRatingDto,
} from './dto/social.dto';

interface InMemoryFriendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: Date;
  updatedAt: Date;
}

interface InMemoryRating {
  id: string;
  userId: string;
  mediaType: MediaTypeDto;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  rating: number;
  review: string | null;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SocialService {
  private readonly memFriendships = new Map<string, InMemoryFriendship>();
  private readonly memRatings = new Map<string, InMemoryRating>();
  private readonly memCollections = new Map<string, any>();
  private readonly memMessages = new Map<string, any>();
  private readonly typingStatus = new Map<string, number>(); // key: `${senderId}->${receiverId}`, val: expiresAt ms

  constructor(
    private readonly prisma: PrismaService,
    private readonly localStore: LocalStoreService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {
    for (const [k, v] of Object.entries(this.localStore.data.friendships)) {
      this.memFriendships.set(k, {
        ...v,
        createdAt: new Date(v.createdAt),
        updatedAt: new Date(v.updatedAt),
      });
    }
    for (const [k, v] of Object.entries(this.localStore.data.ratings)) {
      this.memRatings.set(k, {
        ...v,
        createdAt: new Date(v.createdAt),
        updatedAt: new Date(v.updatedAt),
      });
    }
    for (const [k, v] of Object.entries(this.localStore.data.collections || {})) {
      this.memCollections.set(k, v);
    }
    for (const [k, v] of Object.entries(this.localStore.data.messages || {})) {
      this.memMessages.set(k, {
        ...v,
        createdAt: new Date(v.createdAt),
      });
    }
  }

  private persistSocial() {
    this.localStore.data.friendships = Object.fromEntries(this.memFriendships.entries());
    this.localStore.data.ratings = Object.fromEntries(this.memRatings.entries());
    this.localStore.data.collections = Object.fromEntries(this.memCollections.entries());
    this.localStore.data.messages = Object.fromEntries(this.memMessages.entries());
    this.localStore.save();
  }

  private get db() {
    return this.prisma.client;
  }

  private async enrichUser(userId: string) {
    const base = await this.authService.findPublicUserById(userId);
    if (!base) return null;

    if (!this.db) {
      const profiles = await this.usersService.listProfiles(userId).catch(() => []);
      const first = profiles[0];
      if (first) {
        return {
          ...base,
          name: first.name || base.name,
          avatarUrl: first.avatarUrl ?? base.avatarUrl,
          bannerUrl: first.bannerUrl ?? base.bannerUrl,
        };
      }
    }
    return base;
  }

  // =========================================================================
  // FRIENDS SYSTEM
  // =========================================================================

  async searchUsers(userId: string, query: string) {
    return this.authService.searchPublicUsers(query, userId);
  }

  async sendFriendRequest(userId: string, dto: SendFriendRequestDto) {
    let targetId = dto.targetUserId;
    if (!targetId && dto.email) {
      const target = await this.authService.findUserByEmail(dto.email);
      if (!target) throw new NotFoundException('Пользователь с таким email не найден');
      targetId = target.id;
    }

    if (!targetId) {
      throw new BadRequestException('Укажите email или ID пользователя');
    }
    if (targetId === userId) {
      throw new BadRequestException('Нельзя добавить самого себя в друзья');
    }

    const targetPublic = await this.enrichUser(targetId);
    if (!targetPublic) throw new NotFoundException('Пользователь не найден');

    if (this.db) {
      const existing = await this.db.friendship.findFirst({
        where: {
          OR: [
            { requesterId: userId, addresseeId: targetId },
            { requesterId: targetId, addresseeId: userId },
          ],
        },
      });
      if (existing) {
        if (existing.status === 'ACCEPTED') {
          throw new ConflictException('Вы уже друзья с этим пользователем');
        }
        if (existing.status === 'PENDING') {
          throw new ConflictException('Запрос в друзья уже отправлен');
        }
      }

      return this.db.friendship.create({
        data: {
          requesterId: userId,
          addresseeId: targetId,
          status: 'PENDING',
        },
      });
    }

    for (const f of this.memFriendships.values()) {
      const samePair =
        (f.requesterId === userId && f.addresseeId === targetId) ||
        (f.requesterId === targetId && f.addresseeId === userId);
      if (samePair && f.status !== 'DECLINED') {
        throw new ConflictException(
          f.status === 'ACCEPTED' ? 'Вы уже друзья' : 'Запрос в друзья уже существует',
        );
      }
    }

    const record: InMemoryFriendship = {
      id: crypto.randomUUID(),
      requesterId: userId,
      addresseeId: targetId,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.memFriendships.set(record.id, record);
    this.persistSocial();
    return record;
  }

  async acceptFriendRequest(userId: string, requestId: string) {
    if (this.db) {
      const req = await this.db.friendship.findUnique({ where: { id: requestId } });
      if (!req) throw new NotFoundException('Запрос в друзья не найден');
      if (req.addresseeId !== userId) {
        throw new ForbiddenException('Вы можете принимать только входящие запросы');
      }
      return this.db.friendship.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      });
    }

    const req = this.memFriendships.get(requestId);
    if (!req) throw new NotFoundException('Запрос в друзья не найден');
    if (req.addresseeId !== userId) {
      throw new ForbiddenException('Вы можете принимать только входящие запросы');
    }
    req.status = 'ACCEPTED';
    req.updatedAt = new Date();
    this.persistSocial();
    return req;
  }

  async removeFriendship(userId: string, friendshipId: string) {
    if (this.db) {
      const rec = await this.db.friendship.findUnique({ where: { id: friendshipId } });
      if (!rec) throw new NotFoundException('Запись не найдена');
      if (rec.requesterId !== userId && rec.addresseeId !== userId) {
        throw new ForbiddenException('Нет доступа');
      }
      await this.db.friendship.delete({ where: { id: friendshipId } });
      return { success: true };
    }

    const rec = this.memFriendships.get(friendshipId);
    if (!rec) throw new NotFoundException('Запись не найдена');
    if (rec.requesterId !== userId && rec.addresseeId !== userId) {
      throw new ForbiddenException('Нет доступа');
    }
    this.memFriendships.delete(friendshipId);
    this.persistSocial();
    return { success: true };
  }

  async getFriendsOverview(userId: string) {
    let rows: InMemoryFriendship[];

    if (this.db) {
      rows = await this.db.friendship.findMany({
        where: {
          OR: [{ requesterId: userId }, { addresseeId: userId }],
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        orderBy: { updatedAt: 'desc' },
      });
    } else {
      rows = [...this.memFriendships.values()].filter(
        (f) =>
          (f.requesterId === userId || f.addresseeId === userId) &&
          f.status !== 'DECLINED',
      );
    }

    const friends: any[] = [];
    const incomingRequests: any[] = [];
    const outgoingRequests: any[] = [];

    for (const row of rows) {
      const otherId = row.requesterId === userId ? row.addresseeId : row.requesterId;
      const otherUser = await this.enrichUser(otherId);
      if (!otherUser) continue;

      if (row.status === 'ACCEPTED') {
        const ratings = await this.getUserRatings(otherId);
        friends.push({
          friendshipId: row.id,
          user: otherUser,
          ratingsCount: ratings.length,
          favoritesCount: ratings.filter((r) => r.isFavorite).length,
        });
      } else if (row.addresseeId === userId) {
        incomingRequests.push({
          requestId: row.id,
          from: otherUser,
          createdAt: row.createdAt,
        });
      } else {
        outgoingRequests.push({
          requestId: row.id,
          to: otherUser,
          createdAt: row.createdAt,
        });
      }
    }

    return { friends, incomingRequests, outgoingRequests };
  }

  // =========================================================================
  // SHARED FAVORITE MOVIES & RATINGS (PROFILE SHOWCASE)
  // =========================================================================

  async upsertRating(userId: string, dto: UpsertRatingDto) {
    const mediaType = dto.mediaType || MediaTypeDto.MOVIE;
    const isFavorite = dto.isFavorite ?? dto.rating >= 8;

    if (this.db) {
      return this.db.movieRating.upsert({
        where: {
          userId_mediaType_tmdbId: {
            userId,
            mediaType,
            tmdbId: dto.tmdbId,
          },
        },
        update: {
          title: dto.title,
          posterPath: dto.posterPath,
          rating: dto.rating,
          review: dto.review,
          isFavorite,
        },
        create: {
          userId,
          mediaType,
          tmdbId: dto.tmdbId,
          title: dto.title,
          posterPath: dto.posterPath,
          rating: dto.rating,
          review: dto.review,
          isFavorite,
        },
      });
    }

    const key = `${userId}:${mediaType}:${dto.tmdbId}`;
    const existing = this.memRatings.get(key);
    const item: InMemoryRating = {
      id: existing?.id || crypto.randomUUID(),
      userId,
      mediaType,
      tmdbId: dto.tmdbId,
      title: dto.title,
      posterPath: dto.posterPath ?? existing?.posterPath ?? null,
      rating: dto.rating,
      review: dto.review ?? existing?.review ?? null,
      isFavorite,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.memRatings.set(key, item);
    this.persistSocial();
    return item;
  }

  async deleteRating(userId: string, tmdbId: number, mediaType: MediaTypeDto = MediaTypeDto.MOVIE) {
    if (this.db) {
      await this.db.movieRating.deleteMany({
        where: { userId, mediaType, tmdbId },
      });
      return { success: true };
    }

    this.memRatings.delete(`${userId}:${mediaType}:${tmdbId}`);
    this.persistSocial();
    return { success: true };
  }

  async getUserRatings(userId: string) {
    if (this.db) {
      return this.db.movieRating.findMany({
        where: { userId },
        orderBy: [{ isFavorite: 'desc' }, { rating: 'desc' }, { updatedAt: 'desc' }],
      });
    }

    return [...this.memRatings.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
  }

  async getPublicShowcase(targetUserId: string) {
    const user = await this.enrichUser(targetUserId);
    if (!user) throw new NotFoundException('Профиль пользователя не найден');

    const ratings = await this.getUserRatings(targetUserId);
    const favorites = ratings.filter((r) => r.isFavorite);
    const collections = (await this.getUserCollections(targetUserId)).filter(
      (c: any) => c.isPublic !== false,
    );
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length) * 10) / 10
        : 0;

    return {
      user,
      stats: {
        totalRated: ratings.length,
        totalFavorites: favorites.length,
        averageRating: avgRating,
      },
      favorites,
      ratings,
      collections,
    };
  }

  // =========================================================================
  // CUSTOM COLLECTIONS (Letterboxd-style User Lists)
  // =========================================================================

  async getUserCollections(userId: string) {
    if (this.db) {
      return this.db.collection.findMany({
        where: { userId },
        include: { items: { orderBy: { addedAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
      });
    }

    return [...this.memCollections.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async createCollection(userId: string, dto: CreateCollectionDto) {
    if (this.db) {
      return this.db.collection.create({
        data: {
          userId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          isPublic: dto.isPublic ?? true,
        },
        include: { items: true },
      });
    }

    const col = {
      id: crypto.randomUUID(),
      userId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      isPublic: dto.isPublic ?? true,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.memCollections.set(col.id, col);
    this.persistSocial();
    return col;
  }

  async deleteCollection(userId: string, collectionId: string) {
    if (this.db) {
      const existing = await this.db.collection.findUnique({ where: { id: collectionId } });
      if (!existing) throw new NotFoundException('Подборка не найдена');
      if (existing.userId !== userId) throw new ForbiddenException('Нет доступа');
      await this.db.collection.delete({ where: { id: collectionId } });
      return { success: true };
    }

    const existing = this.memCollections.get(collectionId);
    if (!existing) throw new NotFoundException('Подборка не найдена');
    if (existing.userId !== userId) throw new ForbiddenException('Нет доступа');
    this.memCollections.delete(collectionId);
    this.persistSocial();
    return { success: true };
  }

  async addCollectionItem(userId: string, collectionId: string, dto: AddCollectionItemDto) {
    const mediaType = dto.mediaType || MediaTypeDto.MOVIE;

    if (this.db) {
      const col = await this.db.collection.findUnique({ where: { id: collectionId } });
      if (!col) throw new NotFoundException('Подборка не найдена');
      if (col.userId !== userId) throw new ForbiddenException('Нет доступа');

      return this.db.collectionItem.upsert({
        where: {
          collectionId_mediaType_tmdbId: {
            collectionId,
            mediaType,
            tmdbId: dto.tmdbId,
          },
        },
        update: { title: dto.title, posterPath: dto.posterPath },
        create: {
          collectionId,
          mediaType,
          tmdbId: dto.tmdbId,
          title: dto.title,
          posterPath: dto.posterPath,
        },
      });
    }

    const col = this.memCollections.get(collectionId);
    if (!col) throw new NotFoundException('Подборка не найдена');
    if (col.userId !== userId) throw new ForbiddenException('Нет доступа');
    const exists = col.items.find((i: any) => i.tmdbId === dto.tmdbId && i.mediaType === mediaType);
    if (!exists) {
      col.items.unshift({
        id: crypto.randomUUID(),
        collectionId,
        mediaType,
        tmdbId: dto.tmdbId,
        title: dto.title,
        posterPath: dto.posterPath || null,
        addedAt: new Date().toISOString(),
      });
      col.updatedAt = new Date().toISOString();
      this.persistSocial();
    }
    return col;
  }

  async removeCollectionItem(
    userId: string,
    collectionId: string,
    tmdbId: number,
    mediaType: MediaTypeDto = MediaTypeDto.MOVIE,
  ) {
    if (this.db) {
      const col = await this.db.collection.findUnique({ where: { id: collectionId } });
      if (!col) throw new NotFoundException('Подборка не найдена');
      if (col.userId !== userId) throw new ForbiddenException('Нет доступа');
      await this.db.collectionItem.deleteMany({
        where: { collectionId, mediaType, tmdbId },
      });
      return { success: true };
    }

    const col = this.memCollections.get(collectionId);
    if (!col || col.userId !== userId) throw new NotFoundException('Подборка не найдена');
    col.items = col.items.filter((i: any) => !(i.tmdbId === tmdbId && i.mediaType === mediaType));
    col.updatedAt = new Date().toISOString();
    this.persistSocial();
    return { success: true };
  }

  /**
   * Returns community 67movies average rating and all user reviews for a given movie/series.
   */
  async getMediaReviews(tmdbId: number, mediaType: MediaTypeDto = MediaTypeDto.MOVIE) {
    let rows: any[];

    if (this.db) {
      rows = await this.db.movieRating.findMany({
        where: { tmdbId, mediaType },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
    } else {
      rows = [...this.memRatings.values()]
        .filter((r) => r.tmdbId === tmdbId && r.mediaType === mediaType)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    const totalRatings = rows.length;
    const averageRating =
      totalRatings > 0
        ? Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / totalRatings) * 10) / 10
        : 0;

    const reviews = await Promise.all(
      rows.map(async (row) => {
        const author = await this.enrichUser(row.userId);
        return {
          id: row.id,
          userId: row.userId,
          authorName: author?.name || 'Кинозритель',
          authorAvatar: author?.avatarUrl || null,
          rating: row.rating,
          review: row.review || '',
          isFavorite: Boolean(row.isFavorite),
          updatedAt: row.updatedAt,
        };
      }),
    );

    return {
      tmdbId,
      mediaType,
      totalRatings,
      averageRating,
      reviews,
    };
  }

  // =========================================================================
  // Direct Messenger with Friends (Text + Movie Cards)
  // =========================================================================

  private async ensureAreFriends(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new BadRequestException('Нельзя отправить сообщение самому себе');
    }

    if (this.db) {
      const friendship = await this.db.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: userId, addresseeId: friendId },
            { requesterId: friendId, addresseeId: userId },
          ],
        },
      });
      if (!friendship) {
        throw new ForbiddenException('Писать сообщения можно только друзьям');
      }
      return;
    }

    const friendship = [...this.memFriendships.values()].find(
      (f) =>
        f.status === 'ACCEPTED' &&
        ((f.requesterId === userId && f.addresseeId === friendId) ||
          (f.requesterId === friendId && f.addresseeId === userId)),
    );
    if (!friendship) {
      throw new ForbiddenException('Писать сообщения можно только друзьям');
    }
  }

  async getUnreadMessageCount(userId: string) {
    const dmModel = (this.db as any)?.directMessage;
    if (dmModel) {
      const unreadCount = await dmModel.count({
        where: { receiverId: userId, isRead: false },
      });
      return { unreadCount };
    }

    const unreadCount = [...this.memMessages.values()].filter(
      (m) => m.receiverId === userId && !m.isRead,
    ).length;
    return { unreadCount };
  }

  async setTypingStatus(userId: string, friendId: string) {
    await this.ensureAreFriends(userId, friendId);
    this.typingStatus.set(`${userId}->${friendId}`, Date.now() + 5000);
    return { ok: true };
  }

  private isUserTypingTo(senderId: string, receiverId: string): boolean {
    const exp = this.typingStatus.get(`${senderId}->${receiverId}`);
    if (!exp) return false;
    if (Date.now() > exp) {
      this.typingStatus.delete(`${senderId}->${receiverId}`);
      return false;
    }
    return true;
  }

  async getConversations(userId: string) {
    const friendsData = await this.getFriendsOverview(userId);
    const dmModel = (this.db as any)?.directMessage;

    const conversations = await Promise.all(
      friendsData.friends.map(async (f) => {
        const friendId = f.user.id;
        let lastMessage: any = null;
        let unreadCount = 0;

        if (dmModel) {
          lastMessage = await dmModel.findFirst({
            where: {
              OR: [
                { senderId: userId, receiverId: friendId },
                { senderId: friendId, receiverId: userId },
              ],
            },
            orderBy: { createdAt: 'desc' },
          });
          unreadCount = await dmModel.count({
            where: { senderId: friendId, receiverId: userId, isRead: false },
          });
        } else {
          const thread = [...this.memMessages.values()]
            .filter(
              (m) =>
                (m.senderId === userId && m.receiverId === friendId) ||
                (m.senderId === friendId && m.receiverId === userId),
            )
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          lastMessage = thread[0] || null;
          unreadCount = thread.filter((m) => m.receiverId === userId && !m.isRead).length;
        }

        return {
          friend: f.user,
          unreadCount,
          lastMessage,
          isTyping: this.isUserTypingTo(friendId, userId),
        };
      }),
    );

    conversations.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    return { conversations, totalUnread };
  }

  async getMessagesWithFriend(userId: string, friendId: string) {
    await this.ensureAreFriends(userId, friendId);
    const friend = await this.enrichUser(friendId);
    const dmModel = (this.db as any)?.directMessage;

    if (dmModel) {
      await dmModel.updateMany({
        where: { senderId: friendId, receiverId: userId, isRead: false },
        data: { isRead: true },
      });

      const messages = await dmModel.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: friendId },
            { senderId: friendId, receiverId: userId },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 150,
      });

      return { friend, messages, isFriendTyping: this.isUserTypingTo(friendId, userId) };
    }

    let changed = false;
    const messages = [...this.memMessages.values()]
      .filter(
        (m) =>
          (m.senderId === userId && m.receiverId === friendId) ||
          (m.senderId === friendId && m.receiverId === userId),
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((m) => {
        if (m.senderId === friendId && m.receiverId === userId && !m.isRead) {
          m.isRead = true;
          changed = true;
        }
        return m;
      });

    if (changed) this.persistSocial();
    return { friend, messages, isFriendTyping: this.isUserTypingTo(friendId, userId) };
  }

  async sendMessageToFriend(userId: string, friendId: string, dto: SendMessageDto) {
    await this.ensureAreFriends(userId, friendId);

    const content = (dto.content || '').trim();
    const imageUrl = dto.imageUrl?.trim() || null;
    const gifUrl = dto.gifUrl?.trim() || null;

    if (!content && !dto.movieTmdbId && !imageUrl && !gifUrl) {
      throw new BadRequestException('Введите текст сообщения или прикрепите фото, GIF или фильм');
    }

    // Clear typing indicator immediately once message is sent
    this.typingStatus.delete(`${userId}->${friendId}`);

    const dmModel = (this.db as any)?.directMessage;
    if (dmModel) {
      return dmModel.create({
        data: {
          senderId: userId,
          receiverId: friendId,
          content,
          imageUrl,
          gifUrl,
          movieTmdbId: dto.movieTmdbId || null,
          movieMediaType: dto.movieTmdbId ? dto.movieMediaType || MediaTypeDto.MOVIE : null,
          movieTitle: dto.movieTitle || null,
          moviePosterPath: dto.moviePosterPath || null,
          isRead: false,
        },
      });
    }

    const msg = {
      id: crypto.randomUUID(),
      senderId: userId,
      receiverId: friendId,
      content,
      imageUrl,
      gifUrl,
      movieTmdbId: dto.movieTmdbId || null,
      movieMediaType: dto.movieTmdbId ? dto.movieMediaType || MediaTypeDto.MOVIE : null,
      movieTitle: dto.movieTitle || null,
      moviePosterPath: dto.moviePosterPath || null,
      isRead: false,
      createdAt: new Date(),
    };
    this.memMessages.set(msg.id, msg);
    this.persistSocial();
    return msg;
  }
}

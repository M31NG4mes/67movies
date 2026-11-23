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
import { sanitizeText } from '../../common/security/security.util';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { MediaTypeDto } from '../users/dto/users.dto';
import {
  AddCollectionItemDto,
  CreateCollectionDto,
  CreateGroupDto,
  EditMessageDto,
  SendFriendRequestDto,
  SendMessageDto,
  ToggleReactionDto,
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
  private readonly memGroups = new Map<string, any>();
  private readonly memGroupMessages = new Map<string, any>();
  private groupTablesReady = false;
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

    const content = sanitizeText(dto.content || '');
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
          replyToId: dto.replyToId || null,
          replyToContent: dto.replyToContent ? sanitizeText(dto.replyToContent).slice(0, 200) : null,
          replyToSenderName: dto.replyToSenderName ? sanitizeText(dto.replyToSenderName).slice(0, 80) : null,
          reactions: {},
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
      replyToId: dto.replyToId || null,
      replyToContent: dto.replyToContent ? sanitizeText(dto.replyToContent).slice(0, 200) : null,
      replyToSenderName: dto.replyToSenderName ? sanitizeText(dto.replyToSenderName).slice(0, 80) : null,
      editedAt: null,
      reactions: {},
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

  async editMessage(userId: string, messageId: string, dto: EditMessageDto) {
    const cleanContent = sanitizeText(dto.content);
    if (!cleanContent) {
      throw new BadRequestException('Текст сообщения не может быть пустым');
    }

    const dmModel = (this.db as any)?.directMessage;
    if (dmModel) {
      const existing = await dmModel.findUnique({ where: { id: messageId } });
      if (existing) {
        if (existing.senderId !== userId) {
          throw new ForbiddenException('Вы можете редактировать только свои сообщения');
        }
        return dmModel.update({
          where: { id: messageId },
          data: { content: cleanContent, editedAt: new Date() },
        });
      }
      await this.ensureGroupTables();
      const rows: any[] = await (this.db as any).$queryRawUnsafe(
        `SELECT * FROM chat_group_messages WHERE id = $1 LIMIT 1`,
        messageId,
      );
      const gm = rows?.[0];
      if (!gm) throw new NotFoundException('Сообщение не найдено');
      if (gm.sender_id !== userId) {
        throw new ForbiddenException('Вы можете редактировать только свои сообщения');
      }
      const now = new Date();
      await (this.db as any).$executeRawUnsafe(
        `UPDATE chat_group_messages SET content = $1, edited_at = $2 WHERE id = $3`,
        cleanContent,
        now,
        messageId,
      );
      return this.mapRawGroupMessage({ ...gm, content: cleanContent, edited_at: now });
    }

    const existing = this.memMessages.get(messageId) || this.memGroupMessages.get(messageId);
    if (!existing) throw new NotFoundException('Сообщение не найдено');
    if (existing.senderId !== userId) {
      throw new ForbiddenException('Вы можете редактировать только свои сообщения');
    }
    existing.content = cleanContent;
    existing.editedAt = new Date();
    this.persistSocial();
    return existing;
  }

  async toggleMessageReaction(userId: string, messageId: string, dto: ToggleReactionDto) {
    const emoji = dto.emoji.trim();
    if (!emoji) throw new BadRequestException('Укажите эмодзи для реакции');

    const applyToggle = (current: any) => {
      const map: Record<string, string[]> =
        current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
      const list = Array.isArray(map[emoji]) ? [...map[emoji]] : [];
      const idx = list.indexOf(userId);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(userId);
      }
      if (list.length === 0) {
        delete map[emoji];
      } else {
        map[emoji] = list;
      }
      return map;
    };

    const dmModel = (this.db as any)?.directMessage;
    if (dmModel) {
      const existing = await dmModel.findUnique({ where: { id: messageId } });
      if (existing) {
        if (existing.senderId !== userId && existing.receiverId !== userId) {
          throw new ForbiddenException('Нет доступа к этому диалогу');
        }
        const nextReactions = applyToggle(existing.reactions);
        return dmModel.update({
          where: { id: messageId },
          data: { reactions: nextReactions },
        });
      }
      await this.ensureGroupTables();
      const rows: any[] = await (this.db as any).$queryRawUnsafe(
        `SELECT * FROM chat_group_messages WHERE id = $1 LIMIT 1`,
        messageId,
      );
      const gm = rows?.[0];
      if (!gm) throw new NotFoundException('Сообщение не найдено');
      await this.ensureGroupMember(gm.group_id, userId);
      const parsed =
        typeof gm.reactions === 'string' ? JSON.parse(gm.reactions || '{}') : gm.reactions || {};
      const nextReactions = applyToggle(parsed);
      await (this.db as any).$executeRawUnsafe(
        `UPDATE chat_group_messages SET reactions = $1::jsonb WHERE id = $2`,
        JSON.stringify(nextReactions),
        messageId,
      );
      return this.mapRawGroupMessage({ ...gm, reactions: nextReactions });
    }

    const existing = this.memMessages.get(messageId) || this.memGroupMessages.get(messageId);
    if (!existing) throw new NotFoundException('Сообщение не найдено');
    if (existing.groupId) {
      const grp = this.memGroups.get(existing.groupId);
      if (!grp || !grp.memberIds.includes(userId)) {
        throw new ForbiddenException('Нет доступа к этой группе');
      }
    } else if (existing.senderId !== userId && existing.receiverId !== userId) {
      throw new ForbiddenException('Нет доступа к этому диалогу');
    }
    existing.reactions = applyToggle(existing.reactions);
    this.persistSocial();
    return existing;
  }

  async deleteMessage(userId: string, messageId: string) {
    const dmModel = (this.db as any)?.directMessage;
    if (dmModel) {
      const existing = await dmModel.findUnique({ where: { id: messageId } });
      if (existing) {
        if (existing.senderId !== userId) {
          throw new ForbiddenException('Вы можете удалять только свои сообщения');
        }
        await dmModel.delete({ where: { id: messageId } });
        return { deleted: true, id: messageId };
      }

      await this.ensureGroupTables();
      const rows: any[] = await (this.db as any).$queryRawUnsafe(
        `SELECT id, sender_id FROM chat_group_messages WHERE id = $1 LIMIT 1`,
        messageId,
      );
      const gm = rows?.[0];
      if (!gm) throw new NotFoundException('Сообщение не найдено');
      if (gm.sender_id !== userId) {
        throw new ForbiddenException('Вы можете удалять только свои сообщения');
      }
      await (this.db as any).$executeRawUnsafe(
        `DELETE FROM chat_group_messages WHERE id = $1`,
        messageId,
      );
      return { deleted: true, id: messageId };
    }

    const existing = this.memMessages.get(messageId);
    if (existing) {
      if (existing.senderId !== userId) {
        throw new ForbiddenException('Вы можете удалять только свои сообщения');
      }
      this.memMessages.delete(messageId);
      this.persistSocial();
      return { deleted: true, id: messageId };
    }

    const gm = this.memGroupMessages.get(messageId);
    if (!gm) throw new NotFoundException('Сообщение не найдено');
    if (gm.senderId !== userId) {
      throw new ForbiddenException('Вы можете удалять только свои сообщения');
    }
    this.memGroupMessages.delete(messageId);
    return { deleted: true, id: messageId };
  }

  private async ensureGroupTables() {
    if (!this.db || this.groupTablesReady) return;
    await (this.db as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS chat_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await (this.db as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS chat_group_members (
        group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (group_id, user_id)
      );
    `);
    await (this.db as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS chat_group_messages (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        image_url TEXT,
        gif_url TEXT,
        reply_to_id TEXT,
        reply_to_content TEXT,
        reply_to_sender_name TEXT,
        edited_at TIMESTAMPTZ,
        reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
        movie_tmdb_id INT,
        movie_media_type TEXT,
        movie_title TEXT,
        movie_poster_path TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    this.groupTablesReady = true;
  }

  private async ensureGroupMember(groupId: string, userId: string) {
    if (this.db) {
      await this.ensureGroupTables();
      const rows: any[] = await (this.db as any).$queryRawUnsafe(
        `SELECT user_id FROM chat_group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1`,
        groupId,
        userId,
      );
      if (!rows?.length) {
        throw new ForbiddenException('Вы не являетесь участником этой группы');
      }
      return;
    }
    const grp = this.memGroups.get(groupId);
    if (!grp || !grp.memberIds.includes(userId)) {
      throw new ForbiddenException('Вы не являетесь участником этой группы');
    }
  }

  private mapRawGroupMessage(row: any) {
    let reactions = {};
    try {
      reactions =
        typeof row.reactions === 'string'
          ? JSON.parse(row.reactions || '{}')
          : row.reactions || {};
    } catch {
      reactions = {};
    }
    return {
      id: row.id,
      groupId: row.group_id,
      senderId: row.sender_id,
      content: row.content || '',
      imageUrl: row.image_url || null,
      gifUrl: row.gif_url || null,
      replyToId: row.reply_to_id || null,
      replyToContent: row.reply_to_content || null,
      replyToSenderName: row.reply_to_sender_name || null,
      editedAt: row.edited_at || null,
      reactions,
      movieTmdbId: row.movie_tmdb_id || null,
      movieMediaType: row.movie_media_type || null,
      movieTitle: row.movie_title || null,
      moviePosterPath: row.movie_poster_path || null,
      createdAt: row.created_at,
    };
  }

  async createGroup(userId: string, dto: CreateGroupDto) {
    const cleanName = sanitizeText(dto.name);
    if (!cleanName) {
      throw new BadRequestException('Введите название группы');
    }

    const friendsList = await this.getFriendsOverview(userId);
    const allowedFriendIds = new Set(
      (friendsList.friends || []).map((f: any) => f.friend?.id).filter(Boolean),
    );
    const uniqueMembers = Array.from(
      new Set([
        userId,
        ...(dto.memberIds || []).filter((id) => id && id !== userId && allowedFriendIds.has(id)),
      ]),
    );
    if (uniqueMembers.length < 2) {
      throw new BadRequestException('Выберите хотя бы одного друга для создания группы');
    }

    const groupId = crypto.randomUUID();
    const now = new Date();

    if (this.db) {
      await this.ensureGroupTables();
      await (this.db as any).$executeRawUnsafe(
        `INSERT INTO chat_groups (id, name, owner_id, created_at) VALUES ($1, $2, $3, $4)`,
        groupId,
        cleanName,
        userId,
        now,
      );
      for (const memberId of uniqueMembers) {
        await (this.db as any).$executeRawUnsafe(
          `INSERT INTO chat_group_members (group_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4)`,
          groupId,
          memberId,
          memberId === userId ? 'owner' : 'member',
          now,
        );
      }
    } else {
      this.memGroups.set(groupId, {
        id: groupId,
        name: cleanName,
        ownerId: userId,
        memberIds: uniqueMembers,
        createdAt: now,
      });
    }

    const members = (await Promise.all(uniqueMembers.map((id) => this.enrichUser(id)))).filter(Boolean);
    return {
      id: groupId,
      name: cleanName,
      ownerId: userId,
      memberCount: members.length,
      members,
      lastMessage: null,
      createdAt: now,
    };
  }

  async getMyGroups(userId: string) {
    if (this.db) {
      await this.ensureGroupTables();
      const groupRows: any[] = await (this.db as any).$queryRawUnsafe(
        `SELECT g.id, g.name, g.owner_id, g.created_at
         FROM chat_groups g
         INNER JOIN chat_group_members m ON m.group_id = g.id
         WHERE m.user_id = $1
         ORDER BY g.created_at DESC`,
        userId,
      );
      const groups = await Promise.all(
        (groupRows || []).map(async (g) => {
          const memberRows: any[] = await (this.db as any).$queryRawUnsafe(
            `SELECT user_id FROM chat_group_members WHERE group_id = $1`,
            g.id,
          );
          const members = (
            await Promise.all((memberRows || []).map((r) => this.enrichUser(r.user_id)))
          ).filter(Boolean);
          const lastMsgRows: any[] = await (this.db as any).$queryRawUnsafe(
            `SELECT * FROM chat_group_messages WHERE group_id = $1 ORDER BY created_at DESC LIMIT 1`,
            g.id,
          );
          return {
            id: g.id,
            name: g.name,
            ownerId: g.owner_id,
            memberCount: members.length,
            members,
            lastMessage: lastMsgRows?.[0] ? this.mapRawGroupMessage(lastMsgRows[0]) : null,
            createdAt: g.created_at,
          };
        }),
      );
      return { groups };
    }

    const groups = await Promise.all(
      Array.from(this.memGroups.values())
        .filter((g) => g.memberIds.includes(userId))
        .map(async (g) => {
          const members = (
            await Promise.all(g.memberIds.map((id: string) => this.enrichUser(id)))
          ).filter(Boolean);
          const msgs = Array.from(this.memGroupMessages.values())
            .filter((m) => m.groupId === g.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return {
            id: g.id,
            name: g.name,
            ownerId: g.ownerId,
            memberCount: members.length,
            members,
            lastMessage: msgs[0] || null,
            createdAt: g.createdAt,
          };
        }),
    );
    return { groups };
  }

  async getGroupMessages(userId: string, groupId: string) {
    await this.ensureGroupMember(groupId, userId);

    if (this.db) {
      await this.ensureGroupTables();
      const msgRows: any[] = await (this.db as any).$queryRawUnsafe(
        `SELECT * FROM chat_group_messages WHERE group_id = $1 ORDER BY created_at ASC LIMIT 200`,
        groupId,
      );
      const messages = msgRows.map((r) => this.mapRawGroupMessage(r));
      return { groupId, messages };
    }

    const messages = Array.from(this.memGroupMessages.values())
      .filter((m) => m.groupId === groupId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { groupId, messages };
  }

  async sendGroupMessage(userId: string, groupId: string, dto: SendMessageDto) {
    await this.ensureGroupMember(groupId, userId);

    const cleanContent = dto.content ? sanitizeText(dto.content) : '';
    const imageUrl = dto.imageUrl?.trim() || null;
    const gifUrl = dto.gifUrl?.trim() || null;

    if (!cleanContent && !dto.movieTmdbId && !imageUrl && !gifUrl) {
      throw new BadRequestException('Сообщение не может быть пустым');
    }

    const msgId = crypto.randomUUID();
    const now = new Date();
    const payload = {
      id: msgId,
      groupId,
      senderId: userId,
      content: cleanContent,
      imageUrl,
      gifUrl,
      replyToId: dto.replyToId || null,
      replyToContent: dto.replyToContent ? sanitizeText(dto.replyToContent) : null,
      replyToSenderName: dto.replyToSenderName ? sanitizeText(dto.replyToSenderName) : null,
      editedAt: null,
      reactions: {},
      movieTmdbId: dto.movieTmdbId || null,
      movieMediaType: dto.movieMediaType || null,
      movieTitle: dto.movieTitle ? sanitizeText(dto.movieTitle) : null,
      moviePosterPath: dto.moviePosterPath || null,
      createdAt: now,
    };

    if (this.db) {
      await this.ensureGroupTables();
      await (this.db as any).$executeRawUnsafe(
        `INSERT INTO chat_group_messages (
          id, group_id, sender_id, content, image_url, gif_url,
          reply_to_id, reply_to_content, reply_to_sender_name,
          reactions, movie_tmdb_id, movie_media_type, movie_title, movie_poster_path, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15)`,
        payload.id,
        payload.groupId,
        payload.senderId,
        payload.content,
        payload.imageUrl,
        payload.gifUrl,
        payload.replyToId,
        payload.replyToContent,
        payload.replyToSenderName,
        '{}',
        payload.movieTmdbId,
        payload.movieMediaType,
        payload.movieTitle,
        payload.moviePosterPath,
        now,
      );
      return payload;
    }

    this.memGroupMessages.set(msgId, payload);
    return payload;
  }
}

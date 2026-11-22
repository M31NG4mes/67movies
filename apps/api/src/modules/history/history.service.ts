import { Injectable, Logger } from '@nestjs/common';
import { PlaybackSyncPayload, WatchProgress } from '@cinemaflow/types';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(private readonly redisService: RedisService) {}

  async syncProgress(profileId: string, payload: PlaybackSyncPayload): Promise<WatchProgress> {
    const percentage = payload.duration > 0
      ? Number(((payload.currentTime / payload.duration) * 100).toFixed(1))
      : 0;
    const isCompleted = payload.completed || percentage >= 92;

    const progress: WatchProgress = {
      id: `${profileId}-${payload.mediaId}-${payload.seasonNumber || 0}-${payload.episodeNumber || 0}`,
      profileId,
      mediaId: payload.mediaId,
      seasonNumber: payload.seasonNumber,
      episodeNumber: payload.episodeNumber,
      currentTime: payload.currentTime,
      duration: payload.duration,
      percentage,
      isCompleted,
      updatedAt: new Date().toISOString(),
    };

    const cacheKey = `history:${profileId}:${payload.mediaId}`;
    await this.redisService.set(cacheKey, progress, 86400 * 30); // 30 days retention

    // Also update profile's recent continue watching list
    const recentKey = `history:recent:${profileId}`;
    const recent = (await this.redisService.get<WatchProgress[]>(recentKey)) || [];
    const filtered = recent.filter(
      (item) =>
        !(
          item.mediaId === payload.mediaId &&
          item.seasonNumber === payload.seasonNumber &&
          item.episodeNumber === payload.episodeNumber
        )
    );

    filtered.unshift(progress);
    await this.redisService.set(recentKey, filtered.slice(0, 20), 86400 * 30);

    return progress;
  }

  async getProgress(profileId: string, mediaId: string): Promise<WatchProgress | null> {
    const cacheKey = `history:${profileId}:${mediaId}`;
    return this.redisService.get<WatchProgress>(cacheKey);
  }

  async getContinueWatching(profileId: string): Promise<WatchProgress[]> {
    const recentKey = `history:recent:${profileId}`;
    const recent = (await this.redisService.get<WatchProgress[]>(recentKey)) || [];
    // Only return items that are not completed and have progress > 1%
    return recent.filter((item) => !item.isCompleted && item.percentage > 1);
  }
}

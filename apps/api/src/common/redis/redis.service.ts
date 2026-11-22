import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memoryCache = new Map<string, { value: string; expiresAt: number }>();

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    try {
      const client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        reconnectOnError: () => false,
      });

      client.on('error', () => {
        // Handled via connect().catch() fallback to In-Memory cache
      });

      this.client = client;

      client
        .connect()
        .then(() => this.logger.log(`Connected to Redis at ${redisUrl}`))
        .catch(() => {
          this.logger.warn('Redis unavailable. Using In-Memory cache fallback.');
          client.disconnect();
          this.client = null;
        });
    } catch (err: any) {
      this.logger.warn(`Redis setup fallback to In-Memory: ${err.message}`);
      this.client = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.client) {
      try {
        const raw = await this.client.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch (e) {
        // Fallback to memory
      }
    }

    const cached = this.memoryCache.get(key);
    if (cached) {
      if (Date.now() > cached.expiresAt) {
        this.memoryCache.delete(key);
        return null;
      }
      return JSON.parse(cached.value) as T;
    }
    return null;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    const stringified = JSON.stringify(value);
    if (this.client) {
      try {
        await this.client.setex(key, ttlSeconds, stringified);
        return;
      } catch (e) {
        // Fallback to memory
      }
    }

    this.memoryCache.set(key, {
      value: stringified,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.del(key);
      } catch (e) {}
    }
    this.memoryCache.delete(key);
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

interface Bucket {
  timestamps: number[];
}

/**
 * Sliding-window IP rate limiter.
 * Applies a stricter bucket to sensitive auth endpoints to prevent brute-force attacks.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 60_000;

  private getLimit(path: string): { tier: string; max: number } {
    if (
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/forgot-password') ||
      path.includes('/auth/reset-password')
    ) {
      return {
        tier: 'auth',
        max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 25,
      };
    }
    return {
      tier: 'api',
      max: Number(process.env.RATE_LIMIT_MAX) || 240,
    };
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Allow health probes without consuming user budget
    if (req.originalUrl.endsWith('/api/health')) {
      return next();
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    const { tier, max } = this.getLimit(req.originalUrl);
    const key = `${tier}:${ip}`;
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

    if (bucket.timestamps.length >= max) {
      const oldest = bucket.timestamps[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        statusCode: 429,
        message: 'Слишком много запросов. Повторите попытку позже.',
        retryAfterSeconds: retryAfterSec,
      });
    }

    bucket.timestamps.push(now);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.timestamps.length)));
    return next();
  }
}

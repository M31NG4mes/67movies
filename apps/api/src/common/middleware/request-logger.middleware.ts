import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import * as crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from '../monitoring/metrics.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const requestId =
      (req.headers['x-request-id'] as string) || crypto.randomBytes(6).toString('hex');
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const status = res.statusCode;
      this.metrics.recordRequest(status, durationMs);

      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown';
      const line = `[${requestId}] ${req.method} ${req.originalUrl} ${status} ${durationMs}ms (${ip})`;

      if (status >= 500) {
        this.logger.error(line);
      } else if (status >= 400) {
        this.logger.warn(line);
      } else if (process.env.NODE_ENV !== 'test') {
        this.logger.log(line);
      }
    });

    next();
  }
}

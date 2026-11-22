import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppCacheService } from '../cache/cache.service';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService,
    private readonly metrics: MetricsService,
  ) {}

  @Get()
  async getHealth() {
    let dbStatus: 'connected' | 'local-fallback' | 'error' = 'local-fallback';
    if (this.prisma.client) {
      try {
        await this.prisma.client.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
      } catch {
        dbStatus = 'error';
      }
    }

    const snap = this.metrics.getSnapshot();
    return {
      status: dbStatus === 'error' ? 'degraded' : 'ok',
      service: '67movies-api',
      database: dbStatus,
      uptimeSeconds: snap.uptimeSeconds,
      timestamp: snap.timestamp,
    };
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  getMetrics() {
    return {
      ...this.metrics.getSnapshot(),
      cache: this.cache.getStats(),
    };
  }
}

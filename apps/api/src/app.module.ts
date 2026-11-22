import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AppCacheModule } from './common/cache/cache.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { RateLimitMiddleware } from './common/security/rate-limit.middleware';
import { MediaModule } from './modules/media/media.module';
import { ProxyModule } from './modules/proxy/proxy.module';
import { HistoryModule } from './modules/history/history.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SocialModule } from './modules/social/social.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    RedisModule,
    AppCacheModule,
    MonitoringModule,
    MediaModule,
    ProxyModule,
    HistoryModule,
    AuthModule,
    UsersModule,
    SocialModule,
    AdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware, RateLimitMiddleware).forRoutes('*');
  }
}

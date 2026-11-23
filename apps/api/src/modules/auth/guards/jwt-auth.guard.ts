import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { LocalStoreService } from '../../../common/storage/local-store.service';

export interface AuthJwtPayload {
  sub: string;
  email: string;
  name?: string;
  role: string;
  sid: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly localStore: LocalStoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Требуется авторизация (Bearer токен отсутствует)');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Пустой токен авторизации');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET', '67movies-dev-jwt-secret-change-in-prod');
      const payload = await this.jwtService.verifyAsync<AuthJwtPayload>(token, { secret });

      // Ensure user exists in localStore fallback if container redeployed
      if (payload.sub && !this.localStore.data.users[payload.sub]) {
        this.localStore.data.users[payload.sub] = {
          id: payload.sub,
          email: payload.email || '',
          name: payload.name || (payload.email ? payload.email.split('@')[0] : 'Пользователь'),
          passwordHash: '',
          role: (payload.role as 'USER' | 'ADMIN') || 'USER',
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        this.localStore.save();
      }

      request.user = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        sessionId: payload.sid,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Недействительный или просроченный токен доступа');
    }
  }
}

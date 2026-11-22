import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface AuthJwtPayload {
  sub: string;
  email: string;
  role: string;
  sid: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
      request.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sid,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Недействительный или просроченный токен доступа');
    }
  }
}

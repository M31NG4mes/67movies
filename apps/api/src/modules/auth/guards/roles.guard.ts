import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LocalStoreService } from '../../../common/storage/local-store.service';
import { AppRole, ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Server-side RBAC Guard.
 * Always verifies the user's LIVE role and active status directly against the database
 * (never trusts client UI state or potentially stale JWT role claims).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly localStore: LocalStoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authUser = request.user;
    if (!authUser?.userId) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    // Fetch live role & active status from PostgreSQL (or local store fallback)
    let liveRole: string | null = null;
    let isActive = true;

    const db = this.prisma.client;
    if (db) {
      const dbUser = await db.user.findUnique({
        where: { id: authUser.userId },
        select: { role: true, isActive: true },
      });
      if (!dbUser) {
        throw new UnauthorizedException('Учетная запись не найдена');
      }
      liveRole = dbUser.role;
      isActive = dbUser.isActive;
    } else {
      const memUser = this.localStore.data.users[authUser.userId];
      if (!memUser) {
        throw new UnauthorizedException('Учетная запись не найдена');
      }
      liveRole = memUser.role || 'USER';
      isActive = memUser.isActive !== false;
    }

    if (!isActive) {
      throw new ForbiddenException('Ваша учетная запись заблокирована администратором');
    }

    // Attach verified live role onto request.user for downstream handlers
    request.user.role = liveRole;

    if (!liveRole || !requiredRoles.includes(liveRole as AppRole)) {
      throw new ForbiddenException(
        `Недостаточно прав доступа. Требуется роль: ${requiredRoles.join(' или ')}`,
      );
    }

    return true;
  }
}

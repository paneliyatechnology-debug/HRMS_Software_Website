import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../../database/database.service.js';
import { Role } from '../../../common/types.js';
import { IS_PUBLIC_KEY } from '../../../common/guards/public.decorator.js';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();

    let user = req.user;

    if (!user) {
      const rawToken =
        req.headers?.authorization ||
        req.headers?.token ||
        req.query?.token;

      if (rawToken && typeof rawToken === 'string') {
        let clean = rawToken.trim().replace(/^["']+|["']+$/g, '').trim();
        if (clean.toLowerCase().startsWith('bearer ')) {
          clean = clean.substring(7).trim().replace(/^["']+|["']+$/g, '').trim();
        }

        if (clean && clean !== '{{bearerToken}}' && clean !== '{{token}}') {
          let identifier = clean;
          const match = clean.match(/jwt_token_([^_]+)/i);
          if (match && match[1]) {
            identifier = match[1];
          } else if (clean.startsWith('user-')) {
            identifier = clean.split('_')[0];
          }

          user = this.db.users.find(
            (u) =>
              u.id.toLowerCase() === identifier.toLowerCase() ||
              u.email.toLowerCase() === identifier.toLowerCase(),
          );
        }
      }
    }

    if (!user) {
      throw new UnauthorizedException(
        'Authentication required. Please provide a Super Admin token in Authorization header.',
      );
    }

    const isSuperAdmin = user.role === Role.SUPER_ADMIN || user.isSuperAdmin === true;
    if (!isSuperAdmin) {
      throw new ForbiddenException(
        `Access Denied: Your role is "${user.role}". Only Super Admin (badha thi uper) can access this resource.`,
      );
    }

    req.user = user;
    return true;
  }
}

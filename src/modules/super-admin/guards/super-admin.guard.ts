import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { Role } from '../../../common/types.js';
import { verifyAccessToken } from '../../../common/utils/jwt.util.js';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  canActivate(context: ExecutionContext): boolean {
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
          const payload = verifyAccessToken(clean);
          if (payload?.sub) {
            user = this.db.users.find((u) => u.id === payload.sub);
          }
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

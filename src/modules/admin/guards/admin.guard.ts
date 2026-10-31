import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { Role } from '../../../common/types.js';

@Injectable()
export class AdminGuard implements CanActivate {
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
          if (user) {
            req.user = user;
          }
        }
      }
    }

    if (!user) {
      throw new UnauthorizedException(
        'Authentication required. Please provide an Admin token in Authorization header.',
      );
    }

    const isAdmin =
      user.role === Role.ADMIN ||
      user.role === Role.SUPER_ADMIN ||
      user.isSuperAdmin === true;

    if (!isAdmin) {
      throw new ForbiddenException(
        `Access Denied: Your role is "${user.role}". Only Company Administrators (ADMIN) and Super Administrators can access this resource.`,
      );
    }

    return true;
  }
}


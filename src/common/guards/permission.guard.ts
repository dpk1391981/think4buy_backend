import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { RbacService } from '../../modules/rbac/rbac.service';

/**
 * Checks that the JWT-authenticated user holds all required permissions.
 *
 * Resolution order:
 *  1. No permissions declared → pass through (guard is a no-op)
 *  2. isSuperAdmin = true → allow all (bypass DB check)
 *  3. Load user's permissions via RbacService (cached, TTL 5 min)
 *  4. Require ALL declared permissions to be present
 *
 * Attach after AuthGuard('jwt') so `req.user` is populated:
 *   @UseGuards(AuthGuard('jwt'), PermissionGuard)
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const req  = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) throw new ForbiddenException('Authentication required');

    // Super admins bypass all permission checks
    if (user.isSuperAdmin) return true;

    const userPerms = await this.rbac.getUserPermissions(user.id, false);

    const missing = required.filter(p => !userPerms.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permission${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}

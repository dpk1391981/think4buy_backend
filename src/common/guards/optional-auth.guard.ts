import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like the standard JWT guard but never throws — if no token is present or
 * the token is invalid, `req.user` is simply left as `undefined`.
 * Use on endpoints that work for both guests and authenticated users.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  // Always allow the request through
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // Suppress the UnauthorizedException that the default guard throws
  handleRequest(_err: any, user: any) {
    return user ?? null;
  }
}

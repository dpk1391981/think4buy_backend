import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * BFF-Only Middleware
 * ─────────────────────────────────────────────────────────────────────────────
 * Enforces that all non-webhook, non-auth requests originate from the
 * Next.js BFF layer, not directly from a browser.
 *
 * Mechanism:
 *   Next.js server-side code sends X-BFF-Secret header with a shared secret.
 *   Browsers never see this header — it lives only in server env vars.
 *
 * Enable by setting:
 *   ENABLE_BFF_GUARD=true
 *   BFF_INTERNAL_SECRET=<random 32-char secret>
 *
 * Bypass paths (always public):
 *   - /api/v1/auth/* (login, register, token refresh)
 *   - /api/v1/webhooks/* (Razorpay/Stripe webhooks — use their own sig)
 *   - /api/v1/health
 *
 * In development (NODE_ENV !== 'production'), the guard is always skipped.
 */
@Injectable()
export class BffOnlyMiddleware implements NestMiddleware {
  private readonly logger = new Logger('BffOnlyGuard');

  private readonly BYPASS_PREFIXES = [
    '/api/v1/auth',
    '/api/v1/webhooks',
    '/api/v1/health',
  ];

  private readonly secret = process.env.BFF_INTERNAL_SECRET ?? '';
  private readonly enabled =
    process.env.ENABLE_BFF_GUARD === 'true' &&
    process.env.NODE_ENV === 'production';

  use(req: Request, _res: Response, next: NextFunction): void {
    if (!this.enabled) return next();
    if (!this.secret) {
      this.logger.warn('BFF guard enabled but BFF_INTERNAL_SECRET is not set — bypassing');
      return next();
    }

    // Bypass public/webhook paths
    const isBypass = this.BYPASS_PREFIXES.some((p) => req.path.startsWith(p));
    if (isBypass) return next();

    const incoming = req.headers['x-bff-secret'] as string | undefined;
    if (!incoming || incoming !== this.secret) {
      this.logger.warn(
        `Direct API access blocked: ${req.method} ${req.path} from ${req.ip}`,
      );
      throw new ForbiddenException('Direct API access is not allowed');
    }

    next();
  }
}

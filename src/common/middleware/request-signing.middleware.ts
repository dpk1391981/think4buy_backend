import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHmac } from 'crypto';

/**
 * HMAC Request Signing Middleware
 * ─────────────────────────────────────────────────────────────
 * Protects internal service-to-service APIs from spoofing.
 *
 * Clients must send:
 *   X-API-KEY   : the API key (identifies the caller)
 *   X-TIMESTAMP : Unix timestamp (seconds)
 *   X-SIGNATURE : HMAC-SHA256 of `METHOD:PATH:TIMESTAMP` using the shared secret
 *
 * Requests with:
 *   - missing headers      → 401
 *   - unknown API key      → 401
 *   - timestamp drift >5m  → 401 (replay attack protection)
 *   - invalid signature    → 401
 *
 * Only applied to routes under /api/v1/internal/*
 * Set ENABLE_REQUEST_SIGNING=true in env to activate.
 */
@Injectable()
export class RequestSigningMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestSigning');
  private readonly TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

  /** Map of apiKey → secret. In production load from Redis or DB. */
  private readonly API_KEYS: Record<string, string> = {
    [process.env.INTERNAL_API_KEY ?? 'dev-key']:
      process.env.INTERNAL_API_SECRET ?? 'dev-secret',
  };

  use(req: Request, _res: Response, next: NextFunction) {
    if (process.env.ENABLE_REQUEST_SIGNING !== 'true') return next();

    const apiKey    = req.headers['x-api-key']   as string;
    const timestamp = req.headers['x-timestamp'] as string;
    const signature = req.headers['x-signature'] as string;

    if (!apiKey || !timestamp || !signature) {
      throw new UnauthorizedException('Missing request signing headers');
    }

    const secret = this.API_KEYS[apiKey];
    if (!secret) {
      this.logger.warn(`Unknown API key: ${apiKey} from IP ${req.ip}`);
      throw new UnauthorizedException('Invalid API key');
    }

    // Replay attack: reject stale timestamps
    const tsMs = parseInt(timestamp, 10) * 1000;
    if (Math.abs(Date.now() - tsMs) > this.TOLERANCE_MS) {
      this.logger.warn(`Replay attack detected — stale timestamp from ${req.ip}`);
      throw new UnauthorizedException('Request timestamp expired');
    }

    // Verify HMAC: sign(METHOD:PATH:TIMESTAMP)
    const payload  = `${req.method}:${req.path}:${timestamp}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (!this.timingSafeEqual(signature, expected)) {
      this.logger.warn(`Invalid signature from ${req.ip} for ${req.method} ${req.path}`);
      throw new UnauthorizedException('Invalid request signature');
    }

    next();
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }
}

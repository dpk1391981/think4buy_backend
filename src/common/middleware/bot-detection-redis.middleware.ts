import { Injectable, NestMiddleware, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { Redis } from 'ioredis';

/**
 * Redis-Backed Bot Detection & Rate Limiting
 * ─────────────────────────────────────────────────────────────────────────────
 * Production replacement for BotDetectionMiddleware.
 * Uses Redis INCR + EXPIRE for sliding window rate limiting that works
 * across multiple app instances.
 *
 * Enable by setting REDIS_URL in env.
 * Falls back to in-memory if Redis is unavailable (graceful degradation).
 *
 * Rate tiers (per IP, per 60s window):
 *   - Default public endpoints: 120 req/min
 *   - Property search/listings: 60 req/min
 *   - Auth endpoints: handled by ThrottlerModule separately
 *
 * Fingerprinting:
 *   SHA-256(ip|ua|accept-language) → 16-char hex
 *   Stored in req.fingerprint for audit logging.
 */
@Injectable()
export class BotDetectionRedisMiddleware implements NestMiddleware {
  private readonly logger = new Logger('BotDetection');
  private redis: Redis | null = null;

  // In-memory fallback when Redis is unavailable
  private readonly memWindows = new Map<string, { count: number; resetAt: number }>();

  private readonly BAD_UA_PATTERNS = [
    /python-requests/i, /scrapy/i, /wget/i, /curl\//i,
    /libwww-perl/i, /go-http-client/i, /java\//i,
    /node-fetch/i, /playwright/i, /puppeteer/i,
    /selenium/i, /PhantomJS/i, /HeadlessChrome/i,
  ];

  private readonly RATE_LIMITS: { prefix: string; limit: number }[] = [
    { prefix: '/api/v1/properties', limit: 60 },
    { prefix: '/api/v1/locations',  limit: 60 },
    { prefix: '/api/v1/seo',        limit: 30 },
  ];

  private readonly DEFAULT_LIMIT  = 120;
  private readonly WINDOW_SECONDS = 60;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, { lazyConnect: true, enableOfflineQueue: false });
      this.redis.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const ua = req.headers['user-agent'] ?? '';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';

    // 1. Block known bad User-Agents
    if (this.BAD_UA_PATTERNS.some((p) => p.test(ua))) {
      this.logger.warn(`Bot UA blocked: "${ua.slice(0, 80)}" from ${ip}`);
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }

    // 2. Require basic browser headers on data endpoints
    const isDataEndpoint = this.RATE_LIMITS.some((r) => req.path.startsWith(r.prefix));
    if (isDataEndpoint && (!req.headers['accept'] || !req.headers['accept-language'])) {
      this.logger.warn(`Missing browser headers from ${ip}`);
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }

    // 3. Rate limiting
    const limit = this.RATE_LIMITS.find((r) => req.path.startsWith(r.prefix))?.limit
      ?? this.DEFAULT_LIMIT;

    const allowed = await this.checkRateLimit(ip, limit);
    if (!allowed) {
      this.logger.warn(`Rate limit exceeded: ${ip} on ${req.path}`);
      res.setHeader('Retry-After', String(this.WINDOW_SECONDS));
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 4. Fingerprint for audit trail
    req['fingerprint'] = createHash('sha256')
      .update(`${ip}|${ua}|${req.headers['accept-language'] ?? ''}`)
      .digest('hex')
      .slice(0, 16);

    next();
  }

  private async checkRateLimit(ip: string, limit: number): Promise<boolean> {
    const key = `bot:rl:${ip}`;

    if (this.redis) {
      try {
        const pipeline = this.redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, this.WINDOW_SECONDS);
        const results = await pipeline.exec();
        const count = results?.[0]?.[1] as number;
        return count <= limit;
      } catch {
        // Redis error — fall through to in-memory
      }
    }

    // In-memory fallback
    const now = Date.now();
    const win = this.memWindows.get(ip);
    if (!win || now > win.resetAt) {
      this.memWindows.set(ip, { count: 1, resetAt: now + this.WINDOW_SECONDS * 1000 });
      return true;
    }
    win.count++;
    return win.count <= limit;
  }
}

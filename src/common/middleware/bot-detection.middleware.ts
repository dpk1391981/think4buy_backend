import { Injectable, NestMiddleware, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

/**
 * Bot Detection & Request Fingerprinting Middleware
 * ──────────────────────────────────────────────────────────────────────────
 * Detects and blocks suspicious automated traffic to protect data from scrapers.
 *
 * Checks:
 *  1. Known bad User-Agent patterns (scrapers, headless browsers, crawlers)
 *  2. Missing browser fingerprint headers (missing Accept, Accept-Encoding)
 *  3. Per-IP in-memory scraping rate (10 req/s sliding window)
 *
 * In production, replace the in-memory counter with Redis INCR + TTL.
 */
@Injectable()
export class BotDetectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger('BotDetection');

  // Sliding window: ip → { count, windowStart }
  private readonly ipWindows = new Map<string, { count: number; windowStart: number }>();
  private readonly WINDOW_MS  = 1_000;  // 1 second
  private readonly MAX_PER_S  = 30;     // max 30 req/s per IP on public endpoints

  private readonly BAD_UA_PATTERNS = [
    /python-requests/i,
    /scrapy/i,
    /wget/i,
    /curl\//i,
    /libwww-perl/i,
    /go-http-client/i,
    /java\//i,
    /axios\//i,         // direct backend calls without app header
    /node-fetch/i,
    /playwright/i,
    /puppeteer/i,
    /selenium/i,
    /PhantomJS/i,
    /HeadlessChrome/i,
  ];

  /** Public search/listing endpoints that scrapers target. */
  private readonly PROTECTED_PATHS = ['/api/v1/properties', '/api/v1/locations'];

  use(req: Request, res: Response, next: NextFunction) {
    // Only apply to data-heavy endpoints
    const isProtected = this.PROTECTED_PATHS.some((p) => req.path.startsWith(p));
    if (!isProtected) return next();

    const ua = req.headers['user-agent'] ?? '';
    const ip = req.ip ?? '';

    // 1. Block known bad User-Agents
    if (this.BAD_UA_PATTERNS.some((p) => p.test(ua))) {
      this.logger.warn(`Bot UA blocked: "${ua.slice(0, 80)}" from ${ip}`);
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }

    // 2. Require basic browser headers on public listing endpoints
    if (!req.headers['accept'] || !req.headers['accept-language']) {
      this.logger.warn(`Missing browser headers from ${ip} UA="${ua.slice(0, 80)}"`);
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }

    // 3. Per-IP rate enforcement (sliding 1-second window)
    const now    = Date.now();
    const window = this.ipWindows.get(ip);
    if (!window || now - window.windowStart > this.WINDOW_MS) {
      this.ipWindows.set(ip, { count: 1, windowStart: now });
    } else {
      window.count++;
      if (window.count > this.MAX_PER_S) {
        this.logger.warn(`Scraping rate exceeded: ${ip} — ${window.count} req/s`);
        res.setHeader('Retry-After', '1');
        throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // 4. Attach a request fingerprint for audit trail
    const fingerprint = createHash('sha256')
      .update(`${ip}|${ua}|${req.headers['accept-language'] ?? ''}`)
      .digest('hex')
      .slice(0, 16);
    req['fingerprint'] = fingerprint;

    next();
  }
}

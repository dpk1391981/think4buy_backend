import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Cache Invalidation Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Called after property/agent create, update, or delete to purge stale
 * BFF cache entries and optionally trigger Cloudflare cache purge.
 *
 * Configure:
 *   FRONTEND_INTERNAL_URL=http://localhost:3000
 *   CACHE_INVALIDATE_SECRET=<same value as Next.js CACHE_INVALIDATE_SECRET>
 *   CF_ZONE_ID=your-cloudflare-zone-id          (optional)
 *   CF_API_TOKEN=your-cloudflare-api-token       (optional)
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger('CacheInvalidation');
  private readonly frontendUrl = process.env.FRONTEND_INTERNAL_URL ?? 'http://localhost:3000';
  private readonly secret      = process.env.CACHE_INVALIDATE_SECRET ?? '';
  private readonly cfZoneId    = process.env.CF_ZONE_ID   ?? '';
  private readonly cfApiToken  = process.env.CF_API_TOKEN ?? '';

  /** Call after any property create/update/delete */
  async invalidateProperties(): Promise<void> {
    await this.notifyBff('properties');
    await this.purgeCloudflarePattern(['/property-*', '/api/bff/properties*']);
  }

  /** Call after any agent profile update */
  async invalidateAgents(): Promise<void> {
    await this.notifyBff('agents');
    await this.purgeCloudflarePattern(['/agents-in/*', '/api/bff/agents*']);
  }

  /** Call after SEO config changes */
  async invalidateSeo(): Promise<void> {
    await this.notifyBff('seo');
    await this.purgeCloudflarePattern(['/property-in-*', '/agents-in-*']);
  }

  private async notifyBff(resource: string): Promise<void> {
    if (!this.secret) return;
    try {
      const res = await fetch(`${this.frontendUrl}/api/bff/cache-invalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource, secret: this.secret }),
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        this.logger.log(`BFF cache invalidated: ${resource}`);
      } else {
        this.logger.warn(`BFF cache invalidation failed: ${res.status}`);
      }
    } catch (err: any) {
      this.logger.warn(`BFF cache invalidation error: ${err.message}`);
    }
  }

  private async purgeCloudflarePattern(patterns: string[]): Promise<void> {
    if (!this.cfZoneId || !this.cfApiToken) return;
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.cfZoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prefixes: patterns }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const json = await res.json() as any;
      if (json.success) {
        this.logger.log(`Cloudflare cache purged: ${patterns.join(', ')}`);
      } else {
        this.logger.warn(`Cloudflare purge failed: ${JSON.stringify(json.errors)}`);
      }
    } catch (err: any) {
      this.logger.warn(`Cloudflare purge error: ${err.message}`);
    }
  }
}

import { createHmac } from 'crypto';

/**
 * Signed / Expiring CDN URL Generator
 * ──────────────────────────────────────────────────────────────────────────────
 * Prevents property images from being hotlinked or bulk-downloaded by scrapers.
 *
 * How it works:
 *   1. Append `?expires=<unix-ts>&sig=<hmac-sha256>` to every CDN URL
 *   2. Nginx / CDN edge validates the sig and rejects expired/forged URLs
 *   3. Default TTL: 1 hour (configurable via CDN_URL_TTL_SECONDS)
 *
 * Nginx lua/openresty validation example (pseudo-code):
 *   local sig   = ngx.var.arg_sig
 *   local exp   = ngx.var.arg_expires
 *   local path  = ngx.var.uri
 *   local expected = hmac_sha256(CDN_SIGNING_SECRET, path .. ":" .. exp)
 *   if sig ~= expected or now > exp then ngx.exit(403) end
 *
 * Usage:
 *   SignedUrl.sign('/uploads/properties/image.jpg')
 *   → 'https://cdn.example.com/uploads/properties/image.jpg?expires=1700000000&sig=abc123'
 */
export class SignedUrlUtil {
  private static readonly SECRET =
    process.env.CDN_SIGNING_SECRET ?? 'cdn-signing-secret-change-me';
  private static readonly CDN_BASE =
    process.env.CDN_BASE_URL ?? process.env.APP_URL ?? 'http://localhost:3001';
  private static readonly TTL =
    parseInt(process.env.CDN_URL_TTL_SECONDS ?? '3600', 10);

  static sign(path: string, ttlSeconds?: number): string {
    const expires = Math.floor(Date.now() / 1000) + (ttlSeconds ?? this.TTL);
    const sig = createHmac('sha256', this.SECRET)
      .update(`${path}:${expires}`)
      .digest('hex')
      .slice(0, 32); // 32-char hex is sufficient for CDN validation

    const base = path.startsWith('http') ? path : `${this.CDN_BASE}${path}`;
    return `${base}?expires=${expires}&sig=${sig}`;
  }

  static verify(path: string, expires: string, sig: string): boolean {
    const exp = parseInt(expires, 10);
    if (isNaN(exp) || Math.floor(Date.now() / 1000) > exp) return false;

    const expected = createHmac('sha256', this.SECRET)
      .update(`${path}:${expires}`)
      .digest('hex')
      .slice(0, 32);

    // Constant-time comparison
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  }

  /**
   * Sign all image URLs in a property response object.
   * Call this before sending any property data to the client.
   */
  static signPropertyImages<T extends { images?: Array<{ url?: string }> }>(property: T): T {
    if (!property.images) return property;
    return {
      ...property,
      images: property.images.map((img) => ({
        ...img,
        url: img.url ? this.sign(img.url) : img.url,
      })),
    };
  }
}

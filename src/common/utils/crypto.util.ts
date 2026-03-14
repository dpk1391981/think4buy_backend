import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * AES-256-GCM Field-Level Encryption Utility
 * ──────────────────────────────────────────────────────────────────────────────
 * Encrypts sensitive PII fields (email, phone, name on leads) before DB storage.
 *
 * Format stored in DB:
 *   iv:authTag:ciphertext  (all hex-encoded, colon-delimited)
 *
 * Usage:
 *   const enc = CryptoUtil.encrypt('user@example.com');
 *   const plain = CryptoUtil.decrypt(enc); // 'user@example.com'
 *
 * Key derivation: scrypt(FIELD_ENCRYPTION_KEY, FIELD_ENCRYPTION_SALT, 32)
 * This ensures the stored key is always 32 bytes regardless of env var length.
 *
 * Set in .env:
 *   FIELD_ENCRYPTION_KEY=your-random-32-char-or-longer-key
 *   FIELD_ENCRYPTION_SALT=your-random-salt-value
 */
export class CryptoUtil {
  private static _key: Buffer | null = null;

  private static getKey(): Buffer {
    if (this._key) return this._key;
    const raw  = process.env.FIELD_ENCRYPTION_KEY  ?? 'fallback-key-change-in-production';
    const salt = process.env.FIELD_ENCRYPTION_SALT ?? 'fallback-salt';
    this._key  = scryptSync(raw, salt, 32) as Buffer;
    return this._key;
  }

  static encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;
    const key = this.getKey();
    const iv  = randomBytes(12); // 96-bit IV for GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  static decrypt(ciphertext: string): string {
    if (!ciphertext || !ciphertext.includes(':')) return ciphertext; // not encrypted
    try {
      const [ivHex, authTagHex, encHex] = ciphertext.split(':');
      const key    = this.getKey();
      const iv     = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const enc    = Buffer.from(encHex, 'hex');

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      return decipher.update(enc).toString('utf8') + decipher.final('utf8');
    } catch {
      return '[encrypted]'; // never throw on decrypt failure
    }
  }

  /** Mask a value for partial display (e.g. show last 4 digits of phone) */
  static mask(value: string, visibleChars = 4): string {
    if (!value || value.length <= visibleChars) return '****';
    return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
  }

  /** Mask email: j***@example.com */
  static maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '****';
    return `${local[0]}***@${domain}`;
  }
}

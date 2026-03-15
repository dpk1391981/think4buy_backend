import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// ── Constants ────────────────────────────────────────────────────────────────

/** Absolute path to the uploads root. All stored files live under here. */
const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

/** Maximum output width in pixels — wider images are scaled down proportionally. */
const MAX_WIDTH = 1920;

/** WebP compression quality (0–100). 80 gives a good size/quality balance. */
const WEBP_QUALITY = 80;

/** Hard limit on images per batch upload. */
const MAX_BATCH = 20;

/**
 * Magic-byte signatures for each accepted MIME type.
 * Each entry is an array of possible signatures (some formats have multiple).
 * We compare the first N bytes of the uploaded buffer against these values.
 */
const MAGIC: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png':  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (bytes 8–11 spell "WEBP")
};

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ImageUploadService {
  private readonly logger = new Logger(ImageUploadService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Validate, convert to WebP, compress, and save a single image.
   *
   * @param file       Multer file object (buffer must be populated — memory storage only)
   * @param folder     Top-level folder inside `uploads/`  e.g. `'avatars'`
   * @param subFolder  Optional sub-directory  e.g. a property UUID.
   *                   Any characters that could enable path traversal are stripped.
   * @returns          Full public URL:  `{PUBLIC_API_URL}/uploads/{folder}/{filename}.webp`
   */
  async saveImage(
    file: Express.Multer.File,
    folder: string,
    subFolder?: string,
  ): Promise<string> {
    this.assertMagicBytes(file.buffer, file.mimetype);

    const dir = this.resolveDir(folder, subFolder);
    await fs.mkdir(dir, { recursive: true });

    const filename = `${uuidv4()}.webp`;
    const dest = this.safeDest(dir, filename);
    const processed = await this.processImage(file.buffer);
    await fs.writeFile(dest, processed);

    return this.publicUrl(folder, subFolder, filename);
  }

  /**
   * Validate, convert, and save multiple images in parallel.
   * Enforces a MAX_BATCH ceiling.
   *
   * @returns  Array of public URLs in the same order as the input files.
   */
  async saveImages(
    files: Express.Multer.File[],
    folder: string,
    subFolder?: string,
  ): Promise<string[]> {
    if (files.length > MAX_BATCH) {
      throw new BadRequestException(
        `A maximum of ${MAX_BATCH} images can be uploaded at once.`,
      );
    }

    const dir = this.resolveDir(folder, subFolder);
    await fs.mkdir(dir, { recursive: true });

    return Promise.all(
      files.map(async (file) => {
        this.assertMagicBytes(file.buffer, file.mimetype);
        const filename = `${uuidv4()}.webp`;
        const dest = this.safeDest(dir, filename);
        const processed = await this.processImage(file.buffer);
        await fs.writeFile(dest, processed);
        return this.publicUrl(folder, subFolder, filename);
      }),
    );
  }

  /**
   * Delete an image from disk using its public URL.
   * Silently ignores missing files; logs a warning if the path would escape
   * the uploads root (path-traversal guard).
   */
  async deleteByUrl(url: string): Promise<void> {
    const base = this.config.get<string>('PUBLIC_API_URL', '').replace(/\/$/, '');
    const relativePath = url.replace(base, '').replace(/^\//, '');
    const fullPath = path.resolve(process.cwd(), relativePath);

    if (!fullPath.startsWith(UPLOADS_ROOT + path.sep)) {
      this.logger.warn(`Blocked delete attempt outside uploads root: ${fullPath}`);
      return;
    }

    try {
      await fs.unlink(fullPath);
    } catch {
      this.logger.warn(`File not found on disk, skipping deletion: ${fullPath}`);
    }
  }

  // ── Image processing ─────────────────────────────────────────────────────

  /**
   * Run an image buffer through the Sharp pipeline:
   *   1. Auto-rotate based on EXIF orientation
   *   2. Scale down to MAX_WIDTH if wider (preserves aspect ratio)
   *   3. Convert to WebP at WEBP_QUALITY
   *
   * Metadata (EXIF, XMP, IPTC) is stripped by default when `.withMetadata()`
   * is omitted — no GPS coordinates or camera model leak to the public.
   */
  private async processImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .rotate()                                            // honour EXIF orientation, then discard it
      .resize({ width: MAX_WIDTH, withoutEnlargement: true }) // only downscale
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  }

  // ── Security helpers ─────────────────────────────────────────────────────

  /**
   * Compare the first bytes of `buffer` against known magic-byte signatures
   * for the declared `mimetype`.  Rejects files where the content does not
   * match the Content-Type header (e.g. a PHP file renamed to image.jpg).
   */
  private assertMagicBytes(buffer: Buffer, mimetype: string): void {
    const signatures = MAGIC[mimetype];
    if (!signatures) {
      throw new BadRequestException(`Unsupported MIME type: ${mimetype}`);
    }

    const valid = signatures.some((sig) =>
      sig.every((byte, i) => buffer[i] === byte),
    );

    if (!valid) {
      throw new BadRequestException(
        'File content does not match its declared MIME type. Upload rejected.',
      );
    }
  }

  /**
   * Build the absolute upload directory for a given folder / subFolder pair.
   * `subFolder` is sanitised: only `[a-zA-Z0-9_-]` characters are kept, so
   * a property ID like `../../etc` becomes an empty string rather than a
   * path-traversal vector.
   */
  private resolveDir(folder: string, subFolder?: string): string {
    const safe = subFolder?.replace(/[^a-zA-Z0-9_-]/g, '') ?? '';
    return safe
      ? path.join(UPLOADS_ROOT, folder, safe)
      : path.join(UPLOADS_ROOT, folder);
  }

  /**
   * Resolve the final file path and verify it is still inside UPLOADS_ROOT.
   * Acts as a second path-traversal fence after `resolveDir`.
   */
  private safeDest(dir: string, filename: string): string {
    const resolved = path.resolve(dir, filename);
    if (!resolved.startsWith(UPLOADS_ROOT + path.sep)) {
      throw new BadRequestException('Path traversal detected — upload rejected.');
    }
    return resolved;
  }

  /**
   * Assemble the full public URL that the frontend will use to display the image.
   * Reads `PUBLIC_API_URL` from the environment (e.g. `https://reales-api.vtechxhub.com`).
   *
   * Example output: `https://reales-api.vtechxhub.com/uploads/properties/abc-123/7f92e7d3.webp`
   */
  private publicUrl(
    folder: string,
    subFolder: string | undefined,
    filename: string,
  ): string {
    const base = this.config.get<string>('PUBLIC_API_URL', '').replace(/\/$/, '');
    const parts = ['uploads', folder, subFolder, filename].filter(
      (p): p is string => Boolean(p),
    );
    return `${base}/${parts.join('/')}`;
  }
}

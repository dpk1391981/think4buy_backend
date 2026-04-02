import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { StorageConfigService } from '../storage-config/storage-config.service';

// ── Constants ────────────────────────────────────────────────────────────────

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
const MAX_WIDTH     = 1920;
const WEBP_QUALITY  = 80;
const MAX_BATCH     = 20;

const MAGIC: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png':  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
};

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ImageUploadService {
  private readonly logger = new Logger(ImageUploadService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storageConfig: StorageConfigService,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  async saveImage(
    file: Express.Multer.File,
    folder: string,
    subFolder?: string,
  ): Promise<string> {
    this.assertMagicBytes(file.buffer, file.mimetype);
    const processed = await this.processImage(file.buffer);
    const filename = `${uuidv4()}.webp`;
    return this.store(processed, folder, subFolder, filename);
  }

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
    return Promise.all(
      files.map(async (file) => {
        this.assertMagicBytes(file.buffer, file.mimetype);
        const processed = await this.processImage(file.buffer);
        const filename = `${uuidv4()}.webp`;
        return this.store(processed, folder, subFolder, filename);
      }),
    );
  }

  /**
   * Save original files without any Sharp processing.
   * Used by the async media pipeline — BullMQ will process variants later.
   * Returns absolute local paths (or S3 URLs) for each file.
   */
  async saveOriginalFiles(
    files: Express.Multer.File[],
    folder: string,
    subFolder?: string,
  ): Promise<{ url: string; sizeBytes: number }[]> {
    if (files.length > MAX_BATCH) {
      throw new BadRequestException(`A maximum of ${MAX_BATCH} files can be uploaded at once.`);
    }
    return Promise.all(
      files.map(async (file) => {
        this.assertMagicBytes(file.buffer, file.mimetype);
        const ext      = file.originalname.split('.').pop()?.toLowerCase() ?? 'bin';
        const filename = `${uuidv4()}.${ext}`;
        const url      = await this.store(file.buffer, folder, subFolder, filename);
        return { url, sizeBytes: file.buffer.length };
      }),
    );
  }

  async savePdf(file: Express.Multer.File, subFolder: string): Promise<string> {
    const pdfMagic = [0x25, 0x50, 0x44, 0x46];
    const valid = pdfMagic.every((byte, i) => file.buffer[i] === byte);
    if (!valid) {
      throw new BadRequestException('File content does not appear to be a valid PDF.');
    }

    const s3 = await this.storageConfig.getS3Settings();
    const filename = `${uuidv4()}.pdf`;
    const key = ['brochures', subFolder, filename].filter(Boolean).join('/');

    if (s3.enabled && s3.bucket && s3.accessKey && s3.secretKey) {
      return this.uploadToS3(file.buffer, key, 'application/pdf', s3);
    }

    const dir = this.resolveDir('brochures', subFolder);
    await fs.mkdir(dir, { recursive: true });
    const dest = this.safeDest(dir, filename);
    await fs.writeFile(dest, file.buffer);
    return this.localUrl('brochures', subFolder, filename);
  }

  /**
   * Fetch the raw bytes of a stored document URL (local file or remote S3/CDN).
   * Used by controllers to proxy KYC documents through the backend.
   */
  async fetchDocumentBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    const publicBase = this.config.get<string>('PUBLIC_API_URL', '').replace(/\/$/, '');

    // Local file served by this server
    if (publicBase && url.startsWith(publicBase)) {
      const rel = url.replace(publicBase, '').replace(/^\//, '');
      const fullPath = path.resolve(process.cwd(), rel);
      if (!fullPath.startsWith(UPLOADS_ROOT + path.sep)) {
        throw new NotFoundException('Document path is not accessible');
      }
      try {
        const buffer = await fs.readFile(fullPath);
        return { buffer, contentType: 'image/webp' };
      } catch {
        throw new NotFoundException('File not found on disk');
      }
    }

    // Remote URL (S3 / CDN) — fetch and buffer
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      mod.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new NotFoundException('Could not fetch document from storage'));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({
          buffer: Buffer.concat(chunks),
          contentType: res.headers['content-type'] || 'image/webp',
        }));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  async deleteByUrl(url: string): Promise<void> {
    const s3 = await this.storageConfig.getS3Settings();

    if (s3.enabled && s3.bucket && s3.accessKey && s3.secretKey) {
      const s3Prefix = s3.cdnUrl
        ? s3.cdnUrl.replace(/\/$/, '')
        : `https://${s3.bucket}.s3.${s3.region}.amazonaws.com`;

      if (url.startsWith(s3Prefix)) {
        const key = url.replace(s3Prefix + '/', '');
        try {
          const client = this.buildS3Client(s3);
          await client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));
        } catch (err) {
          this.logger.warn(`S3 delete failed for ${url}: ${err}`);
        }
        return;
      }
    }

    // Local delete
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

  // ── Core routing: S3 vs local ─────────────────────────────────────────────

  private async store(
    buffer: Buffer,
    folder: string,
    subFolder: string | undefined,
    filename: string,
  ): Promise<string> {
    const s3 = await this.storageConfig.getS3Settings();

    if (s3.enabled && s3.bucket && s3.accessKey && s3.secretKey) {
      const key = [folder, subFolder, filename].filter(Boolean).join('/');
      return this.uploadToS3(buffer, key, 'image/webp', s3);
    }

    const dir = this.resolveDir(folder, subFolder);
    await fs.mkdir(dir, { recursive: true });
    const dest = this.safeDest(dir, filename);
    await fs.writeFile(dest, buffer);
    return this.localUrl(folder, subFolder, filename);
  }

  private async uploadToS3(
    body: Buffer,
    key: string,
    contentType: string,
    s3: Awaited<ReturnType<StorageConfigService['getS3Settings']>>,
  ): Promise<string> {
    const client = this.buildS3Client(s3);
    const upload = new Upload({
      client,
      params: {
        Bucket: s3.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read' as any,
      },
    });
    await upload.done();

    const base = s3.cdnUrl
      ? s3.cdnUrl.replace(/\/$/, '')
      : `https://${s3.bucket}.s3.${s3.region}.amazonaws.com`;
    return `${base}/${key}`;
  }

  private buildS3Client(
    s3: Awaited<ReturnType<StorageConfigService['getS3Settings']>>,
  ): S3Client {
    return new S3Client({
      region: s3.region,
      credentials: {
        accessKeyId:     s3.accessKey,
        secretAccessKey: s3.secretKey,
      },
    });
  }

  // ── Image processing ──────────────────────────────────────────────────────

  private async processImage(buffer: Buffer): Promise<Buffer> {
    const wm = await this.storageConfig.getWatermarkSettings();

    const resized = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    if (wm.enabled && wm.text) {
      return this.applyWatermark(resized, wm.text);
    }

    return resized;
  }

  /**
   * Burn a text watermark onto the image using an SVG composite overlay.
   * Renders at bottom-right, semi-transparent with a dark pill background.
   */
  private async applyWatermark(buffer: Buffer, text: string): Promise<Buffer> {
    const meta = await sharp(buffer).metadata();
    const width  = meta.width  ?? 800;
    const height = meta.height ?? 600;

    const fontSize = Math.max(14, Math.min(36, Math.round(width / 25)));
    const padding  = Math.round(fontSize * 0.8);

    const safeText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const svgWidth  = Math.round(safeText.length * fontSize * 0.6) + padding * 2;
    const svgHeight = fontSize + padding * 2;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
  <rect width="${svgWidth}" height="${svgHeight}" rx="4" fill="rgba(0,0,0,0.40)"/>
  <text x="${svgWidth / 2}" y="${svgHeight / 2 + fontSize * 0.35}"
    font-family="Arial,Helvetica,sans-serif"
    font-size="${fontSize}" font-weight="bold"
    text-anchor="middle" fill="rgba(255,255,255,0.90)">${safeText}</text>
</svg>`;

    return sharp(buffer)
      .composite([{
        input: Buffer.from(svg),
        top:  height - svgHeight - padding,
        left: width  - svgWidth  - padding,
      }])
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  }

  // ── Security helpers ──────────────────────────────────────────────────────

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

  private resolveDir(folder: string, subFolder?: string): string {
    const safe = subFolder?.replace(/[^a-zA-Z0-9_-]/g, '') ?? '';
    return safe
      ? path.join(UPLOADS_ROOT, folder, safe)
      : path.join(UPLOADS_ROOT, folder);
  }

  private safeDest(dir: string, filename: string): string {
    const resolved = path.resolve(dir, filename);
    if (!resolved.startsWith(UPLOADS_ROOT + path.sep)) {
      throw new BadRequestException('Path traversal detected — upload rejected.');
    }
    return resolved;
  }

  private localUrl(
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

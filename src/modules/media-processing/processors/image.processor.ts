import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { MediaProcessingService, IMAGE_QUEUE } from '../media-processing.service';
import { StorageConfigService } from '../../storage-config/storage-config.service';
import {
  PropertyImage,
  MediaProcessingStatus,
} from '../../properties/entities/property-image.entity';

interface ImageJobData {
  mediaJobId:   string;
  originalPath: string;
}

interface ImageVariant {
  name:    string;
  width:   number;
  quality: number;
}

const VARIANTS: ImageVariant[] = [
  { name: 'thumbnail', width: 300,  quality: 75 },
  { name: 'medium',    width: 800,  quality: 80 },
  { name: 'large',     width: 1920, quality: 80 },
];

/**
 * ImageProcessor — BullMQ worker for async image processing.
 *
 * For each uploaded image:
 *   1. Read original file (local disk or S3)
 *   2. Generate thumbnail (300px), medium (800px), large (1920px) — all WebP
 *   3. Upload variants to S3 (or save locally)
 *   4. Update media_jobs record with output URLs
 *   5. Update property_images record with thumbnailUrl + mediumUrl if entityType='property_image'
 *
 * Runs with concurrency=4 (4 images processed in parallel per worker pod).
 */
@Processor(IMAGE_QUEUE, { concurrency: 4 })
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    private readonly mediaService: MediaProcessingService,
    private readonly storageConfig: StorageConfigService,
    @InjectRepository(PropertyImage)
    private readonly imageRepo: Repository<PropertyImage>,
  ) {
    super();
  }

  async process(job: Job<ImageJobData>): Promise<any> {
    const { mediaJobId, originalPath } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing image job=${job.id} mediaJobId=${mediaJobId}`);
    await this.mediaService.markProcessing(mediaJobId);

    try {
      const buffer = await this.loadFile(originalPath);
      const outputs: Record<string, string> = {};

      const s3Settings = await this.storageConfig.getS3Settings();
      const useS3 = s3Settings.enabled && !!s3Settings.bucket && !!s3Settings.accessKey;

      // Apply watermark if configured
      const wm = await this.storageConfig.getWatermarkSettings();
      const baseBuffer = await this.prepareBase(buffer, wm);

      for (const variant of VARIANTS) {
        const variantBuffer = await sharp(baseBuffer)
          .resize({ width: variant.width, withoutEnlargement: true })
          .webp({ quality: variant.quality, effort: 4 })
          .toBuffer();

        const filename = `${uuidv4()}.webp`;
        const key = `properties/images/${variant.name}/${filename}`;

        if (useS3) {
          outputs[variant.name] = await this.uploadToS3(variantBuffer, key, s3Settings);
        } else {
          outputs[variant.name] = await this.saveLocally(variantBuffer, variant.name, filename);
        }
      }

      outputs['original'] = originalPath;

      const processingMs = Date.now() - startTime;
      const mediaJob = await this.mediaService.markCompleted(mediaJobId, outputs, processingMs);

      // Update PropertyImage record if this job is linked to one
      if (mediaJob?.entityType === 'property_image' && mediaJob.entityId) {
        await this.imageRepo.update(mediaJob.entityId, {
          thumbnailUrl:     outputs['thumbnail'],
          mediumUrl:        outputs['medium'],
          url:              outputs['large'] ?? outputs['original'],
          processingStatus: MediaProcessingStatus.PROCESSED,
        });
      }

      this.logger.log(
        `Image processed: mediaJobId=${mediaJobId} variants=${Object.keys(outputs).join(',')} ${processingMs}ms`,
      );
      return { success: true, outputs };
    } catch (err) {
      await this.mediaService.markFailed(mediaJobId, err.message);

      // Mark PropertyImage as failed so frontend can show error state
      const mediaJob = await this.mediaService.findById(mediaJobId);
      if (mediaJob?.entityType === 'property_image' && mediaJob.entityId) {
        await this.imageRepo.update(mediaJob.entityId, {
          processingStatus: MediaProcessingStatus.FAILED,
        });
      }

      throw err;
    }
  }

  private async loadFile(filePath: string): Promise<Buffer> {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), 'uploads', filePath);
    return fs.readFile(resolved);
  }

  private async prepareBase(buffer: Buffer, wm: any): Promise<Buffer> {
    const img = sharp(buffer).rotate(); // auto-rotate from EXIF
    if (wm?.enabled && wm.text) {
      const meta = await img.metadata();
      const width  = meta.width  ?? 800;
      const height = meta.height ?? 600;
      const toBuffer = await img.webp({ quality: 90 }).toBuffer();
      return this.applyWatermark(toBuffer, wm.text, width, height);
    }
    return img.toBuffer();
  }

  private async applyWatermark(buffer: Buffer, text: string, width: number, height: number): Promise<Buffer> {
    const fontSize = Math.max(14, Math.min(36, Math.round(width / 25)));
    const padding  = Math.round(fontSize * 0.8);
    const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const svgWidth  = Math.round(safeText.length * fontSize * 0.6) + padding * 2;
    const svgHeight = fontSize + padding * 2;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
  <rect width="${svgWidth}" height="${svgHeight}" rx="4" fill="rgba(0,0,0,0.40)"/>
  <text x="${svgWidth / 2}" y="${svgHeight / 2 + fontSize * 0.35}"
    font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold"
    text-anchor="middle" fill="rgba(255,255,255,0.90)">${safeText}</text>
</svg>`;

    return sharp(buffer)
      .composite([{ input: Buffer.from(svg), top: height - svgHeight - padding, left: width - svgWidth - padding }])
      .webp({ quality: 80 })
      .toBuffer();
  }

  private async saveLocally(buffer: Buffer, variant: string, filename: string): Promise<string> {
    const dir = path.resolve(process.cwd(), 'uploads', 'properties', 'images', variant);
    await fs.mkdir(dir, { recursive: true });
    const dest = path.join(dir, filename);
    await fs.writeFile(dest, buffer);
    return `/uploads/properties/images/${variant}/${filename}`;
  }

  private async uploadToS3(buffer: Buffer, key: string, s3: any): Promise<string> {
    const client = new S3Client({
      region: s3.region ?? 'ap-south-1',
      credentials: { accessKeyId: s3.accessKey, secretAccessKey: s3.secretKey },
      ...(s3.endpoint ? { endpoint: s3.endpoint } : {}),
    });

    await client.send(new PutObjectCommand({
      Bucket:       s3.bucket,
      Key:          key,
      Body:         buffer,
      ContentType:  'image/webp',
      CacheControl: 'public, max-age=31536000',
    }));

    const cdnBase = s3.cdnUrl ?? `https://${s3.bucket}.s3.${s3.region ?? 'ap-south-1'}.amazonaws.com`;
    return `${cdnBase}/${key}`;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ImageJobData>, err: Error) {
    this.logger.error(`Image job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ImageJobData>) {
    this.logger.debug(`Image job ${job.id} completed`);
  }
}

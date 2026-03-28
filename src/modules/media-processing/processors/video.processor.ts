import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { MediaProcessingService, VIDEO_QUEUE } from '../media-processing.service';
import { StorageConfigService } from '../../storage-config/storage-config.service';

interface VideoJobData {
  mediaJobId:   string;
  originalPath: string;
}

interface VideoVariant {
  name:     string;
  height:   number;
  videoBr:  string; // video bitrate
  audioBr:  string; // audio bitrate
}

const VIDEO_VARIANTS: VideoVariant[] = [
  { name: '240p',  height: 240,  videoBr: '400k',  audioBr: '64k'  },
  { name: '480p',  height: 480,  videoBr: '1000k', audioBr: '128k' },
  { name: '720p',  height: 720,  videoBr: '2500k', audioBr: '192k' },
];

/**
 * VideoProcessor — BullMQ worker for async video transcoding.
 *
 * Requires ffmpeg installed on the system (apt-get install ffmpeg).
 * For each video:
 *   1. Generate poster frame at 1 second
 *   2. Transcode to 240p, 480p, 720p H.264/AAC MP4
 *   3. Upload all variants to S3 or save locally
 *
 * Concurrency=1 (video encoding is CPU-intensive).
 * Scale horizontally with separate worker pods if needed.
 */
@Processor(VIDEO_QUEUE, { concurrency: 1 })
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private readonly mediaService: MediaProcessingService,
    private readonly storageConfig: StorageConfigService,
  ) {
    super();
  }

  async process(job: Job<VideoJobData>): Promise<any> {
    const { mediaJobId, originalPath } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing video job=${job.id} mediaJobId=${mediaJobId}`);
    await this.mediaService.markProcessing(mediaJobId);

    const tmpDir = path.resolve(process.cwd(), 'uploads', 'tmp', uuidv4());
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      const sourcePath = path.isAbsolute(originalPath)
        ? originalPath
        : path.resolve(process.cwd(), 'uploads', originalPath);

      const s3Settings = await this.storageConfig.getS3Settings();
      const useS3 = s3Settings.enabled && !!s3Settings.bucket && !!s3Settings.accessKey;

      const outputs: Record<string, string> = {};
      const baseName = uuidv4();

      // 1. Generate poster frame
      const posterFile = path.join(tmpDir, `${baseName}_poster.jpg`);
      await this.extractPoster(sourcePath, posterFile);
      const posterBuffer = await fs.readFile(posterFile);
      const posterKey = `properties/videos/posters/${baseName}.jpg`;

      if (useS3) {
        outputs['poster'] = await this.uploadToS3(posterBuffer, posterKey, 'image/jpeg', s3Settings);
      } else {
        outputs['poster'] = await this.saveLocally(posterBuffer, 'videos/posters', `${baseName}.jpg`);
      }

      // 2. Transcode each variant
      for (const variant of VIDEO_VARIANTS) {
        const outFile = path.join(tmpDir, `${baseName}_${variant.name}.mp4`);
        await this.transcodeVariant(sourcePath, outFile, variant);

        const buffer = await fs.readFile(outFile);
        const key = `properties/videos/${variant.name}/${baseName}.mp4`;

        if (useS3) {
          outputs[variant.name] = await this.uploadToS3(buffer, key, 'video/mp4', s3Settings);
        } else {
          outputs[variant.name] = await this.saveLocally(buffer, `videos/${variant.name}`, `${baseName}.mp4`);
        }
      }

      const processingMs = Date.now() - startTime;
      await this.mediaService.markCompleted(mediaJobId, outputs, processingMs);

      this.logger.log(
        `Video transcoded: mediaJobId=${mediaJobId} variants=${Object.keys(outputs).join(',')} ${processingMs}ms`,
      );
      return { success: true, outputs };
    } catch (err) {
      await this.mediaService.markFailed(mediaJobId, err.message);
      throw err;
    } finally {
      // Always clean up temp directory
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private extractPoster(input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-i', input,
        '-ss', '00:00:01',
        '-vframes', '1',
        '-q:v', '2',
        '-y', output,
      ]);

      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg poster extraction failed with code ${code}`));
      });
      proc.on('error', err => reject(new Error(`ffmpeg not found: ${err.message}. Install ffmpeg.`)));
    });
  }

  private transcodeVariant(input: string, output: string, variant: VideoVariant): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-i', input,
        '-vf', `scale=-2:${variant.height}`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-b:v', variant.videoBr,
        '-c:a', 'aac',
        '-b:a', variant.audioBr,
        '-movflags', '+faststart', // web optimized
        '-y', output,
      ]);

      let stderr = '';
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg transcode (${variant.name}) failed code=${code}: ${stderr.slice(-500)}`));
      });
      proc.on('error', err => reject(new Error(`ffmpeg not found: ${err.message}. Install with: apt-get install ffmpeg`)));
    });
  }

  private async saveLocally(buffer: Buffer, subDir: string, filename: string): Promise<string> {
    const dir = path.resolve(process.cwd(), 'uploads', subDir);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), buffer);
    return `/uploads/${subDir}/${filename}`;
  }

  private async uploadToS3(buffer: Buffer, key: string, contentType: string, s3: any): Promise<string> {
    const client = new S3Client({
      region: s3.region ?? 'ap-south-1',
      credentials: { accessKeyId: s3.accessKey, secretAccessKey: s3.secretKey },
      ...(s3.endpoint ? { endpoint: s3.endpoint } : {}),
    });

    await client.send(new PutObjectCommand({
      Bucket:      s3.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
    }));

    const cdnBase = s3.cdnUrl ?? `https://${s3.bucket}.s3.${s3.region ?? 'ap-south-1'}.amazonaws.com`;
    return `${cdnBase}/${key}`;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<VideoJobData>, err: Error) {
    this.logger.error(`Video job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<VideoJobData>) {
    this.logger.debug(`Video job ${job.id} completed`);
  }
}

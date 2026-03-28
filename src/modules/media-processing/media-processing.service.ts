import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MediaJob, MediaJobStatus, MediaJobType } from './entities/media-job.entity';

export const IMAGE_QUEUE = 'image-processing';
export const VIDEO_QUEUE = 'video-processing';

export interface EnqueueImageJob {
  originalPath: string;
  entityType?:  string;
  entityId?:    string;
  userId?:      string;
  originalSizeBytes?: number;
}

export interface EnqueueVideoJob {
  originalPath: string;
  entityType?:  string;
  entityId?:    string;
  userId?:      string;
  originalSizeBytes?: number;
}

export interface MediaJobFilter {
  status?:    MediaJobStatus;
  type?:      MediaJobType;
  entityType?: string;
  entityId?:  string;
  page?:      number;
  limit?:     number;
}

@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name);

  constructor(
    @InjectRepository(MediaJob)
    private readonly jobRepo: Repository<MediaJob>,
    @InjectQueue(IMAGE_QUEUE)
    private readonly imageQueue: Queue,
    @InjectQueue(VIDEO_QUEUE)
    private readonly videoQueue: Queue,
  ) {}

  // ── Enqueue ─────────────────────────────────────────────────────────────────

  async enqueueImage(input: EnqueueImageJob): Promise<MediaJob> {
    const job = await this.jobRepo.save(this.jobRepo.create({
      type:              MediaJobType.IMAGE,
      status:            MediaJobStatus.QUEUED,
      originalPath:      input.originalPath,
      entityType:        input.entityType,
      entityId:          input.entityId,
      userId:            input.userId,
      originalSizeBytes: input.originalSizeBytes,
    }));

    const bullJob = await this.imageQueue.add(
      'process-image',
      { mediaJobId: job.id, originalPath: input.originalPath },
      {
        attempts: 3,
        backoff:  { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail:     { count: 200 },
      },
    );

    await this.jobRepo.update(job.id, { queueJobId: String(bullJob.id) });
    this.logger.log(`Image job queued: mediaJobId=${job.id} queueJobId=${bullJob.id}`);
    return job;
  }

  async enqueueVideo(input: EnqueueVideoJob): Promise<MediaJob> {
    const job = await this.jobRepo.save(this.jobRepo.create({
      type:              MediaJobType.VIDEO,
      status:            MediaJobStatus.QUEUED,
      originalPath:      input.originalPath,
      entityType:        input.entityType,
      entityId:          input.entityId,
      userId:            input.userId,
      originalSizeBytes: input.originalSizeBytes,
    }));

    const bullJob = await this.videoQueue.add(
      'process-video',
      { mediaJobId: job.id, originalPath: input.originalPath },
      {
        attempts: 2,
        backoff:  { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail:     { count: 100 },
      },
    );

    await this.jobRepo.update(job.id, { queueJobId: String(bullJob.id) });
    this.logger.log(`Video job queued: mediaJobId=${job.id} queueJobId=${bullJob.id}`);
    return job;
  }

  // ── Query ───────────────────────────────────────────────────────────────────

  async findAll(filter: MediaJobFilter = {}): Promise<{ data: MediaJob[]; total: number }> {
    const where: any = {};
    if (filter.status)     where.status     = filter.status;
    if (filter.type)       where.type       = filter.type;
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId)   where.entityId   = filter.entityId;

    const page  = filter.page  ?? 1;
    const limit = filter.limit ?? 50;

    const [data, total] = await this.jobRepo.findAndCount({
      where,
      order:  { createdAt: 'DESC' },
      skip:   (page - 1) * limit,
      take:   limit,
    });
    return { data, total };
  }

  async findById(id: string): Promise<MediaJob | null> {
    return this.jobRepo.findOne({ where: { id } });
  }

  async getStats(): Promise<{
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    totalImages: number;
    totalVideos: number;
    avgProcessingMs: number | null;
  }> {
    const [queued, processing, completed, failed, totalImages, totalVideos, avgRaw] =
      await Promise.all([
        this.jobRepo.count({ where: { status: MediaJobStatus.QUEUED } }),
        this.jobRepo.count({ where: { status: MediaJobStatus.PROCESSING } }),
        this.jobRepo.count({ where: { status: MediaJobStatus.COMPLETED } }),
        this.jobRepo.count({ where: { status: MediaJobStatus.FAILED } }),
        this.jobRepo.count({ where: { type: MediaJobType.IMAGE } }),
        this.jobRepo.count({ where: { type: MediaJobType.VIDEO } }),
        this.jobRepo
          .createQueryBuilder('j')
          .select('AVG(j.processingMs)', 'avg')
          .where('j.status = :s', { s: MediaJobStatus.COMPLETED })
          .getRawOne<{ avg: string | null }>(),
      ]);

    return {
      queued,
      processing,
      completed,
      failed,
      totalImages,
      totalVideos,
      avgProcessingMs: avgRaw?.avg ? Math.round(Number(avgRaw.avg)) : null,
    };
  }

  // ── Admin actions ───────────────────────────────────────────────────────────

  async retry(id: string): Promise<void> {
    const job = await this.jobRepo.findOneOrFail({ where: { id } });
    await this.jobRepo.update(id, {
      status:       MediaJobStatus.QUEUED,
      errorMessage: null,
      attemptCount: 0,
    });

    const queue = job.type === MediaJobType.VIDEO ? this.videoQueue : this.imageQueue;
    const bullJob = await queue.add(
      job.type === MediaJobType.VIDEO ? 'process-video' : 'process-image',
      { mediaJobId: job.id, originalPath: job.originalPath },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    await this.jobRepo.update(id, { queueJobId: String(bullJob.id) });
  }

  async remove(id: string): Promise<void> {
    await this.jobRepo.delete(id);
  }

  // Called by processors to update job state
  async markProcessing(id: string): Promise<void> {
    await this.jobRepo.update(id, { status: MediaJobStatus.PROCESSING, attemptCount: () => 'attemptCount + 1' });
  }

  async markCompleted(id: string, outputs: any, processingMs: number): Promise<MediaJob | null> {
    await this.jobRepo.update(id, { status: MediaJobStatus.COMPLETED, outputs, processingMs });
    return this.jobRepo.findOne({ where: { id } });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.jobRepo.update(id, { status: MediaJobStatus.FAILED, errorMessage: error.slice(0, 2000) });
  }
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum MediaJobType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum MediaJobStatus {
  QUEUED     = 'queued',
  PROCESSING = 'processing',
  COMPLETED  = 'completed',
  FAILED     = 'failed',
}

export interface ImageOutputs {
  original?:  string;
  large?:     string; // 1920px WebP
  medium?:    string; // 800px WebP
  thumbnail?: string; // 300px WebP
}

export interface VideoOutputs {
  '240p'?: string;
  '480p'?: string;
  '720p'?: string;
  poster?: string; // thumbnail frame
}

/**
 * media_jobs — tracks every async media processing job.
 * Created immediately on upload, updated as BullMQ worker progresses.
 *
 * entityType + entityId: the DB record that owns this media
 * (e.g. entityType='property_image', entityId='<propertyImageId>')
 */
@Entity('media_jobs')
export class MediaJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'enum', enum: MediaJobType })
  type: MediaJobType;

  @Index()
  @Column({ type: 'enum', enum: MediaJobStatus, default: MediaJobStatus.QUEUED })
  status: MediaJobStatus;

  /** Path or URL to the original uploaded file */
  @Column({ length: 1000 })
  originalPath: string;

  /** Generated output URLs keyed by variant name */
  @Column({ type: 'json', nullable: true })
  outputs: ImageOutputs | VideoOutputs | null;

  @Column({ length: 100, nullable: true })
  entityType: string;

  @Index()
  @Column({ length: 36, nullable: true })
  entityId: string;

  @Column({ length: 36, nullable: true })
  userId: string;

  /** BullMQ job ID for correlation */
  @Column({ length: 100, nullable: true })
  queueJobId: string;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  /** Processing duration in milliseconds */
  @Column({ type: 'int', nullable: true })
  processingMs: number;

  /** File size of original in bytes */
  @Column({ type: 'bigint', nullable: true, unsigned: true })
  originalSizeBytes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

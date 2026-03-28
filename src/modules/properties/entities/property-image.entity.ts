import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Property } from './property.entity';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum MediaProcessingStatus {
  PENDING   = 'pending',   // just uploaded, awaiting queue
  QUEUED    = 'queued',    // enqueued in BullMQ
  PROCESSED = 'processed', // variants generated
  FAILED    = 'failed',    // processing failed
}

@Entity('property_images')
export class PropertyImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Original URL (or local path) set immediately on upload */
  @Column({ length: 500 })
  url: string;

  /** Thumbnail URL (300px WebP) — populated after async processing */
  @Column({ length: 500, nullable: true })
  thumbnailUrl: string;

  /** Medium URL (800px WebP) — populated after async processing */
  @Column({ length: 500, nullable: true })
  mediumUrl: string;

  @Column({ length: 200, nullable: true })
  alt: string;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'enum', enum: MediaType, default: MediaType.IMAGE })
  mediaType: MediaType;

  @Column({
    type: 'enum',
    enum: MediaProcessingStatus,
    default: MediaProcessingStatus.PENDING,
  })
  processingStatus: MediaProcessingStatus;

  /** FK to media_jobs.id for correlating processing status */
  @Column({ length: 36, nullable: true })
  mediaJobId: string;

  @ManyToOne(() => Property, (property) => property.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  @Column()
  propertyId: string;

  @CreateDateColumn()
  createdAt: Date;
}

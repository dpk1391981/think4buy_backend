import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum SiteVisitStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
}

export enum VisitOutcome {
  VERY_INTERESTED = 'very_interested',
  INTERESTED = 'interested',
  NEEDS_TIME = 'needs_time',
  NOT_INTERESTED = 'not_interested',
  PRICE_ISSUE = 'price_issue',
  LOCATION_ISSUE = 'location_issue',
}

@Entity('site_visits')
export class SiteVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index()
  leadId: string;

  @Column({ length: 36 })
  @Index()
  agentId: string;

  @Column({ length: 36, nullable: true })
  propertyId: string;

  @Column({ type: 'datetime' })
  scheduledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'enum', enum: SiteVisitStatus, default: SiteVisitStatus.SCHEDULED })
  status: SiteVisitStatus;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  agentCheckinLat: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  agentCheckinLng: number;

  @Column({ type: 'enum', enum: VisitOutcome, nullable: true })
  outcome: VisitOutcome;

  @Column({ type: 'text', nullable: true })
  agentNotes: string;

  @Column({ type: 'tinyint', nullable: true })
  clientRating: number;

  @Column({ type: 'text', nullable: true })
  clientFeedback: string;

  @Column({ type: 'int', default: 0 })
  rescheduleCount: number;

  @Column({ length: 255, nullable: true })
  cancelReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

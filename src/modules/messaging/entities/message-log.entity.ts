import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum MessageStatus {
  QUEUED   = 'queued',
  SENT     = 'sent',
  FAILED   = 'failed',
  RETRYING = 'retrying',
  SKIPPED  = 'skipped',
}

@Entity('message_logs')
export class MessageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 100 })
  event: string;

  @Column({ length: 36, nullable: true })
  templateId: string;

  @Column({ length: 36, nullable: true })
  serviceId: string;

  @Column({ length: 20, nullable: true })
  recipientType: string;

  /** Phone or email of the actual recipient */
  @Column({ length: 200, nullable: true })
  recipient: string;

  /** User ID if known */
  @Column({ length: 36, nullable: true })
  recipientUserId: string;

  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.QUEUED })
  @Index()
  status: MessageStatus;

  /** Rendered message body that was sent */
  @Column({ type: 'text', nullable: true })
  renderedBody: string;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  /** BullMQ job ID for tracing */
  @Column({ length: 100, nullable: true })
  jobId: string;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  /** Raw context data passed to the job */
  @Column({ type: 'json', nullable: true })
  contextData: Record<string, any>;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}

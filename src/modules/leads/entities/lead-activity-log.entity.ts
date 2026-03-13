import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum ActivityType {
  STATUS_CHANGE = 'status_change',
  NOTE_ADDED = 'note_added',
  CALL_LOGGED = 'call_logged',
  WHATSAPP_SENT = 'whatsapp_sent',
  EMAIL_SENT = 'email_sent',
  VISIT_SCHEDULED = 'visit_scheduled',
  VISIT_COMPLETED = 'visit_completed',
  DEAL_CREATED = 'deal_created',
  ASSIGNMENT_CHANGED = 'assignment_changed',
  REMINDER_SET = 'reminder_set',
  DOCUMENT_UPLOADED = 'document_uploaded',
}

export enum ActorType {
  AGENT = 'agent',
  ADMIN = 'admin',
  SYSTEM = 'system',
  CLIENT = 'client',
}

@Entity('lead_activity_logs')
export class LeadActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index()
  leadId: string;

  @Column({ length: 36, nullable: true })
  actorId: string;

  @Column({ type: 'enum', enum: ActorType, default: ActorType.AGENT })
  actorType: ActorType;

  @Column({ type: 'enum', enum: ActivityType })
  activityType: ActivityType;

  @Column({ type: 'json', nullable: true })
  oldValue: any;

  @Column({ type: 'json', nullable: true })
  newValue: any;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}

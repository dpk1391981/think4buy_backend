import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MessageTemplate } from './message-template.entity';

export enum RecipientType {
  BUYER = 'buyer',
  AGENT = 'agent',
  ADMIN = 'admin',
  OWNER = 'owner',
}

/**
 * System events that can trigger messages.
 * Add new events here as the platform grows.
 */
export enum SystemEvent {
  LEAD_CREATED          = 'lead_created',
  LEAD_STATUS_UPDATED   = 'lead_status_updated',
  LEAD_ASSIGNED         = 'lead_assigned',
  INQUIRY_CREATED       = 'inquiry_created',
  PROPERTY_APPROVED     = 'property_approved',
  PROPERTY_REJECTED     = 'property_rejected',
  SITE_VISIT_SCHEDULED  = 'site_visit_scheduled',
  DEAL_CREATED          = 'deal_created',
  DEAL_WON              = 'deal_won',
  USER_REGISTERED       = 'user_registered',
  OTP_SENT              = 'otp_sent',
}

@Entity('event_template_mappings')
export class EventTemplateMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: SystemEvent })
  event: SystemEvent;

  @Column({ type: 'enum', enum: RecipientType })
  recipientType: RecipientType;

  @Column({ length: 36 })
  templateId: string;

  @ManyToOne(() => MessageTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'templateId' })
  template: MessageTemplate;

  @Column({ default: true })
  isActive: boolean;

  @Column({ length: 255, nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

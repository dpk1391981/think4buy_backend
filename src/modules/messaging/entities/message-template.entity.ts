import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MessageService, MessageChannel } from './message-service.entity';

@Entity('message_templates')
export class MessageTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Unique slug used in event mappings.
   * E.g. "buyer_inquiry_whatsapp", "agent_new_lead_sms"
   */
  @Column({ length: 100, unique: true })
  name: string;

  @Column({ length: 200, nullable: true })
  description: string;

  @Column({ type: 'enum', enum: MessageChannel })
  channel: MessageChannel;

  /** For WhatsApp: the pre-approved template name on Meta dashboard */
  @Column({ length: 100, nullable: true })
  providerTemplateName: string;

  /** Email subject line (supports {{variables}}) */
  @Column({ length: 255, nullable: true })
  subject: string;

  /** Message body with {{variable}} placeholders */
  @Column({ type: 'text' })
  body: string;

  /** List of variable names expected in context, e.g. ["name","property_title"] */
  @Column({ type: 'json', nullable: true })
  variables: string[];

  /** Which messaging service (provider config) to use */
  @Column({ length: 36, nullable: true })
  serviceId: string;

  @ManyToOne(() => MessageService, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'serviceId' })
  service: MessageService;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

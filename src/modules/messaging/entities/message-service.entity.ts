import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum MessageChannel {
  WHATSAPP = 'whatsapp',
  SMS      = 'sms',
  EMAIL    = 'email',
}

export enum MessageProvider {
  META       = 'meta',
  TWILIO     = 'twilio',
  MSG91      = 'msg91',
  SMTP       = 'smtp',
  SENDGRID   = 'sendgrid',
  GENERIC    = 'generic',
}

@Entity('message_services')
export class MessageService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-friendly name, e.g. "WhatsApp Meta Production" */
  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: MessageChannel })
  channel: MessageChannel;

  @Column({ type: 'enum', enum: MessageProvider, default: MessageProvider.GENERIC })
  provider: MessageProvider;

  /**
   * Provider-specific config stored as JSON.
   * WhatsApp Meta:   { apiKey, phoneNumberId, templateNamespace }
   * Twilio:          { accountSid, authToken, from }
   * MSG91:           { authKey, senderId }
   * SMTP:            { host, port, secure, user, pass, from }
   * SendGrid:        { apiKey, from }
   */
  @Column({ type: 'json', nullable: true })
  config: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

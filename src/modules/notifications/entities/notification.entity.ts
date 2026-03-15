import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum NotificationType {
  LEAD = 'lead',
  PROPERTY = 'property',
  SYSTEM = 'system',
  MESSAGE = 'message',
  ADMIN = 'admin',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 36 })
  userId: string;

  @Column({ length: 50, nullable: true })
  role: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.SYSTEM })
  type: NotificationType;

  @Column({ length: 50, nullable: true })
  entityType: string;

  @Column({ length: 36, nullable: true })
  entityId: string;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { User } from '../../users/entities/user.entity';

export enum InquiryStatus {
  PENDING = 'pending',
  RESPONDED = 'responded',
  CLOSED = 'closed',
}

export enum InquiryType {
  GENERAL = 'general',
  SITE_VISIT = 'site_visit',
  PRICE_NEGOTIATION = 'price_negotiation',
}

@Entity('inquiries')
export class Inquiry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 150, nullable: true })
  email: string;

  @Column({ length: 15 })
  phone: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({
    type: 'enum',
    enum: InquiryType,
    default: InquiryType.GENERAL,
  })
  type: InquiryType;

  @Column({
    type: 'enum',
    enum: InquiryStatus,
    default: InquiryStatus.PENDING,
  })
  status: InquiryStatus;

  @ManyToOne(() => Property, (property) => property.inquiries, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column({ nullable: true })
  propertyId: string;

  // For direct agent inquiries (no property context)
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agent_id' })
  agent: User;

  @Column({ nullable: true })
  agentId: string;

  @ManyToOne(() => User, (user) => user.inquiries, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

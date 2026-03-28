import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SubscriptionPlan } from './subscription-plan.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('agent_subscriptions')
export class AgentSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  agentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent: User;

  @Column()
  planId: string;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({ type: 'datetime' })
  startsAt: Date;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tokensDeducted: number;

  /** Number of property listings consumed in this subscription period */
  @Column({ type: 'int', default: 0 })
  usedListings: number;

  @Column({ type: 'json', nullable: true })
  planSnapshot: object; // copy of plan features at purchase time

  @CreateDateColumn()
  createdAt: Date;
}

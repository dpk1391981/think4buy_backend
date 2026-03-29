import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PlanType {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  FEATURED = 'featured',
  ENTERPRISE = 'enterprise',
}

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: PlanType })
  type: PlanType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: 30 })
  durationDays: number;

  @Column({ type: 'int', default: 0 })
  tokensIncluded: number;

  @Column({ type: 'int', default: 5 })
  maxListings: number;

  @Column({ type: 'json', nullable: true })
  features: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  /**
   * Agent badge granted by this plan.
   * Enterprise → gold | Featured → silver | Premium → bronze | Basic → verified | none → no badge
   */
  @Column({ type: 'enum', enum: ['none', 'verified', 'bronze', 'silver', 'gold'], default: 'none' })
  agentBadge: 'none' | 'verified' | 'bronze' | 'silver' | 'gold';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

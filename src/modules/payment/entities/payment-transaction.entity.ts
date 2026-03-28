import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PaymentGateway } from './payment-gateway.entity';

export enum PaymentStatus {
  INITIATED = 'initiated',
  PENDING   = 'pending',
  SUCCESS   = 'success',
  FAILED    = 'failed',
  REFUNDED  = 'refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentType {
  SUBSCRIPTION      = 'subscription',
  TOKEN_PURCHASE    = 'token_purchase',
  BOOST             = 'boost',
  PROPERTY_LISTING  = 'property_listing',
}

export enum PaymentMode {
  REAL_MONEY = 'real_money',
  TOKENS     = 'tokens',
}

/**
 * payment_transactions — full lifecycle of every payment attempt.
 * Idempotency key prevents double-charge on retry/refresh.
 * Double-entry via wallet_transactions (linked by referenceId).
 */
@Entity('payment_transactions')
@Index('IDX_PT_idempotency', ['idempotencyKey'], { unique: true })
@Index('IDX_PT_user',        ['userId'])
@Index('IDX_PT_status',      ['status'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Client-generated UUID sent with every initiation request.
   * Subsequent requests with the same key return the existing transaction.
   */
  @Column({ unique: true, length: 64 })
  idempotencyKey: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ManyToOne(() => PaymentGateway, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'gateway_id' })
  gateway: PaymentGateway;

  @Column({ name: 'gateway_id', nullable: true })
  gatewayId: string;

  /** Order/intent ID from the gateway (Razorpay order_id / Stripe PI id) */
  @Column({ nullable: true })
  gatewayOrderId: string;

  /** Payment confirmation ID (Razorpay payment_id / Stripe charge_id) */
  @Column({ nullable: true })
  gatewayPaymentId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.INITIATED })
  status: PaymentStatus;

  @Column({ type: 'enum', enum: PaymentType })
  type: PaymentType;

  @Column({ type: 'enum', enum: PaymentMode, default: PaymentMode.TOKENS })
  mode: PaymentMode;

  /** FK to the plan/boost/subscription being purchased */
  @Column({ nullable: true })
  referenceId: string;

  @Column({ nullable: true })
  referenceType: string;

  /** Arbitrary JSON metadata stored per transaction */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true, type: 'text' })
  failureReason: string;

  /** Webhook-set timestamp of when payment reached terminal state */
  @Column({ nullable: true })
  processedAt: Date;

  /** Number of times payment processing was retried */
  @Column({ default: 0 })
  retryCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

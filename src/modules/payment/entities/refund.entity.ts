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
import { PaymentTransaction } from './payment-transaction.entity';
import { User } from '../../users/entities/user.entity';

export enum RefundStatus {
  INITIATED  = 'initiated',
  PROCESSING = 'processing',
  COMPLETED  = 'completed',
  FAILED     = 'failed',
}

export enum RefundInitiatedBy {
  ADMIN  = 'admin',
  SYSTEM = 'system',
  USER   = 'user',
}

/**
 * refunds — tracks every refund request through its lifecycle.
 * Full audit: who initiated, when, gateway response, failure reason.
 */
@Entity('refunds')
@Index('IDX_RF_transaction', ['transactionId'])
@Index('IDX_RF_user',        ['userId'])
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PaymentTransaction, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'transaction_id' })
  transaction: PaymentTransaction;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: RefundStatus, default: RefundStatus.INITIATED })
  status: RefundStatus;

  /** ID returned by the gateway for this refund */
  @Column({ nullable: true })
  gatewayRefundId: string;

  @Column({ type: 'enum', enum: RefundInitiatedBy, default: RefundInitiatedBy.ADMIN })
  initiatedBy: RefundInitiatedBy;

  /** Admin user ID if manually triggered */
  @Column({ nullable: true })
  initiatorAdminId: string;

  @Column({ nullable: true, type: 'text' })
  failureReason: string;

  @Column({ nullable: true })
  processedAt: Date;

  /** Raw gateway refund response JSON */
  @Column({ type: 'longtext', nullable: true })
  gatewayResponse: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

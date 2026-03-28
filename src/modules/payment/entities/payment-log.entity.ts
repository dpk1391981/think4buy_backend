import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PaymentTransaction } from './payment-transaction.entity';

export enum LogLevel {
  INFO    = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR   = 'error',
}

export enum LogSource {
  SYSTEM  = 'system',
  WEBHOOK = 'webhook',
  ADMIN   = 'admin',
  QUEUE   = 'queue',
}

/**
 * payment_logs — immutable audit trail for every payment event.
 * Includes webhook payloads, signature verification results, retries.
 */
@Entity('payment_logs')
@Index('IDX_PL_transaction', ['transactionId'])
@Index('IDX_PL_created',     ['createdAt'])
export class PaymentLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PaymentTransaction, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction: PaymentTransaction;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId: string;

  @Column({ length: 100 })
  event: string;

  @Column({ type: 'enum', enum: LogSource, default: LogSource.SYSTEM })
  source: LogSource;

  @Column({ type: 'enum', enum: LogLevel, default: LogLevel.INFO })
  level: LogLevel;

  /** Raw webhook/event payload (may contain gateway response JSON) */
  @Column({ type: 'longtext', nullable: true })
  payload: string;

  /** null for non-webhook events; true/false for webhook signature checks */
  @Column({ type: 'boolean', nullable: true })
  signatureValid: boolean;

  /** Human-readable description of this event */
  @Column({ type: 'text', nullable: true })
  message: string;

  /** IP of the caller (for webhook source auditing) */
  @Column({ nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum CommissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  INVOICED = 'invoiced',
  PAID = 'paid',
  DISPUTED = 'disputed',
  CLAWBACK = 'clawback',
  CANCELLED = 'cancelled',
}

@Entity('commissions')
export class Commission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index()
  dealId: string;

  @Column({ length: 36 })
  @Index()
  agentId: string;

  @Column({ length: 36, nullable: true })
  agencyId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  dealPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  commissionRate: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  grossCommission: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 30 })
  platformCutPct: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  platformAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  agencyCutPct: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  agencyAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  agentGross: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5 })
  tdsRate: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  tdsAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  agentNetPayout: number;

  @Column({ type: 'enum', enum: CommissionStatus, default: CommissionStatus.PENDING })
  @Index()
  status: CommissionStatus;

  @Column({ length: 36, nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ length: 50, nullable: true })
  invoiceNumber: string;

  @Column({ type: 'date', nullable: true })
  invoiceDate: Date;

  @Column({ type: 'date', nullable: true })
  paymentDate: Date;

  @Column({ length: 100, nullable: true })
  paymentReference: string;

  @Column({ type: 'text', nullable: true })
  clawbackReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

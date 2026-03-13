import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum DealStage {
  SHORTLISTED = 'shortlisted',
  NEGOTIATION = 'negotiation',
  OFFER_ACCEPTED = 'offer_accepted',
  BOOKING_PAID = 'booking_paid',
  AGREEMENT_CREATED = 'agreement_created',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export enum SellerType {
  BUILDER = 'builder',
  OWNER = 'owner',
  AGENCY = 'agency',
}

@Entity('deals')
export class Deal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index()
  leadId: string;

  @Column({ length: 36 })
  @Index()
  agentId: string;

  @Column({ length: 36, nullable: true })
  agencyId: string;

  @Column({ length: 36, nullable: true })
  propertyId: string;

  @Column({ type: 'enum', enum: SellerType, default: SellerType.OWNER })
  sellerType: SellerType;

  @Column({ length: 36, nullable: true })
  sellerId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  agreedPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  bookingAmount: number;

  @Column({ type: 'enum', enum: DealStage, default: DealStage.SHORTLISTED })
  @Index()
  stage: DealStage;

  @Column({ type: 'date', nullable: true })
  offerDate: Date;

  @Column({ type: 'date', nullable: true })
  bookingDate: Date;

  @Column({ type: 'date', nullable: true })
  agreementDate: Date;

  @Column({ type: 'date', nullable: true })
  registrationDate: Date;

  @Column({ type: 'date', nullable: true })
  cancellationDate: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: false })
  commissionCreated: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

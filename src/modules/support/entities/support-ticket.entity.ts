import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum SupportTicketType {
  HELP     = 'help',
  FEEDBACK = 'feedback',
}

export enum SupportTicketStatus {
  OPEN      = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED  = 'resolved',
  CLOSED    = 'closed',
}

@Entity('support_tickets')
@Index(['status', 'createdAt'])
@Index(['userId'])
@Index(['type', 'showAsTestimonial'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null for guest submissions */
  @Column({ length: 36, nullable: true })
  userId: string | null;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 150, nullable: true })
  email: string | null;

  @Column({ length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: SupportTicketType })
  type: SupportTicketType;

  /** e.g. "Listing Issue", "Payment", "Agent Complaint", "General", "Website Bug" */
  @Column({ length: 60, nullable: true })
  category: string | null;

  @Column({ length: 200, nullable: true })
  subject: string | null;

  @Column({ type: 'text' })
  message: string;

  /** 1–5 star rating — only used for feedback type */
  @Column({ type: 'tinyint', unsigned: true, nullable: true })
  rating: number | null;

  @Column({
    type: 'enum',
    enum: SupportTicketStatus,
    default: SupportTicketStatus.OPEN,
  })
  status: SupportTicketStatus;

  /** Admin notes / resolution details */
  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  /**
   * Feedback only — when true this review is published on the homepage testimonials section.
   * Admin toggles this via the Feedback management page.
   */
  @Column({ type: 'boolean', default: false })
  showAsTestimonial: boolean;

  /**
   * Complaint/help tickets — the admin or staff member this ticket is assigned to.
   * Stores a users.id (UUID).
   */
  @Column({ length: 36, nullable: true })
  assignedToId: string | null;

  /** Display name of the assigned member (denormalised for quick display) */
  @Column({ length: 100, nullable: true })
  assignedToName: string | null;

  /**
   * Human-readable ticket number auto-generated on creation: TKT-YYYYMMDD-NNNN
   * e.g. TKT-20260330-0042
   */
  @Column({ length: 30, nullable: true, unique: true })
  ticketNumber: string | null;

  /** Timestamp when status was set to resolved/closed */
  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

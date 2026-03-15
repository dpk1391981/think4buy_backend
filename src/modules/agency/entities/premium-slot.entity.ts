import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * PremiumSlot — a city-scoped paid placement for an agent.
 *
 * Agents purchase a numbered slot in a given city.
 * Slots are surfaced as "Featured Agent (Sponsored)" banners on
 * every property search for that city, above organic results.
 *
 * Pricing / slot limits are admin-configurable per city.
 */
@Entity('premium_slots')
export class PremiumSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Normalised lowercase city name (e.g. "noida", "gurgaon") */
  @Index()
  @Column({ length: 100 })
  city: string;

  /** Optional FK to cities table */
  @Column({ length: 36, nullable: true })
  cityId: string;

  /** Slot position 1–N within the city */
  @Column({ type: 'int', default: 1 })
  slotNumber: number;

  /** FK to users.id (the agent) */
  @Index()
  @Column({ length: 36 })
  agentId: string;

  /** FK to agencies.id — nullable for solo agents */
  @Column({ length: 36, nullable: true })
  agencyId: string;

  /** Human name for the agent (denormalised for fast display) */
  @Column({ length: 200, nullable: true })
  agentName: string;

  /** Avatar URL (denormalised) */
  @Column({ length: 500, nullable: true })
  agentAvatar: string;

  /** Phone number visible on banner */
  @Column({ length: 30, nullable: true })
  agentPhone: string;

  /** Amount paid for this slot (INR) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  /** Duration in days that was purchased */
  @Column({ type: 'int', default: 30 })
  durationDays: number;

  @Column({ type: 'timestamp' })
  startsAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;

  /** Admin notes / reason for manual assignment */
  @Column({ type: 'text', nullable: true })
  adminNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

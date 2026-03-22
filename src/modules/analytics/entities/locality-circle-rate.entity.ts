import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Admin-managed circle rates (government / ready-reckoner rates) per locality.
 * Circle rate = minimum price per sqft as notified by the state government.
 * Properties priced above circle rate → buyer pays stamp duty on actual price.
 * Properties below circle rate → stamp duty calculated on circle rate.
 *
 * These rates are NOT auto-computed from listings — they must be entered by admin
 * from official government documents (e.g. DLC rates, ready-reckoner).
 */
@Entity('locality_circle_rates')
@Index('idx_lcr_city_locality', ['city', 'locality'], { unique: true })
export class LocalityCircleRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @Index()
  city: string;

  @Column({ length: 150 })
  @Index()
  locality: string;

  /** Circle / ready-reckoner rate in ₹/sqft */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  circleRate: number;

  /** Effective from date (when this rate was last updated by government) */
  @Column({ type: 'date', nullable: true })
  effectiveFrom: Date | null;

  /** Optional notes (e.g. "Based on DLC rates 2025-26") */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Source reference (e.g. "Noida Authority", "BBMP") */
  @Column({ length: 200, nullable: true })
  source: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

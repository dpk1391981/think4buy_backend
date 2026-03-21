import {
  Entity, PrimaryColumn, Column, UpdateDateColumn,
} from 'typeorm';

/**
 * Admin-configurable scoring weights for the ranking system.
 *
 * Each row is a named weight used in one of the scoring formulas.
 * The cron job reads this table before each aggregation run.
 *
 * Keys follow the pattern:  <formula>.<factor>
 *   e.g.  listing.views_7d,  listing.inquiries_7d,  agent.inquiries_7d
 */
@Entity('scoring_config')
export class ScoringConfig {
  /** Unique key, e.g. "listing.views_7d" */
  @PrimaryColumn({ length: 80 })
  key: string;

  /** Weight value (0.0–1.0 for percentage weights, or a multiplier for cap values) */
  @Column({ type: 'decimal', precision: 8, scale: 4 })
  value: number;

  /** Human-readable description shown in admin UI */
  @Column({ length: 200, default: '' })
  description: string;

  /** Formula group this config belongs to */
  @Column({ length: 30, default: 'listing' })
  group: string;   // listing | agent | featured | hot

  @UpdateDateColumn()
  updatedAt: Date;
}

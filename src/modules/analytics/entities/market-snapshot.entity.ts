import {
  Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn, CreateDateColumn,
} from 'typeorm';

/**
 * Pre-calculated market price snapshot per city (refreshed by cron every 4 hours).
 * Powers the homepage "City Price Snapshot" section.
 *
 * All PSF values are normalized to ₹ per Sq.Ft.
 */
@Entity('market_snapshots')
@Index(['city'], { unique: false })
export class MarketSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** City name (e.g. "Mumbai"). NULL = state-level. */
  @Column({ length: 100, nullable: true })
  city: string | null;

  /** State name (e.g. "Maharashtra"). */
  @Column({ length: 100, nullable: true })
  state: string | null;

  // ── Market Stats ──────────────────────────────────────────────────────────

  /** Average price per Sq.Ft (buy listings, normalized from all area units). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  avgPsf: number;

  /** Avg PSF from previous 90-day window (for trend). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  prevAvgPsf: number;

  /** Trend direction: 'up' | 'down' | 'stable' */
  @Column({ length: 10, default: 'stable' })
  trend: string;

  /** % change vs prev window (absolute, always positive). */
  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  trendPct: number;

  /** Average total buy price. */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  avgPrice: number;

  /** Minimum active buy price. */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  minPrice: number;

  /** Maximum active buy price. */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  maxPrice: number;

  /** Number of active approved buy listings used for calculation. */
  @Column({ default: 0 })
  listingCount: number;

  /** Total active listings (buy + rent + all). */
  @Column({ default: 0 })
  totalListingCount: number;

  /** Average monthly rent (rent listings). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  avgMonthlyRent: number;

  /** Gross rental yield % (annualised rent / avg buy price). */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  rentYield: number;

  /** Buy vs rent 10-year savings % estimate. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  buySavingsPct: number;

  /** Top localities by PSF (JSON array). */
  @Column({ type: 'json', nullable: true })
  topLocalities: {
    name: string;
    avgPsf: number;
    avgBuyPrice: number;
    avgRent: number;
    listingCount: number;
    trend: 'up' | 'down' | 'stable';
  }[] | null;

  // ── Admin Control ─────────────────────────────────────────────────────────

  /**
   * Whether this city is pinned in the homepage Market Intelligence section.
   * Admin-controlled. Pinned cities always appear; unpinned fill remaining slots.
   */
  @Column({ default: false })
  isFeatured: boolean;

  /**
   * Display order within the homepage city tabs (lower = shown first).
   * Admin-controlled.
   */
  @Column({ default: 100 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

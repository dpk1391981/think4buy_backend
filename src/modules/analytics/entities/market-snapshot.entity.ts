import {
  Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn, CreateDateColumn,
} from 'typeorm';

@Entity('market_snapshots')
@Index(['city'], { unique: false })
export class MarketSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, nullable: true })
  city: string | null;

  @Column({ length: 100, nullable: true })
  state: string | null;

  // ── Sale Metrics ────────────────────────────────────────────────────────────

  /** Freshness-weighted median PSF (outlier-filtered, sale listings only). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  avgPsf: number;

  /** True statistical median PSF (P50). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, nullable: true })
  medianPsf: number | null;

  /** Avg PSF from previous 90-day window (for trend). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  prevAvgPsf: number;

  /** Trend direction: 'up' | 'down' | 'stable' */
  @Column({ length: 10, default: 'stable' })
  trend: string;

  /** % change vs prev window (absolute, always positive). */
  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  trendPct: number;

  /** Freshness-weighted median sale price. */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  avgPrice: number;

  /** True statistical median sale price (P50). */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, nullable: true })
  medianPrice: number | null;

  /** P10 sale price (outlier-safe lower bound). */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  minPrice: number;

  /** P90 sale price (outlier-safe upper bound). */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  maxPrice: number;

  /** Number of sale listings with valid PSF used in calculation. */
  @Column({ default: 0 })
  listingCount: number;

  /** Total active listings (all categories). */
  @Column({ default: 0 })
  totalListingCount: number;

  // ── Rent Metrics ────────────────────────────────────────────────────────────

  /** Freshness-weighted median monthly rent. */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  avgMonthlyRent: number;

  /** True statistical median monthly rent (P50). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, nullable: true })
  medianRent: number | null;

  /** Gross rental yield % (annualised rent / median buy price). */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  rentYield: number;

  /** Buy vs rent 10-year savings % (city-specific model). */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  buySavingsPct: number;

  // ── Data Quality ─────────────────────────────────────────────────────────────

  /** 0–100 confidence score based on count, variance, recency. */
  @Column({ default: 0, nullable: true })
  confidenceScore: number | null;

  /** 'low' | 'medium' | 'high' — human-readable data quality label. */
  @Column({ length: 10, default: 'low', nullable: true })
  dataQuality: string | null;

  /** Indicates prices are indicative, not transacted. */
  @Column({ length: 60, default: 'Indicative Listing Price', nullable: true })
  priceType: string | null;

  // ── Breakdowns ───────────────────────────────────────────────────────────────

  /** Top localities with smart ranking (JSON). */
  @Column({ type: 'json', nullable: true })
  topLocalities: {
    name: string;
    medianPsf: number;
    avgBuyPrice: number;
    avgRent: number;
    listingCount: number;
    trend: 'up' | 'down' | 'stable';
    rentYield: number;
    rankScore: number;
  }[] | null;

  /** Per property-type breakdown (JSON). */
  @Column({ type: 'json', nullable: true })
  byType: Record<string, {
    medianPsf: number;
    medianPrice: number;
    count: number;
  }> | null;

  // ── Admin Control ─────────────────────────────────────────────────────────

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: 100 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

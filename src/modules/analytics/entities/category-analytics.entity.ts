import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, Index,
} from 'typeorm';

@Entity('category_analytics')
@Index(['country', 'state', 'city', 'rank'])
export class CategoryAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Maps to PropertyType enum value: apartment, villa, plot, etc. */
  @Column({ type: 'varchar', length: 60 })
  @Index()
  propertyType: string;

  /** Human-readable label */
  @Column({ type: 'varchar', length: 100 })
  label: string;

  /** Emoji icon for quick UI rendering */
  @Column({ type: 'varchar', length: 10, nullable: true })
  icon: string;

  /** Pre-calculated composite popularity score */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  score: number;

  @Column({ type: 'int', default: 0 })
  rank: number;

  @Column({ type: 'int', default: 0 })
  totalListings: number;

  @Column({ type: 'int', default: 0 })
  totalViews: number;

  @Column({ type: 'int', default: 0 })
  totalSearches: number;

  @Column({ type: 'int', default: 0 })
  totalInquiries: number;

  @Column({ type: 'int', default: 0 })
  totalSaves: number;

  /** Score velocity vs previous 7-day window */
  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  trendingScore: number;

  @Column({ type: 'boolean', default: false })
  @Index()
  isTrending: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  state: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  city: string;

  @UpdateDateColumn()
  updatedAt: Date;
}

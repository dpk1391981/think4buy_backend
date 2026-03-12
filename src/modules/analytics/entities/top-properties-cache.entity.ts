import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';

@Entity('top_properties_cache')
@Index(['country', 'state', 'city', 'period', 'rank'])
@Index(['period', 'rank'])
export class TopPropertiesCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  /** Composite popularity score */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  score: number;

  @Column({ type: 'int', default: 0 })
  rank: number;

  @Column({ type: 'int', default: 0 })
  viewsCount: number;

  @Column({ type: 'int', default: 0 })
  inquiriesCount: number;

  @Column({ type: 'int', default: 0 })
  savesCount: number;

  /** Tab bucket: featured | premium | new_projects | just_listed | most_viewed */
  @Column({ type: 'varchar', length: 30, default: 'featured' })
  @Index()
  tab: string;

  /** Aggregation window: 24h | 7d | 30d */
  @Column({ type: 'varchar', length: 10, default: '7d' })
  @Index()
  period: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @UpdateDateColumn()
  updatedAt: Date;
}

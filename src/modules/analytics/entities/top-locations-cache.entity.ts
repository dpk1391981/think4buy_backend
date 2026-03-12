import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, Index,
} from 'typeorm';

@Entity('top_locations_cache')
@Index(['entityType', 'parentName', 'rank'])
@Index(['entityType', 'isTrending'])
export class TopLocationsCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 'state' | 'city' */
  @Column({ type: 'varchar', length: 10 })
  @Index()
  entityType: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  entityId: string;

  @Column({ type: 'varchar', length: 150 })
  entityName: string;

  /** For cities: the parent state name. For states: the country name */
  @Column({ type: 'varchar', length: 150, nullable: true })
  @Index()
  parentName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  imageUrl: string;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  score: number;

  @Column({ type: 'int', default: 0 })
  rank: number;

  @Column({ type: 'int', default: 0 })
  propertyCount: number;

  @Column({ type: 'int', default: 0 })
  searchCount: number;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  inquiryCount: number;

  /** 20%+ growth over previous 7d → trending */
  @Column({ type: 'boolean', default: false })
  @Index()
  isTrending: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}

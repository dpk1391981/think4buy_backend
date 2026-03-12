import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';

@Entity('top_projects_cache')
@Index(['country', 'state', 'city', 'rank'])
export class TopProjectsCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  score: number;

  @Column({ type: 'int', default: 0 })
  rank: number;

  @Column({ type: 'int', default: 0 })
  viewsCount: number;

  @Column({ type: 'int', default: 0 })
  inquiriesCount: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @UpdateDateColumn()
  updatedAt: Date;
}

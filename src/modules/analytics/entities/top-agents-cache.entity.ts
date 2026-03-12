import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('top_agents_cache')
@Index(['country', 'state', 'city', 'rank'])
export class TopAgentsCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  agentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'agentId' })
  agent: User;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  score: number;

  @Column({ type: 'int', default: 0 })
  rank: number;

  @Column({ type: 'int', default: 0 })
  profileViews: number;

  @Column({ type: 'int', default: 0 })
  listingsCount: number;

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

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Agency } from './agency.entity';
import { PropertyAgentMap } from './property-agent-map.entity';
import { AgentLocationMap } from './agent-location-map.entity';

@Entity('agent_profiles')
export class AgentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36, unique: true })
  userId: string;

  @Column({ length: 36, nullable: true })
  @Index()
  agencyId: string;

  @ManyToOne(() => Agency, (agency) => agency.agents, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  @Column({ type: 'int', default: 0 })
  experienceYears: number;

  @Column({ length: 100, nullable: true })
  licenseNumber: string;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0.0 })
  rating: number;

  @Column({ type: 'int', default: 0 })
  totalDeals: number;

  @Column({ type: 'int', default: 0 })
  totalListings: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ length: 200, nullable: true })
  metaTitle: string;

  @Column({ length: 500, nullable: true })
  metaDescription: string;

  @Column({ type: 'text', nullable: true })
  introContent: string;

  @Column({ type: 'text', nullable: true })
  seoContent: string;

  @Column({ type: 'enum', enum: ['none', 'verified', 'bronze', 'silver', 'gold'], default: 'none' })
  tick: 'none' | 'verified' | 'bronze' | 'silver' | 'gold';

  /**
   * Composite authority score (0–100) recalculated periodically.
   *
   * Formula:
   *   subscriptionWeight × 40%   (tick: gold=100, silver=75, bronze=50, verified=25, none=0)
   *   responseSpeed       × 20%  (reserved — defaults to 50 until tracked)
   *   dealSuccess         × 20%  (totalDeals, capped at 50 → 100%)
   *   reviews             × 10%  (rating / 5 × 100)
   *   listingQuality      × 10%  (totalListings, capped at 30 → 100%)
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  authorityScore: number;

  /** Timestamp of last authority-score recomputation */
  @Column({ type: 'timestamp', nullable: true })
  authorityScoreUpdatedAt: Date;

  /**
   * Average response time in hours, admin-settable or derived from inquiry logs.
   * NULL = unknown / not yet measured.
   */
  @Column({ type: 'int', nullable: true })
  avgResponseHours: number | null;

  /**
   * Number of formal complaints received (set / reviewed by admin).
   * Intentionally transparent — always shown on the trust profile.
   */
  @Column({ type: 'int', default: 0 })
  complaintCount: number;

  @OneToMany(() => PropertyAgentMap, (map) => map.agent)
  propertyMaps: PropertyAgentMap[];

  @OneToMany(() => AgentLocationMap, (loc) => loc.agent)
  locationMaps: AgentLocationMap[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

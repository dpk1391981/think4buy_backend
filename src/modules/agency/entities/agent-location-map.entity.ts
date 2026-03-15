import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AgentProfile } from './agent-profile.entity';

export type CoverageType = 'state' | 'city' | 'locality';

@Entity('agent_location_map')
export class AgentLocationMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index()
  agentId: string;

  @ManyToOne(() => AgentProfile, (agent) => agent.locationMaps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'agent_id' })
  agent: AgentProfile;

  @Column({ type: 'enum', enum: ['state', 'city', 'locality'], default: 'city' })
  coverageType: CoverageType;

  // ── IDs ──────────────────────────────────────────────────────────────────────

  @Column({ length: 36, nullable: true })
  countryId: string;

  @Column({ length: 36, nullable: true })
  stateId: string;

  @Column({ length: 36, nullable: true })
  @Index()
  cityId: string;

  @Column({ length: 36, nullable: true })
  localityId: string;

  // ── Display names (denormalised for fast reads) ───────────────────────────────

  @Column({ length: 100, nullable: true })
  stateName: string;

  @Column({ length: 100, nullable: true })
  cityName: string;

  @Column({ length: 150, nullable: true })
  localityName: string;

  // ── URL-safe slugs for fast slug-based search matching ────────────────────────

  @Index()
  @Column({ length: 120, nullable: true })
  stateSlug: string;

  @Index()
  @Column({ length: 120, nullable: true })
  citySlug: string;

  @Index()
  @Column({ length: 150, nullable: true })
  localitySlug: string;

  // ── Admin control ─────────────────────────────────────────────────────────────

  @Column({ default: true })
  isActive: boolean;

  @Column({ length: 36, nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

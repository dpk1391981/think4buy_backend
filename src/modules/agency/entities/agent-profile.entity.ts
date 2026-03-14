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

  @Column({ type: 'enum', enum: ['none', 'blue', 'gold', 'diamond'], default: 'none' })
  tick: 'none' | 'blue' | 'gold' | 'diamond';

  @OneToMany(() => PropertyAgentMap, (map) => map.agent)
  propertyMaps: PropertyAgentMap[];

  @OneToMany(() => AgentLocationMap, (loc) => loc.agent)
  locationMaps: AgentLocationMap[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

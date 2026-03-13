import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AgentProfile } from './agent-profile.entity';

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

  @Column({ length: 36, nullable: true })
  countryId: string;

  @Column({ length: 36, nullable: true })
  stateId: string;

  @Column({ length: 36, nullable: true })
  @Index()
  cityId: string;

  @CreateDateColumn()
  createdAt: Date;
}

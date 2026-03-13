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

@Entity('property_agent_map')
export class PropertyAgentMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index()
  propertyId: string;

  @Column({ length: 36 })
  @Index()
  agentId: string;

  @ManyToOne(() => AgentProfile, (agent) => agent.propertyMaps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'agent_id' })
  agent: AgentProfile;

  @Column({ default: false })
  assignedByAdmin: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

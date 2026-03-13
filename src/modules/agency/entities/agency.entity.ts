import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { AgentProfile } from './agent-profile.entity';

@Entity('agencies')
export class Agency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  @Index()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 500, nullable: true })
  logo: string;

  @Column({ length: 36, nullable: true })
  countryId: string;

  @Column({ length: 36, nullable: true })
  stateId: string;

  @Column({ length: 36, nullable: true })
  cityId: string;

  @Column({ length: 300, nullable: true })
  address: string;

  @Column({ length: 150, nullable: true })
  contactEmail: string;

  @Column({ length: 20, nullable: true })
  contactPhone: string;

  @Column({ length: 200, nullable: true })
  website: string;

  @Column({ length: 100, nullable: true })
  licenseNumber: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'int', default: 0 })
  totalAgents: number;

  @Column({ type: 'int', default: 0 })
  totalListings: number;

  @OneToMany(() => AgentProfile, (agent) => agent.agency)
  agents: AgentProfile[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

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
import { AgencyMember } from './agency-member.entity';

export enum AgencyStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

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

  /** Approval workflow status — set to pending when agent self-registers an agency */
  @Column({ type: 'enum', enum: AgencyStatus, default: AgencyStatus.APPROVED })
  @Index()
  status: AgencyStatus;

  /** User ID who created this agency (agent self-registration) */
  @Column({ length: 36, nullable: true })
  createdByUserId: string;

  /** Admin rejection reason */
  @Column({ length: 500, nullable: true })
  rejectionReason: string;

  @Column({ type: 'int', default: 0 })
  totalAgents: number;

  @Column({ type: 'int', default: 0 })
  totalListings: number;

  /**
   * Premium agencies can add multiple members.
   * Free agencies are limited to 1 (just the owner).
   * Set by admin when upgrading an agency's subscription tier.
   */
  @Column({ default: false })
  isPremium: boolean;

  /**
   * Hard ceiling on member count enforced in service layer.
   * Default 1 (owner only). Premium agencies: set to 10, 25, 50, etc.
   */
  @Column({ type: 'int', default: 1 })
  maxMembers: number;

  /** Denormalised count kept in sync by member service — avoids expensive COUNT() queries */
  @Column({ type: 'int', default: 0 })
  memberCount: number;

  @OneToMany(() => AgentProfile, (agent) => agent.agency)
  agents: AgentProfile[];

  @OneToMany(() => AgencyMember, (m) => m.agency)
  members: AgencyMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

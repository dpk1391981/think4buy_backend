import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum AssignmentType {
  AUTO = 'auto',
  MANUAL = 'manual',
  REASSIGNED = 'reassigned',
  TRANSFERRED = 'transferred',
}

@Entity('lead_assignments')
export class LeadAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index()
  leadId: string;

  @Column({ length: 36 })
  @Index()
  agentId: string;

  @Column({ length: 36, nullable: true })
  agencyId: string;

  @Column({ length: 36, nullable: true })
  assignedBy: string;

  @Column({ type: 'enum', enum: AssignmentType, default: AssignmentType.MANUAL })
  assignmentType: AssignmentType;

  @Column({ default: true })
  isActive: boolean;

  @Column({ length: 255, nullable: true })
  reason: string;

  @Column({ type: 'timestamp', nullable: true })
  unassignedAt: Date;

  @CreateDateColumn()
  assignedAt: Date;
}

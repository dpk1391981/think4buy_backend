import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Agency } from './agency.entity';

export enum AgencyMemberRole {
  OWNER   = 'owner',    // Primary account holder who created the agency
  MANAGER = 'manager',  // Can invite members and assign leads
  MEMBER  = 'member',   // Can only work their assigned leads
}

export enum AgencyMemberStatus {
  INVITED  = 'invited',   // Invite sent, not yet accepted
  ACTIVE   = 'active',    // Full member
  REMOVED  = 'removed',   // Removed by owner/manager
  DECLINED = 'declined',  // Declined the invite
}

/**
 * Tracks which users belong to an agency and their role within it.
 *
 * Design decisions:
 * - Composite unique on (agencyId, userId) — one row per user per agency.
 * - isPrimaryOwner is set to true only for the agent who created the agency;
 *   ownership transfer must go through an explicit admin or owner action.
 * - Soft-removal: status='removed', removedAt set. Row stays for audit trail.
 * - Invite token is a short-lived UUID cleared on accept/decline.
 * - maxMembers enforced in service layer based on agency.isPremium.
 */
@Entity('agency_members')
@Unique('uq_agency_member', ['agencyId', 'userId'])
@Index('idx_agency_members_agency', ['agencyId'])
@Index('idx_agency_members_user',   ['userId'])
@Index('idx_agency_members_status', ['status'])
export class AgencyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Relationships ────────────────────────────────────────────────────────

  @Column({ length: 36 })
  agencyId: string;

  @ManyToOne(() => Agency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  /** The user (agent) who is a member */
  @Column({ length: 36 })
  userId: string;

  /** Who sent the invite (owner/manager's userId) */
  @Column({ length: 36, nullable: true })
  invitedByUserId: string;

  // ── Role & status ────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: AgencyMemberRole, default: AgencyMemberRole.MEMBER })
  role: AgencyMemberRole;

  @Column({ type: 'enum', enum: AgencyMemberStatus, default: AgencyMemberStatus.INVITED })
  status: AgencyMemberStatus;

  /** True only for the founding owner — protected from role-change by service */
  @Column({ default: false })
  isPrimaryOwner: boolean;

  // ── Invite flow ──────────────────────────────────────────────────────────

  /** One-time UUID token embedded in the invite link/notification. Cleared on accept/decline. */
  @Column({ length: 36, nullable: true })
  inviteToken: string;

  /** When the invite expires (default 7 days from invite) */
  @Column({ type: 'timestamp', nullable: true })
  inviteExpiresAt: Date;

  // ── Timestamps ───────────────────────────────────────────────────────────

  @Column({ type: 'timestamp', nullable: true })
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  removedAt: Date;

  @Column({ length: 255, nullable: true })
  removalReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

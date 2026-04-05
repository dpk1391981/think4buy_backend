import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Property } from '../../properties/entities/property.entity';
import { Inquiry } from '../../inquiries/entities/inquiry.entity';
import { Role } from '../../rbac/entities/role.entity';

export enum UserRole {
  BUYER       = 'buyer',
  OWNER       = 'owner',       // property owner listing
  SELLER      = 'seller',      // kept for backward compatibility
  AGENT       = 'agent',
  BROKER      = 'broker',
  BUILDER     = 'builder',     // real-estate developer / builder company
  ADMIN       = 'admin',
  SUPER_ADMIN = 'super_admin', // root level — isSuperAdmin flag must also be true
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ length: 15, nullable: true })
  phone: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.BUYER })
  role: UserRole;

  // ── RBAC: Super Admin flag ─────────────────────────────────────────────────
  /**
   * When true this user bypasses ALL permission checks.
   * Only seeded Super Admin(s) should have this set.
   */
  @Column({ default: false })
  isSuperAdmin: boolean;

  // ── RBAC: Dynamic Role reference ──────────────────────────────────────────
  /**
   * Optional FK to the dynamic `roles` table.
   * Drives the PermissionGuard — if null, user has no RBAC permissions
   * (falls back to role-enum-based access for legacy guards).
   */
  @Column({ nullable: true, length: 36 })
  @Index()
  systemRoleId: string | null;

  @ManyToOne(() => Role, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'systemRoleId' })
  systemRole: Role | null;

  @Column({ nullable: true, length: 500 })
  avatar: string;

  /** Avatar uploaded by agent awaiting admin approval */
  @Column({ nullable: true, length: 500 })
  pendingAvatar: string;

  @Column({ nullable: true, length: 200 })
  company: string;

  @Column({ nullable: true, length: 100 })
  city: string;

  @Column({ nullable: true, length: 100 })
  state: string;

  // FK references to location tables
  @Column({ nullable: true, length: 36 })
  stateId: string;

  @Column({ nullable: true, length: 36 })
  cityId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isVerified: boolean;

  /** True for OTP-registered users who haven't selected their role yet */
  @Column({ default: false })
  needsOnboarding: boolean;

  // Agent-specific fields
  @Column({ nullable: true, length: 100 })
  agentLicense: string;

  @Column({ nullable: true, length: 20 })
  agentGstNumber: string;

  @Column({ nullable: true, type: 'text' })
  agentBio: string;

  @Column({ type: 'int', nullable: true })
  agentExperience: number; // years

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  agentRating: number; // 1.0 - 5.0

  @Column({ type: 'int', default: 0 })
  totalDeals: number;

  // Agent listing quota
  @Column({ type: 'int', default: 100 })
  agentFreeQuota: number; // free listings allowed

  @Column({ type: 'int', default: 0 })
  agentUsedQuota: number; // listings consumed

  // Agent Tick/Badge System
  @Column({ type: 'enum', enum: ['none', 'verified', 'bronze', 'silver', 'gold'], default: 'none' })
  agentTick: 'none' | 'verified' | 'bronze' | 'silver' | 'gold';

  /** Professional profile status — set to pending when agent submits details, admin approves */
  @Column({ type: 'enum', enum: ['none', 'pending', 'approved', 'inactive'], default: 'none' })
  agentProfileStatus: 'none' | 'pending' | 'approved' | 'inactive';

  // Daily Credit System for Agents
  @Column({ type: 'int', default: 0 })
  dailyCreditUsed: number;

  @Column({ type: 'date', nullable: true })
  dailyCreditDate: string; // ISO date string YYYY-MM-DD, reset when date changes

  // ── Builder-specific fields ─────────────────────────────────────────────────

  /** Registered company / brand name (e.g. "Godrej Properties Ltd.") */
  @Column({ nullable: true, length: 200 })
  builderCompanyName: string;

  /** RERA registration number of the builder entity */
  @Column({ nullable: true, length: 100 })
  builderReraNumber: string;

  /** Years the company has been in operation */
  @Column({ type: 'int', nullable: true })
  builderExperience: number;

  /** Public-facing website URL */
  @Column({ nullable: true, length: 300 })
  builderWebsite: string;

  /** CDN URL of the builder's logo image */
  @Column({ nullable: true, length: 500 })
  builderLogo: string;

  /** Total number of projects delivered so far (self-reported) */
  @Column({ type: 'int', default: 0 })
  builderProjectCount: number;

  /** Admin has verified this builder's credentials */
  @Column({ default: false })
  builderVerified: boolean;

  // ── Security fields ─────────────────────────────────────────────────────────

  /** Hashed refresh token stored server-side; nulled on logout */
  @Column({ nullable: true, length: 500 })
  @Exclude()
  refreshToken: string;

  /** Count of consecutive failed login attempts */
  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  /** Account locked until this timestamp after too many failures */
  @Column({ type: 'datetime', nullable: true })
  lockedUntil: Date;

  /** Timestamp of last successful login */
  @Column({ type: 'datetime', nullable: true })
  lastLoginAt: Date;

  @OneToMany(() => Property, (property) => property.owner)
  properties: Property[];

  @OneToMany(() => Inquiry, (inquiry) => inquiry.user)
  inquiries: Inquiry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

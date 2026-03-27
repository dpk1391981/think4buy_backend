import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToMany, JoinTable, OneToMany, Index,
} from 'typeorm';
import { Permission } from './permission.entity';

/**
 * Dynamic role entity — all roles live in the DB, nothing is hard-coded.
 * The `level` field encodes hierarchy: higher = more privileged.
 *
 *  super_admin  → 100  (bypass all checks, full system)
 *  admin        → 80   (sub-admin, restricted by permissions)
 *  broker       → 60
 *  agent        → 50
 *  owner        → 40
 *  buyer        → 20
 */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Matches UserRole enum values: 'super_admin','admin','broker','agent','owner','buyer' */
  @Column({ unique: true, length: 60 })
  @Index()
  name: string;

  @Column({ length: 100 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** System roles cannot be deleted (created by seeder) */
  @Column({ default: false })
  isSystem: boolean;

  @Column({ default: true })
  isActive: boolean;

  /**
   * Privilege level — used to prevent privilege escalation:
   * an admin (level 80) cannot assign roles with level >= their own.
   */
  @Column({ type: 'int', default: 0 })
  level: number;

  @ManyToMany(() => Permission, (p) => p.roles, { eager: false })
  @JoinTable({
    name: 'role_permissions',
    joinColumn:        { name: 'roleId',       referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToMany, Index,
} from 'typeorm';
import { Role } from './role.entity';

/**
 * A single granular permission key (e.g. "property.create").
 * Permissions are always DB-driven — never hard-coded.
 */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Dot-namespaced key: module.action  e.g. "property.create" */
  @Column({ unique: true, length: 120 })
  @Index()
  key: string;

  /** Human-readable label */
  @Column({ length: 100 })
  name: string;

  /** Logical group / module this belongs to */
  @Column({ length: 60 })
  @Index()
  module: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => Role, (r) => r.permissions)
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

/**
 * Immutable audit trail. Records every sensitive admin/role action.
 * Never update or delete rows — only append.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID of the user who performed the action */
  @Column({ length: 36 })
  @Index()
  actorId: string;

  @Column({ length: 120, nullable: true })
  actorName: string | null;

  @Column({ length: 60, nullable: true })
  actorRole: string | null;

  /**
   * Dot-namespaced action key.
   * Examples: role.created, role.deleted, permission.assigned,
   *           user.role_changed, user.banned, property.approved
   */
  @Column({ length: 80 })
  @Index()
  action: string;

  /** Resource type: 'role', 'permission', 'user', 'property' etc. */
  @Column({ length: 60 })
  @Index()
  resource: string;

  /** ID of the affected resource */
  @Column({ length: 120, nullable: true })
  resourceId: string | null;

  /** Human-friendly summary */
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  /** State before the change (JSON snapshot) */
  @Column({ type: 'json', nullable: true })
  before: Record<string, any> | null;

  /** State after the change (JSON snapshot) */
  @Column({ type: 'json', nullable: true })
  after: Record<string, any> | null;

  @Column({ length: 50, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}

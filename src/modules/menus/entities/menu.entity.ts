import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RoleMenuPermission } from './role-menu-permission.entity';

@Entity('menus')
export class Menu {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  /** Lucide icon name e.g. "layout-dashboard", "search" */
  @Column({ length: 100, nullable: true })
  icon: string;

  /** For nested menus — parent menu id */
  @Column({ type: 'int', nullable: true, name: 'parent_id' })
  parentId: number;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @OneToMany(() => RoleMenuPermission, (rmp) => rmp.menu, { cascade: true })
  rolePermissions: RoleMenuPermission[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

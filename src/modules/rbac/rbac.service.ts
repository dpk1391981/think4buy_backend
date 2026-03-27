import {
  Injectable, Logger, NotFoundException,
  BadRequestException, ForbiddenException, OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { AuditLog } from './entities/audit-log.entity';
import {
  CreateRoleDto, UpdateRoleDto, SetRolePermissionsDto,
  CreatePermissionDto, UpdatePermissionDto, AuditLogQueryDto,
} from './dto/rbac.dto';

// ── Permission cache entry ───────────────────────────────────────────────────
interface CacheEntry { perms: Set<string>; expiresAt: number }

/** All system permissions seeded on startup */
export const DEFAULT_PERMISSIONS: { key: string; name: string; module: string; description: string }[] = [
  // Property
  { key: 'property.view',     name: 'View Properties',      module: 'property', description: 'Browse and search property listings' },
  { key: 'property.create',   name: 'Create Property',      module: 'property', description: 'Post new property listings' },
  { key: 'property.edit',     name: 'Edit Property',        module: 'property', description: 'Edit any property listing' },
  { key: 'property.delete',   name: 'Delete Property',      module: 'property', description: 'Permanently remove a listing' },
  { key: 'property.approve',  name: 'Approve Property',     module: 'property', description: 'Approve pending listings' },
  { key: 'property.reject',   name: 'Reject Property',      module: 'property', description: 'Reject pending listings' },
  { key: 'property.feature',  name: 'Feature Property',     module: 'property', description: 'Pin listings as featured' },
  // Users
  { key: 'user.view',         name: 'View Users',           module: 'user', description: 'View user profiles and list' },
  { key: 'user.create',       name: 'Create User',          module: 'user', description: 'Manually create a user account' },
  { key: 'user.edit',         name: 'Edit User',            module: 'user', description: 'Update user profile or status' },
  { key: 'user.delete',       name: 'Delete User',          module: 'user', description: 'Remove a user account' },
  { key: 'user.ban',          name: 'Ban / Unban User',     module: 'user', description: 'Suspend or restore user access' },
  { key: 'user.manage_wallet',name: 'Manage Wallet',        module: 'user', description: 'Top-up or deduct wallet balance' },
  // Roles & Permissions
  { key: 'role.view',         name: 'View Roles',           module: 'role', description: 'View role list and their permissions' },
  { key: 'role.create',       name: 'Create Role',          module: 'role', description: 'Add a new dynamic role' },
  { key: 'role.edit',         name: 'Edit Role',            module: 'role', description: 'Rename or update a role' },
  { key: 'role.delete',       name: 'Delete Role',          module: 'role', description: 'Remove a non-system role' },
  { key: 'role.assign_permissions', name: 'Assign Permissions', module: 'role', description: 'Change which permissions a role has' },
  { key: 'permission.view',   name: 'View Permissions',     module: 'permission', description: 'View all system permissions' },
  { key: 'permission.create', name: 'Create Permission',    module: 'permission', description: 'Add a new permission key' },
  { key: 'permission.edit',   name: 'Edit Permission',      module: 'permission', description: 'Update permission metadata' },
  { key: 'permission.delete', name: 'Delete Permission',    module: 'permission', description: 'Remove an unused permission' },
  // Dashboard
  { key: 'dashboard.view',    name: 'View Dashboard',       module: 'dashboard', description: 'Access the admin dashboard' },
  { key: 'dashboard.full',    name: 'Full Dashboard',       module: 'dashboard', description: 'Access all dashboard sections' },
  // Analytics
  { key: 'analytics.view',    name: 'View Analytics',       module: 'analytics', description: 'View platform analytics' },
  { key: 'analytics.export',  name: 'Export Analytics',     module: 'analytics', description: 'Download analytics reports' },
  // Agents
  { key: 'agent.view',        name: 'View Agents',          module: 'agent', description: 'View agent profiles' },
  { key: 'agent.create',      name: 'Create Agent',         module: 'agent', description: 'Manually create an agent account' },
  { key: 'agent.edit',        name: 'Edit Agent',           module: 'agent', description: 'Update agent profile or quota' },
  { key: 'agent.delete',      name: 'Delete Agent',         module: 'agent', description: 'Remove an agent account' },
  { key: 'agent.approve_avatar', name: 'Approve Agent Avatar', module: 'agent', description: 'Approve agent profile pictures' },
  { key: 'agent.approve_professional', name: 'Approve Professional Details', module: 'agent', description: 'Verify agent licence/GST' },
  { key: 'agent.manage_quota',name: 'Manage Agent Quota',   module: 'agent', description: 'Change agent free listing quota' },
  // Leads
  { key: 'lead.view',         name: 'View Leads',           module: 'lead', description: 'View buyer/tenant leads' },
  { key: 'lead.assign',       name: 'Assign Lead',          module: 'lead', description: 'Assign leads to agents' },
  { key: 'lead.delete',       name: 'Delete Lead',          module: 'lead', description: 'Remove a lead record' },
  // Content
  { key: 'article.view',      name: 'View Articles',        module: 'content', description: 'Browse blog articles' },
  { key: 'article.create',    name: 'Create Article',       module: 'content', description: 'Publish new blog content' },
  { key: 'article.edit',      name: 'Edit Article',         module: 'content', description: 'Modify existing articles' },
  { key: 'article.delete',    name: 'Delete Article',       module: 'content', description: 'Remove articles' },
  // Settings
  { key: 'settings.view',     name: 'View Settings',        module: 'settings', description: 'View system configuration' },
  { key: 'settings.edit',     name: 'Edit Settings',        module: 'settings', description: 'Modify system configuration' },
  { key: 'settings.storage',  name: 'Storage Settings',     module: 'settings', description: 'Configure S3/CDN/watermark' },
  // System
  { key: 'system.cache_refresh', name: 'Refresh Cache',     module: 'system', description: 'Trigger global cache rebuild' },
  { key: 'system.market_refresh',name: 'Refresh Market Data',module: 'system', description: 'Rebuild market snapshots' },
  { key: 'system.config',     name: 'System Config',        module: 'system', description: 'Manage platform-wide config' },
  // Audit
  { key: 'audit.view',        name: 'View Audit Logs',      module: 'audit', description: 'Read the immutable audit trail' },
  // Menus
  { key: 'menu.manage',       name: 'Manage Menus',         module: 'menu', description: 'Configure role-based navigation menus' },
];

/** Default admin (sub_admin) permission keys — excludes super-admin-only keys */
const ADMIN_DEFAULT_PERMS = DEFAULT_PERMISSIONS
  .map(p => p.key)
  .filter(k => !['role.delete', 'permission.delete', 'permission.create', 'system.config', 'audit.view'].includes(k));

/** Permissions for agents */
const AGENT_PERMS = [
  'dashboard.view', 'property.view', 'property.create', 'property.edit',
  'analytics.view', 'lead.view',
];

/** Permissions for owners */
const OWNER_PERMS = [
  'dashboard.view', 'property.view', 'property.create', 'property.edit',
  'lead.view',
];

/** Permissions for buyers */
const BUYER_PERMS = ['dashboard.view', 'property.view'];

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);

  /** userId → { perms: Set<string>, expiresAt: number } */
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,

    @InjectRepository(Permission)
    private readonly permRepo: Repository<Permission>,

    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,

    private readonly dataSource: DataSource,
  ) {}

  // ─── Lifecycle: seed defaults on startup ────────────────────────────────────

  async onModuleInit() {
    await this.seedDefaultPermissions();
    await this.seedDefaultRoles();
  }

  private async seedDefaultPermissions() {
    for (const p of DEFAULT_PERMISSIONS) {
      const exists = await this.permRepo.findOne({ where: { key: p.key } });
      if (!exists) {
        await this.permRepo.save(this.permRepo.create({ ...p }));
      }
    }
  }

  private async seedDefaultRoles() {
    const defaults = [
      { name: 'super_admin', displayName: 'Super Admin', level: 100, isSystem: true, permKeys: DEFAULT_PERMISSIONS.map(p => p.key) },
      { name: 'admin',       displayName: 'Administrator', level: 80, isSystem: true, permKeys: ADMIN_DEFAULT_PERMS },
      { name: 'broker',      displayName: 'Broker',       level: 60, isSystem: true, permKeys: AGENT_PERMS },
      { name: 'agent',       displayName: 'Agent',        level: 50, isSystem: true, permKeys: AGENT_PERMS },
      { name: 'owner',       displayName: 'Owner',        level: 40, isSystem: true, permKeys: OWNER_PERMS },
      { name: 'buyer',       displayName: 'Buyer / User', level: 20, isSystem: true, permKeys: BUYER_PERMS },
    ];

    for (const def of defaults) {
      let role = await this.roleRepo.findOne({
        where: { name: def.name },
        relations: ['permissions'],
      });

      if (!role) {
        role = this.roleRepo.create({
          name: def.name,
          displayName: def.displayName,
          level: def.level,
          isSystem: def.isSystem,
        });
        role = await this.roleRepo.save(role);
        this.logger.log(`Seeded role: ${def.name}`);
      }

      // Sync permissions only if role has none yet (don't override manual edits)
      if (!role.permissions || role.permissions.length === 0) {
        const perms = await this.permRepo.find({ where: { key: In(def.permKeys) } });
        role.permissions = perms;
        await this.roleRepo.save(role);
        this.logger.log(`Seeded permissions for role: ${def.name} (${perms.length} perms)`);
      }
    }
  }

  // ─── Permission Cache ────────────────────────────────────────────────────────

  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }

  async getUserPermissions(userId: string, isSuperAdmin = false): Promise<Set<string>> {
    if (isSuperAdmin) return new Set(DEFAULT_PERMISSIONS.map(p => p.key));

    const now = Date.now();
    const entry = this.cache.get(userId);
    if (entry && entry.expiresAt > now) return entry.perms;

    // Load from DB — join user → systemRoleId → role → permissions
    const rows: { key: string }[] = await this.dataSource.query(
      `SELECT p.key
       FROM users u
       JOIN roles r ON r.id = u.systemRoleId
       JOIN role_permissions rp ON rp.roleId = r.id
       JOIN permissions p ON p.id = rp.permissionId AND p.isActive = 1
       WHERE u.id = ? AND r.isActive = 1`,
      [userId],
    );

    const perms = new Set<string>(rows.map(r => r.key));
    this.cache.set(userId, { perms, expiresAt: now + this.CACHE_TTL_MS });
    return perms;
  }

  async hasPermission(userId: string, permKey: string, isSuperAdmin = false): Promise<boolean> {
    if (isSuperAdmin) return true;
    const perms = await this.getUserPermissions(userId, isSuperAdmin);
    return perms.has(permKey);
  }

  // ─── Role CRUD ───────────────────────────────────────────────────────────────

  async getRoles(): Promise<Role[]> {
    return this.roleRepo.find({
      relations: ['permissions'],
      order: { level: 'DESC' },
    });
  }

  async getRole(id: string): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async getRoleByName(name: string): Promise<Role | null> {
    return this.roleRepo.findOne({ where: { name }, relations: ['permissions'] });
  }

  async createRole(dto: CreateRoleDto, actorId: string, actorMeta?: { name?: string; role?: string }): Promise<Role> {
    const existing = await this.roleRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new BadRequestException(`Role name "${dto.name}" already exists`);

    const role = this.roleRepo.create({
      name: dto.name.toLowerCase().replace(/\s+/g, '_'),
      displayName: dto.displayName,
      description: dto.description ?? null,
      level: dto.level ?? 10,
    });
    const saved = await this.roleRepo.save(role);

    await this.audit(actorId, 'role.created', 'role', saved.id,
      null, { name: saved.name, displayName: saved.displayName }, actorMeta);

    return saved;
  }

  async updateRole(id: string, dto: UpdateRoleDto, actorId: string, actorMeta?: { name?: string; role?: string }): Promise<Role> {
    const role = await this.getRole(id);
    const before = { displayName: role.displayName, description: role.description, isActive: role.isActive, level: role.level };

    if (dto.displayName !== undefined) role.displayName = dto.displayName;
    if (dto.description !== undefined) role.description = dto.description ?? null;
    if (dto.isActive !== undefined) role.isActive = dto.isActive;
    if (dto.level !== undefined) role.level = dto.level;

    const saved = await this.roleRepo.save(role);
    this.invalidateCacheForRole(id);

    await this.audit(actorId, 'role.updated', 'role', id, before,
      { displayName: saved.displayName, isActive: saved.isActive }, actorMeta);

    return saved;
  }

  async deleteRole(id: string, actorId: string, actorMeta?: { name?: string; role?: string }): Promise<void> {
    const role = await this.getRole(id);
    if (role.isSystem) throw new ForbiddenException('System roles cannot be deleted');

    await this.roleRepo.remove(role);
    this.invalidateCacheForRole(id);

    await this.audit(actorId, 'role.deleted', 'role', id,
      { name: role.name }, null, actorMeta);
  }

  async setRolePermissions(
    roleId: string,
    dto: SetRolePermissionsDto,
    actorId: string,
    actorLevel: number,
    actorMeta?: { name?: string; role?: string },
  ): Promise<Role> {
    const role = await this.getRole(roleId);

    // Privilege escalation guard — you cannot grant permissions to a role
    // at or above your own level (unless you are super_admin, handled in guard)
    if (role.level >= actorLevel) {
      throw new ForbiddenException('Cannot modify permissions of a role at or above your privilege level');
    }

    const perms = dto.permissionIds.length
      ? await this.permRepo.find({ where: { id: In(dto.permissionIds) } })
      : [];

    const before = role.permissions?.map(p => p.key) ?? [];
    role.permissions = perms;
    const saved = await this.roleRepo.save(role);
    this.invalidateCacheForRole(roleId);

    await this.audit(actorId, 'role.permissions_changed', 'role', roleId,
      { permissions: before },
      { permissions: perms.map(p => p.key) },
      actorMeta,
    );

    return saved;
  }

  // ─── Permission CRUD ─────────────────────────────────────────────────────────

  async getPermissions(): Promise<Permission[]> {
    return this.permRepo.find({ order: { module: 'ASC', key: 'ASC' } });
  }

  async getPermission(id: string): Promise<Permission> {
    const p = await this.permRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Permission ${id} not found`);
    return p;
  }

  async createPermission(dto: CreatePermissionDto, actorId: string, actorMeta?: { name?: string; role?: string }): Promise<Permission> {
    const existing = await this.permRepo.findOne({ where: { key: dto.key } });
    if (existing) throw new BadRequestException(`Permission key "${dto.key}" already exists`);

    const perm = this.permRepo.create({ ...dto });
    const saved = await this.permRepo.save(perm);

    await this.audit(actorId, 'permission.created', 'permission', saved.id, null, { key: saved.key }, actorMeta);
    return saved;
  }

  async updatePermission(id: string, dto: UpdatePermissionDto, actorId: string, actorMeta?: { name?: string; role?: string }): Promise<Permission> {
    const perm = await this.getPermission(id);
    Object.assign(perm, dto);
    const saved = await this.permRepo.save(perm);
    this.cache.clear(); // permission change can affect all users
    await this.audit(actorId, 'permission.updated', 'permission', id, null, dto, actorMeta);
    return saved;
  }

  async deletePermission(id: string, actorId: string, actorMeta?: { name?: string; role?: string }): Promise<void> {
    const perm = await this.getPermission(id);
    await this.permRepo.remove(perm);
    this.cache.clear();
    await this.audit(actorId, 'permission.deleted', 'permission', id, { key: perm.key }, null, actorMeta);
  }

  // ─── User ↔ Role assignment ──────────────────────────────────────────────────

  async assignRoleToUser(
    targetUserId: string,
    roleId: string,
    actorId: string,
    actorLevel: number,
    actorMeta?: { name?: string; role?: string },
  ): Promise<void> {
    const role = await this.getRole(roleId);

    if (role.level >= actorLevel) {
      throw new ForbiddenException('Cannot assign a role at or above your own privilege level');
    }

    // Get old role for audit
    const [oldRow]: any[] = await this.dataSource.query(
      `SELECT r.name FROM users u LEFT JOIN roles r ON r.id = u.systemRoleId WHERE u.id = ?`,
      [targetUserId],
    );

    await this.dataSource.query(
      `UPDATE users SET systemRoleId = ? WHERE id = ?`,
      [roleId, targetUserId],
    );

    this.invalidateCache(targetUserId);

    await this.audit(actorId, 'user.role_changed', 'user', targetUserId,
      { role: oldRow?.name ?? null },
      { role: role.name },
      actorMeta,
    );
  }

  async removeRoleFromUser(targetUserId: string, actorId: string, actorMeta?: { name?: string; role?: string }): Promise<void> {
    const [oldRow]: any[] = await this.dataSource.query(
      `SELECT r.name FROM users u LEFT JOIN roles r ON r.id = u.systemRoleId WHERE u.id = ?`,
      [targetUserId],
    );

    await this.dataSource.query(`UPDATE users SET systemRoleId = NULL WHERE id = ?`, [targetUserId]);
    this.invalidateCache(targetUserId);

    await this.audit(actorId, 'user.role_removed', 'user', targetUserId,
      { role: oldRow?.name ?? null }, null, actorMeta);
  }

  // ─── Audit Logs ──────────────────────────────────────────────────────────────

  async audit(
    actorId: string,
    action: string,
    resource: string,
    resourceId: string | null,
    before: Record<string, any> | null,
    after:  Record<string, any> | null,
    meta?: { name?: string; role?: string },
    req?: { ip?: string; headers?: Record<string, string> },
  ): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          actorId,
          actorName:  meta?.name  ?? null,
          actorRole:  meta?.role  ?? null,
          action,
          resource,
          resourceId,
          summary:    `${meta?.name ?? actorId} → ${action}`,
          before,
          after,
          ipAddress:  req?.ip ?? null,
          userAgent:  req?.headers?.['user-agent'] ?? null,
        }),
      );
    } catch (err) {
      this.logger.warn(`Audit log failed: ${err.message}`);
    }
  }

  async getAuditLogs(query: AuditLogQueryDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.auditRepo.createQueryBuilder('al');

    if (query.actorId)   qb.andWhere('al.actorId = :actorId',     { actorId: query.actorId });
    if (query.action)    qb.andWhere('al.action LIKE :action',     { action: `%${query.action}%` });
    if (query.resource)  qb.andWhere('al.resource = :resource',    { resource: query.resource });
    if (query.resourceId)qb.andWhere('al.resourceId = :resourceId',{ resourceId: query.resourceId });

    const [items, total] = await qb
      .orderBy('al.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /** Evict cache entries for every user that has this role */
  private invalidateCacheForRole(roleId: string): void {
    // Simpler: clear entire cache (safe — permissions refresh on next request)
    this.cache.clear();
  }
}

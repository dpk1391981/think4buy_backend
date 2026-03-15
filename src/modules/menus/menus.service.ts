import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from './entities/menu.entity';
import { RoleMenuPermission } from './entities/role-menu-permission.entity';
import { UserRole } from '../users/entities/user.entity';

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_MENUS = [
  { name: 'Dashboard',          slug: 'dashboard',          icon: 'layout-dashboard', sortOrder: 1 },
  { name: 'Search Property',    slug: 'search_property',    icon: 'search',           sortOrder: 2 },
  { name: 'Add Property',       slug: 'add_property',       icon: 'plus-circle',      sortOrder: 3 },
  { name: 'My Properties',      slug: 'my_properties',      icon: 'home',             sortOrder: 4 },
  { name: 'Leads',              slug: 'leads',              icon: 'target',           sortOrder: 5 },
  { name: 'Clients',            slug: 'clients',            icon: 'users',            sortOrder: 6 },
  { name: 'Deals',              slug: 'deals',              icon: 'handshake',        sortOrder: 7 },
  { name: 'Site Visits',        slug: 'site_visits',        icon: 'map-pin',          sortOrder: 8 },
  { name: 'Saved Properties',   slug: 'saved_properties',   icon: 'heart',            sortOrder: 9 },
  { name: 'My Enquiries',       slug: 'my_enquiries',       icon: 'message-square',   sortOrder: 10 },
  { name: 'Messages',           slug: 'messages',           icon: 'message-circle',   sortOrder: 11 },
  { name: 'Analytics',          slug: 'analytics',          icon: 'bar-chart-2',      sortOrder: 12 },
  { name: 'Property Analytics', slug: 'property_analytics', icon: 'trending-up',      sortOrder: 13 },
  { name: 'Property Alerts',    slug: 'property_alerts',    icon: 'bell',             sortOrder: 14 },
  { name: 'Boost Listing',      slug: 'boost_listing',      icon: 'zap',              sortOrder: 15 },
  { name: 'Profile',            slug: 'profile',            icon: 'user',             sortOrder: 16 },
  { name: 'Settings',           slug: 'settings',           icon: 'settings',         sortOrder: 17 },
];

const ROLE_MENUS: Record<UserRole, string[]> = {
  [UserRole.BUYER]: [
    'dashboard', 'search_property', 'saved_properties', 'my_enquiries',
    'site_visits', 'messages', 'property_alerts', 'profile', 'settings',
  ],
  [UserRole.OWNER]: [
    'dashboard', 'add_property', 'my_properties', 'leads',
    'messages', 'property_analytics', 'boost_listing', 'profile', 'settings',
  ],
  [UserRole.AGENT]: [
    'dashboard', 'add_property', 'my_properties', 'leads',
    'clients', 'deals', 'site_visits', 'analytics', 'messages', 'profile', 'settings',
  ],
  [UserRole.ADMIN]: SEED_MENUS.map((m) => m.slug),
  [UserRole.SELLER]: [
    'dashboard', 'add_property', 'my_properties', 'leads',
    'messages', 'property_analytics', 'boost_listing', 'profile', 'settings',
  ],
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class MenusService implements OnModuleInit {
  constructor(
    @InjectRepository(Menu)
    private menuRepo: Repository<Menu>,
    @InjectRepository(RoleMenuPermission)
    private rmpRepo: Repository<RoleMenuPermission>,
  ) {}

  /** Auto-seed menus on first boot if the table is empty */
  async onModuleInit() {
    const count = await this.menuRepo.count();
    if (count === 0) {
      await this.seed();
    }
  }

  async seed() {
    // Create menus
    const menus: Menu[] = [];
    for (const m of SEED_MENUS) {
      const exists = await this.menuRepo.findOne({ where: { slug: m.slug } });
      if (!exists) {
        menus.push(await this.menuRepo.save(this.menuRepo.create(m)));
      } else {
        menus.push(exists);
      }
    }

    const slugToMenu = new Map(menus.map((m) => [m.slug, m]));

    // Create role_menu_permissions for each role
    for (const [role, slugs] of Object.entries(ROLE_MENUS) as [UserRole, string[]][]) {
      for (const slug of slugs) {
        const menu = slugToMenu.get(slug);
        if (!menu) continue;
        const exists = await this.rmpRepo.findOne({ where: { role, menuId: menu.id } });
        if (!exists) {
          await this.rmpRepo.save(this.rmpRepo.create({ role, menuId: menu.id, isVisible: true }));
        }
      }
    }

    console.log('[MenusService] Seed complete');
  }

  /** Fetch visible menus for a given role, sorted by sort_order */
  async getMenusForRole(role: string): Promise<{ name: string; slug: string; icon: string }[]> {
    const normalizedRole = (role || UserRole.AGENT) as UserRole;

    const permissions = await this.rmpRepo
      .createQueryBuilder('rmp')
      .innerJoinAndSelect('rmp.menu', 'menu')
      .where('rmp.role = :role', { role: normalizedRole })
      .andWhere('rmp.is_visible = :v', { v: true })
      .andWhere('menu.is_active = :a', { a: true })
      .orderBy('menu.sort_order', 'ASC')
      .getMany();

    return permissions.map((p) => ({
      name: p.menu.name,
      slug: p.menu.slug,
      icon: p.menu.icon || '',
    }));
  }

  /** Admin: list all menus */
  async getAllMenus(): Promise<Menu[]> {
    return this.menuRepo.find({ order: { sortOrder: 'ASC' } });
  }

  /** Admin: get all role_menu_permissions for a role */
  async getPermissionsForRole(role: UserRole): Promise<RoleMenuPermission[]> {
    return this.rmpRepo.find({
      where: { role },
      relations: ['menu'],
      order: { menu: { sortOrder: 'ASC' } },
    });
  }

  /** Admin: toggle menu visibility for a role */
  async togglePermission(role: UserRole, menuId: number, isVisible: boolean): Promise<RoleMenuPermission> {
    let perm = await this.rmpRepo.findOne({ where: { role, menuId } });
    if (!perm) {
      const menu = await this.menuRepo.findOne({ where: { id: menuId } });
      if (!menu) throw new NotFoundException(`Menu ${menuId} not found`);
      perm = this.rmpRepo.create({ role, menuId, isVisible });
    } else {
      perm.isVisible = isVisible;
    }
    return this.rmpRepo.save(perm);
  }

  /** Admin: update menu sort order */
  async updateMenuOrder(menuId: number, sortOrder: number): Promise<Menu> {
    const menu = await this.menuRepo.findOne({ where: { id: menuId } });
    if (!menu) throw new NotFoundException(`Menu ${menuId} not found`);
    menu.sortOrder = sortOrder;
    return this.menuRepo.save(menu);
  }

  /** Admin: get full permissions matrix (all roles x all menus) */
  async getPermissionsMatrix(): Promise<{
    menus: { id: number; name: string; slug: string; icon: string; sortOrder: number }[];
    permissions: Record<string, Record<number, boolean>>;
  }> {
    const menus = await this.menuRepo.find({ order: { sortOrder: 'ASC' } });
    const allPerms = await this.rmpRepo.find({ relations: ['menu'] });

    const permissions: Record<string, Record<number, boolean>> = {};
    for (const role of Object.values(UserRole)) {
      permissions[role] = {};
    }
    for (const perm of allPerms) {
      if (!permissions[perm.role]) permissions[perm.role] = {};
      permissions[perm.role][perm.menuId] = perm.isVisible;
    }

    return {
      menus: menus.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        icon: m.icon || '',
        sortOrder: m.sortOrder,
      })),
      permissions,
    };
  }
}

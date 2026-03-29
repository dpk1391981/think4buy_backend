import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from './entities/menu.entity';
import { RoleMenuPermission } from './entities/role-menu-permission.entity';
import { UserRole } from '../users/entities/user.entity';

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_MENUS: { name: string; slug: string; icon: string; section: string; sortOrder: number }[] = [
  // ── User Dashboard menus ────────────────────────────────────────────────────
  { name: 'Dashboard',          slug: 'dashboard',          icon: 'layout-dashboard', section: 'user_dashboard', sortOrder: 1  },
  { name: 'Search Property',    slug: 'search_property',    icon: 'search',           section: 'user_dashboard', sortOrder: 2  },
  { name: 'Add Property',       slug: 'add_property',       icon: 'plus-circle',      section: 'user_dashboard', sortOrder: 3  },
  { name: 'My Properties',      slug: 'my_properties',      icon: 'home',             section: 'user_dashboard', sortOrder: 4  },
  { name: 'Leads',              slug: 'leads',              icon: 'target',           section: 'user_dashboard', sortOrder: 5  },
  { name: 'Clients',            slug: 'clients',            icon: 'users',            section: 'user_dashboard', sortOrder: 6  },
  { name: 'Deals',              slug: 'deals',              icon: 'handshake',        section: 'user_dashboard', sortOrder: 7  },
  { name: 'Site Visits',        slug: 'site_visits',        icon: 'map-pin',          section: 'user_dashboard', sortOrder: 8  },
  { name: 'Saved Properties',   slug: 'saved_properties',   icon: 'heart',            section: 'user_dashboard', sortOrder: 9  },
  { name: 'My Enquiries',       slug: 'my_enquiries',       icon: 'message-square',   section: 'user_dashboard', sortOrder: 10 },
  { name: 'Messages',           slug: 'messages',           icon: 'message-circle',   section: 'user_dashboard', sortOrder: 11 },
  { name: 'Analytics',          slug: 'analytics',          icon: 'bar-chart-2',      section: 'user_dashboard', sortOrder: 12 },
  { name: 'Property Analytics', slug: 'property_analytics', icon: 'trending-up',      section: 'user_dashboard', sortOrder: 13 },
  { name: 'Property Alerts',    slug: 'property_alerts',    icon: 'bell',             section: 'user_dashboard', sortOrder: 14 },
  { name: 'Boost Listing',      slug: 'boost_listing',      icon: 'zap',              section: 'user_dashboard', sortOrder: 15 },
  { name: 'Profile',            slug: 'profile',            icon: 'user',             section: 'user_dashboard', sortOrder: 16 },
  { name: 'Settings',           slug: 'settings',           icon: 'settings',         section: 'user_dashboard', sortOrder: 17 },

  // ── Admin Panel — Overview ──────────────────────────────────────────────────
  { name: 'Dashboard',          slug: 'admin_dashboard',             icon: 'layout-dashboard', section: 'admin_overview',   sortOrder: 100 },

  // ── Admin Panel — Listings ──────────────────────────────────────────────────
  { name: 'Properties',          slug: 'admin_properties',           icon: 'home',             section: 'admin_listings',   sortOrder: 110 },
  { name: 'Featured Properties', slug: 'admin_featured_properties',  icon: 'star',             section: 'admin_listings',   sortOrder: 111 },
  { name: 'Categories',          slug: 'admin_categories',           icon: 'tag',              section: 'admin_listings',   sortOrder: 112 },
  { name: 'Property Config',     slug: 'admin_property_config',      icon: 'layers',           section: 'admin_listings',   sortOrder: 113 },

  // ── Admin Panel — Agents ────────────────────────────────────────────────────
  { name: 'Agents',              slug: 'admin_agents',               icon: 'user-check',       section: 'admin_agents',     sortOrder: 120 },
  { name: 'Premium Slots',       slug: 'admin_premium_slots',        icon: 'zap',              section: 'admin_agents',     sortOrder: 121 },
  { name: 'Agent Coverage',      slug: 'admin_agent_coverage',       icon: 'gem',              section: 'admin_agents',     sortOrder: 122 },

  // ── Admin Panel — Users ─────────────────────────────────────────────────────
  { name: 'All Users',           slug: 'admin_users',                icon: 'users',            section: 'admin_users',      sortOrder: 130 },

  // ── Admin Panel — Content ───────────────────────────────────────────────────
  { name: 'Articles',            slug: 'admin_articles',             icon: 'book-open',        section: 'admin_content',    sortOrder: 140 },
  { name: 'Menu',                slug: 'admin_menu',                 icon: 'navigation',       section: 'admin_content',    sortOrder: 141 },

  // ── Admin Panel — SEO ───────────────────────────────────────────────────────
  { name: 'Footer SEO Links',    slug: 'admin_seo_footer_links',     icon: 'link-2',           section: 'admin_seo',        sortOrder: 150 },
  { name: 'Agent Listing SEO',    slug: 'admin_seo_agent_listing',    icon: 'map-pin',          section: 'admin_seo',        sortOrder: 151 },
  { name: 'Property Listing SEO', slug: 'admin_seo_property_listing', icon: 'building-2',       section: 'admin_seo',        sortOrder: 152 },
  { name: 'SEO Config',           slug: 'admin_seo_config',           icon: 'settings',         section: 'admin_seo',        sortOrder: 153 },

  // ── Admin Panel — System ────────────────────────────────────────────────────
  { name: 'Storage & Watermark', slug: 'admin_storage_settings',     icon: 'database',         section: 'admin_system',     sortOrder: 160 },
  { name: 'Feature Toggles',     slug: 'admin_system_config',        icon: 'toggle-left',      section: 'admin_system',     sortOrder: 161 },
  { name: 'Media Queue',         slug: 'admin_media_processing',     icon: 'image-play',       section: 'admin_system',     sortOrder: 162 },

  // ── Admin Panel — Security & RBAC ──────────────────────────────────────────
  { name: 'Roles & Permissions', slug: 'admin_roles',                icon: 'shield-check',     section: 'admin_rbac',       sortOrder: 170 },
  { name: 'Role Menus',          slug: 'admin_role_menus',           icon: 'layout-grid',      section: 'admin_rbac',       sortOrder: 171 },
  { name: 'Audit Logs',          slug: 'admin_audit_logs',           icon: 'clipboard-list',   section: 'admin_rbac',       sortOrder: 172 },

  // ── Admin Panel — Locations ─────────────────────────────────────────────────
  { name: 'Countries',           slug: 'admin_countries',            icon: 'globe',            section: 'admin_locations',  sortOrder: 180 },
  { name: 'States & Cities',     slug: 'admin_locations',            icon: 'map-pin',          section: 'admin_locations',  sortOrder: 181 },
  { name: 'Market Intelligence', slug: 'admin_market_intelligence',  icon: 'bar-chart-2',      section: 'admin_locations',  sortOrder: 182 },
  { name: 'Tools & Insights',    slug: 'admin_tools_insights',       icon: 'wrench',           section: 'admin_locations',  sortOrder: 183 },
  { name: 'Scoring Config',      slug: 'admin_scoring_config',       icon: 'sliders-horizontal',section: 'admin_locations', sortOrder: 184 },

  // ── Admin Panel — CRM ───────────────────────────────────────────────────────
  { name: 'Leads',               slug: 'admin_leads',                icon: 'target',           section: 'admin_crm',        sortOrder: 190 },
  { name: 'Service Leads',       slug: 'admin_service_leads',        icon: 'wrench',           section: 'admin_crm',        sortOrder: 191 },
  { name: 'Deals',               slug: 'admin_deals',                icon: 'handshake',        section: 'admin_crm',        sortOrder: 192 },
  { name: 'Commissions',         slug: 'admin_commissions',          icon: 'indian-rupee',     section: 'admin_crm',        sortOrder: 193 },

  // ── Admin Panel — Finance ───────────────────────────────────────────────────
  { name: 'Wallets',             slug: 'admin_wallets',              icon: 'wallet',           section: 'admin_finance',    sortOrder: 200 },
  { name: 'Subscriptions',       slug: 'admin_subscriptions',        icon: 'credit-card',      section: 'admin_finance',    sortOrder: 201 },
  { name: 'Payments',            slug: 'admin_payments',             icon: 'receipt',          section: 'admin_finance',    sortOrder: 202 },

  // ── Admin Panel — Messaging ─────────────────────────────────────────────────
  { name: 'Messaging Centre',    slug: 'admin_messaging',            icon: 'message-square',   section: 'admin_messaging',  sortOrder: 210 },
];

// All admin slugs
const ALL_ADMIN_SLUGS = SEED_MENUS.filter(m => m.slug.startsWith('admin_')).map(m => m.slug);

const ROLE_MENUS: Record<UserRole, string[]> = {
  [UserRole.BUYER]: [
    'dashboard', 'search_property', 'saved_properties', 'my_enquiries',
    'site_visits', 'messages', 'property_alerts', 'profile', 'settings',
  ],
  [UserRole.OWNER]: [
    'dashboard', 'add_property', 'my_properties', 'leads',
    'messages', 'property_analytics', 'boost_listing', 'saved_properties', 'profile', 'settings',
  ],
  [UserRole.AGENT]: [
    'dashboard', 'add_property', 'my_properties', 'leads',
    'clients', 'deals', 'site_visits', 'analytics', 'messages', 'profile', 'settings',
  ],
  [UserRole.BROKER]: [
    'dashboard', 'add_property', 'my_properties', 'leads',
    'clients', 'deals', 'site_visits', 'analytics', 'messages', 'profile', 'settings',
  ],
  [UserRole.SELLER]: [
    'dashboard', 'add_property', 'my_properties', 'leads',
    'messages', 'property_analytics', 'boost_listing', 'saved_properties', 'profile', 'settings',
  ],
  // Admin gets all admin panel menus except RBAC management (roles, role_menus)
  [UserRole.ADMIN]: [
    ...SEED_MENUS.filter(m => m.slug.startsWith('admin_') && !['admin_roles','admin_role_menus','admin_audit_logs'].includes(m.slug)).map(m => m.slug),
  ],
  // Super admin gets everything
  [UserRole.SUPER_ADMIN]: ALL_ADMIN_SLUGS,
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

  async onModuleInit() {
    const count = await this.menuRepo.count();
    if (count === 0) {
      await this.seed();
    } else {
      await this.syncMissingMenus();
      await this.syncMissingPermissions();
    }
  }

  /** Insert any new menu slugs from SEED_MENUS that don't exist yet. */
  private async syncMissingMenus() {
    for (const m of SEED_MENUS) {
      const exists = await this.menuRepo.findOne({ where: { slug: m.slug } });
      if (!exists) {
        await this.menuRepo.save(this.menuRepo.create(m));
        console.log(`[MenusService] Added missing menu: ${m.slug}`);
      } else if (!exists.section && m.section) {
        // Backfill section for existing rows
        exists.section = m.section;
        await this.menuRepo.save(exists);
      }
    }
  }

  /** Adds only missing role-menu permissions without touching existing ones. */
  private async syncMissingPermissions() {
    for (const [role, slugs] of Object.entries(ROLE_MENUS) as [UserRole, string[]][]) {
      for (const slug of slugs) {
        const menu = await this.menuRepo.findOne({ where: { slug } });
        if (!menu) continue;
        const exists = await this.rmpRepo.findOne({ where: { role, menuId: menu.id } });
        if (!exists) {
          await this.rmpRepo.save(this.rmpRepo.create({ role, menuId: menu.id, isVisible: true }));
          console.log(`[MenusService] Added missing permission: ${role} → ${slug}`);
        }
      }
    }
  }

  async seed() {
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

  async getAllMenus(): Promise<Menu[]> {
    return this.menuRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async getPermissionsForRole(role: UserRole): Promise<RoleMenuPermission[]> {
    return this.rmpRepo.find({
      where: { role },
      relations: ['menu'],
      order: { menu: { sortOrder: 'ASC' } },
    });
  }

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

  async updateMenuOrder(menuId: number, sortOrder: number): Promise<Menu> {
    const menu = await this.menuRepo.findOne({ where: { id: menuId } });
    if (!menu) throw new NotFoundException(`Menu ${menuId} not found`);
    menu.sortOrder = sortOrder;
    return this.menuRepo.save(menu);
  }

  async getPermissionsMatrix(): Promise<{
    menus: { id: number; name: string; slug: string; icon: string; section: string; sortOrder: number }[];
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
        section: m.section || 'user_dashboard',
        sortOrder: m.sortOrder,
      })),
      permissions,
    };
  }
}

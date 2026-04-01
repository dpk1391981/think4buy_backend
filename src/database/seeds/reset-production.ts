/**
 * reset-production.ts
 *
 * Wipes all transactional / dummy data and leaves a clean production-ready DB.
 *
 * ✅ KEEPS  — all config & reference tables:
 *   countries · states · cities · locations
 *   amenities · prop_categories · prop_types · prop_type_amenities · prop_type_fields
 *   boost_plans · subscription_plans · services_catalog
 *   menus · role_menu_permissions
 *   message_services · message_templates · event_template_mappings
 *   seo_configs · footer_seo_links · footer_seo_link_groups · city_seo_pages
 *
 * 🗑️  CLEARS — all transactional / user-generated tables (see list below)
 *
 * 👤  CREATES — admin users (fresh wallets included)
 *
 * Usage:
 *   npm run reset:production
 *   CONFIRM=yes npm run reset:production    ← skip the interactive prompt
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

// ─── DB connection — no entities needed, pure raw SQL ─────────────────────────

const dataSource = new DataSource({
  type: 'mysql',
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'dpk1391981',
  password: process.env.DB_PASSWORD || 'Dpk1391981!',
  database: process.env.DB_NAME     || 'realestate_db',
  entities: [],
  synchronize: false,
});

// ─── Tables to wipe (order respects FK constraints) ───────────────────────────

const TRUNCATE_TABLES = [
  // Analytics & cache
  'analytics_events',
  'top_properties_cache',
  'top_agents_cache',
  'top_projects_cache',
  'top_locations_cache',
  'category_analytics',

  // Messaging logs (keep services / templates / mappings)
  'message_logs',

  // Notifications & OTP
  'notifications',
  'otp_verifications',

  // Alerts & saved
  'property_alerts',
  'saved_properties',

  // Agent activity
  'agent_feedback',
  'site_visits',
  'commissions',
  'deals',

  // Leads
  'lead_activity_logs',
  'lead_assignments',
  'leads',

  // Inquiries
  'inquiries',

  // Wallet transactions (wallets re-created with admin)
  'wallet_transactions',
  'wallets',

  // Agent subscriptions
  'agent_subscriptions',

  // Premium slots (reset to empty — re-seed manually if needed)
  'premium_slots',

  // Property data
  'property_views',
  'property_amenities',
  'property_images',
  'properties',

  // Agency & agent profiles
  'agent_location_map',
  'property_agent_map',
  'agent_profiles',
  'agencies',

  // Articles
  'articles',

  // Users last (referenced by everything above)
  'users',
];

// ─── Admin accounts to (re-)create ────────────────────────────────────────────

const ADMINS = [
  { name: 'Satish Pandit (Admin)',  email: 'info@think4buysale.in',  phone: '9958023001', password: 'Admin@123' },
  { name: 'Deepak Kumar (SA)', email: 'dpk1391981@gmail.com', phone: '8285257636', password: '1391981' },
];

// ─── Prompt helper ─────────────────────────────────────────────────────────────

function confirm(question: string): Promise<boolean> {
  if (process.env.CONFIRM === 'yes') return Promise.resolve(true);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() === 'yes');
    });
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⚠️  PRODUCTION RESET SCRIPT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  This will DELETE all users, properties, agencies, leads,');
  console.log('  inquiries, articles, wallets and other transactional data.');
  console.log('  Config tables (locations, menus, SEO, plans…) are kept.');
  console.log('═══════════════════════════════════════════════════════════\n');

  const ok = await confirm('  Type "yes" to proceed: ');
  if (!ok) {
    console.log('\n  Aborted — no changes made.\n');
    process.exit(0);
  }

  await dataSource.initialize();
  console.log('\n✅ DB connected\n');

  // ── 1. Truncate transactional tables ──────────────────────────────────────
  console.log(`🗑️  Truncating ${TRUNCATE_TABLES.length} tables…`);
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const table of TRUNCATE_TABLES) {
    try {
      await dataSource.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`   ✓ ${table}`);
    } catch (err: any) {
      console.warn(`   ⚠️  ${table} — ${err.message}`);
    }
  }

  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('\n✅ All transactional tables cleared\n');

  // ── 2. Re-create admin users via raw SQL ──────────────────────────────────
  console.log('👤 Creating admin users…');

  for (const a of ADMINS) {
    const id     = uuidv4();
    const wid    = uuidv4();
    const hashed = await bcrypt.hash(a.password, 10);

    await dataSource.query(
      `INSERT INTO users
         (id, name, email, phone, password, role, isVerified, isActive, needsOnboarding, isSuperAdmin, systemRoleId)
       VALUES (?, ?, ?, ?, ?, 'admin', 1, 1, 0, 1, '8e208aca-2a00-11f1-b1b4-80e8d4b68b3f')`,
      [id, a.name, a.email, a.phone, hashed],
    );

    await dataSource.query(
      `INSERT INTO wallets (id, user_id, balance) VALUES (?, ?, 0)`,
      [wid, id],
    );

    console.log(`   ✓ ${a.name} — ${a.email} / ${a.password}  (phone: ${a.phone})`);
  }

  await dataSource.destroy();

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('✅ Production reset complete');
  console.log('');
  console.log('   KEPT (untouched):');
  console.log('     • countries / states / cities / locations');
  console.log('     • amenities / prop_categories / prop_types');
  console.log('     • boost_plans / subscription_plans / services_catalog');
  console.log('     • menus / role_menu_permissions');
  console.log('     • message_services / message_templates / event_template_mappings');
  console.log('     • seo_configs / footer_seo_links / city_seo_pages');
  console.log('');
  console.log('   Next steps:');
  console.log('     npm run seed:locations-xlsx    ← re-seed locations if needed');
  console.log('     npm run seed:footer-links      ← re-seed footer SEO links');
  console.log('     npm run seed:messaging         ← re-seed message templates');
  console.log('══════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n❌ Reset failed:', err.message);
  process.exit(1);
});

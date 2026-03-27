/**
 * Super Admin Seeder
 * -----------------
 * Run with:  npx ts-node -r tsconfig-paths/register src/database/seeds/seed-super-admin.ts
 *
 * Creates (or updates) the Super Admin user and ensures all default
 * roles & permissions exist in the DB.
 *
 * Idempotent — safe to run multiple times.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcryptjs');
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const SUPER_ADMIN = {
  name:     'Deepak Kumar',
  email:    'dpk1391981@gmail.com',
  phone:    '8285257636',
  password: '1391981',
};

const dataSource = new DataSource({
  type:     'mysql',
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'realestate_db',
  entities: [
    path.resolve(__dirname, '../../modules/**/*.entity.{ts,js}'),
  ],
  synchronize: false,
  charset: 'utf8mb4',
});

async function run() {
  await dataSource.initialize();
  console.log('✅ DB connected');

  // ── 1. Ensure super_admin role exists ──────────────────────────────────────
  const [existingRole] = await dataSource.query(
    `SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1`,
  );
  let superAdminRoleId: string | null = existingRole?.id ?? null;

  if (!superAdminRoleId) {
    const { raw } = await dataSource.query(
      `INSERT INTO roles (id, name, displayName, description, isSystem, isActive, level, createdAt, updatedAt)
       VALUES (UUID(), 'super_admin', 'Super Admin', 'Full system access — root control', 1, 1, 100, NOW(), NOW())`,
    );
    const [row] = await dataSource.query(`SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1`);
    superAdminRoleId = row.id;
    console.log('✅ super_admin role created:', superAdminRoleId);
  } else {
    console.log('ℹ️  super_admin role already exists:', superAdminRoleId);
  }

  // ── 2. Grant ALL permissions to super_admin role ───────────────────────────
  const allPerms: { id: string }[] = await dataSource.query(
    `SELECT id FROM permissions WHERE isActive = 1`,
  );

  if (allPerms.length > 0) {
    // Remove existing and re-insert (idempotent)
    await dataSource.query(
      `DELETE FROM role_permissions WHERE roleId = ?`, [superAdminRoleId],
    );
    for (const p of allPerms) {
      await dataSource.query(
        `INSERT IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`,
        [superAdminRoleId, p.id],
      );
    }
    console.log(`✅ Assigned ${allPerms.length} permissions to super_admin role`);
  }

  // ── 3. Create / update Super Admin user ────────────────────────────────────
  const hashed = await bcrypt.hash(SUPER_ADMIN.password, 12);

  const [existing] = await dataSource.query(
    `SELECT id FROM users WHERE email = ? LIMIT 1`, [SUPER_ADMIN.email],
  );

  if (existing) {
    await dataSource.query(
      `UPDATE users
       SET name = ?, phone = ?, password = ?, role = 'super_admin',
           isSuperAdmin = 1, systemRoleId = ?, isActive = 1, isVerified = 1,
           updatedAt = NOW()
       WHERE id = ?`,
      [SUPER_ADMIN.name, SUPER_ADMIN.phone, hashed, superAdminRoleId, existing.id],
    );
    console.log(`✅ Super Admin updated (id: ${existing.id})`);
  } else {
    await dataSource.query(
      `INSERT INTO users
         (id, name, email, phone, password, role, isSuperAdmin, systemRoleId,
          isActive, isVerified, needsOnboarding,
          agentFreeQuota, agentUsedQuota, agentTick, agentProfileStatus,
          totalDeals, dailyCreditUsed, failedLoginAttempts,
          createdAt, updatedAt)
       VALUES
         (UUID(), ?, ?, ?, ?, 'super_admin', 1, ?,
          1, 1, 0,
          100, 0, 'none', 'none',
          0, 0, 0,
          NOW(), NOW())`,
      [SUPER_ADMIN.name, SUPER_ADMIN.email, SUPER_ADMIN.phone, hashed, superAdminRoleId],
    );
    const [newUser] = await dataSource.query(
      `SELECT id FROM users WHERE email = ? LIMIT 1`, [SUPER_ADMIN.email],
    );
    console.log(`✅ Super Admin created (id: ${newUser.id})`);
  }

  console.log('\n🎉 Super Admin seeder completed successfully');
  console.log(`   Email:    ${SUPER_ADMIN.email}`);
  console.log(`   Phone:    ${SUPER_ADMIN.phone}`);
  console.log(`   Password: ${SUPER_ADMIN.password}  ← change after first login!`);

  await dataSource.destroy();
}

run().catch((err) => {
  console.error('❌ Seeder failed:', err.message);
  process.exit(1);
});

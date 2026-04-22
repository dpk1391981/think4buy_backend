/**
 * run-json-seed.ts
 *
 * Generic runner for JSON seed files.
 * Reads the `sql` array from a JSON seed file and executes each statement.
 *
 * Usage:
 *   npm run seed:json -- src/database/seeds/seed-menu-seo-items.json
 *   npm run seed:json -- src/database/seeds/some-other-seed.json
 *
 * JSON seed file format:
 * {
 *   "_description": "...",
 *   "sql": [
 *     "INSERT IGNORE INTO ...",
 *     "UPDATE ..."
 *   ]
 * }
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { DataSource } from 'typeorm';

const ds = new DataSource({
  type:        'mysql',
  host:        process.env.DB_HOST     || 'localhost',
  port:        Number(process.env.DB_PORT) || 3306,
  username:    process.env.DB_USERNAME || 'root',
  password:    process.env.DB_PASSWORD || '',
  database:    process.env.DB_NAME     || 'realestate_db',
  synchronize: false,
  logging:     false,
});

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('❌  No seed file specified.');
    console.error('    Usage: npm run seed:json -- <path-to-seed.json>');
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌  File not found: ${resolved}`);
    process.exit(1);
  }

  const seed = JSON.parse(fs.readFileSync(resolved, 'utf-8'));

  if (!Array.isArray(seed.sql) || seed.sql.length === 0) {
    console.error('❌  No "sql" array found in seed file.');
    process.exit(1);
  }

  if (seed._description) {
    console.log(`📄  ${seed._description}\n`);
  }

  console.log(`📂  File  : ${resolved}`);
  console.log(`📋  Statements: ${seed.sql.length}\n`);

  await ds.initialize();
  console.log('✅  Connected to DB\n');

  let ok = 0, failed = 0;

  for (const [i, sql] of seed.sql.entries()) {
    const preview = sql.trim().slice(0, 80).replace(/\s+/g, ' ');
    try {
      await ds.query(sql);
      console.log(`  ✓  [${i + 1}] ${preview}…`);
      ok++;
    } catch (err: any) {
      console.error(`  ✗  [${i + 1}] ${preview}…`);
      console.error(`        Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅  Done — ${ok} succeeded, ${failed} failed`);
  await ds.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });

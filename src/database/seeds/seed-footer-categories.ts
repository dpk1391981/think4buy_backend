/**
 * seed-footer-categories.ts
 *
 * Seeds the footer_seo_categories table with the 10 default categories.
 * Safe to re-run: skips rows whose `value` slug already exists.
 *
 * Run:
 *   npm run seed:footer-categories
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { DataSource } from 'typeorm';

const ds = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'realestate_db',
  synchronize: false,
  logging: false,
});

const CATEGORIES = [
  { value: 'buy',          label: 'Property for Sale',     short: 'Buy',          sortOrder: 0  },
  { value: 'rent',         label: 'Property for Rent',     short: 'Rent',         sortOrder: 1  },
  { value: 'flats',        label: 'Flats for Sale',        short: 'Flats',        sortOrder: 2  },
  { value: 'flats-rent',   label: 'Flats for Rent',        short: 'Flats Rent',   sortOrder: 3  },
  { value: 'villas',       label: 'Villas for Sale',       short: 'Villas',       sortOrder: 4  },
  { value: 'plots',        label: 'Plots for Sale',        short: 'Plots',        sortOrder: 5  },
  { value: 'commercial',   label: 'Commercial for Rent',   short: 'Commercial',   sortOrder: 6  },
  { value: 'office',       label: 'Office Space for Rent', short: 'Office',       sortOrder: 7  },
  { value: 'new-projects', label: 'New Projects',          short: 'New Projects', sortOrder: 8  },
  { value: 'pg',           label: 'PG / Co-Living',        short: 'PG',           sortOrder: 9  },
];

async function main() {
  await ds.initialize();
  console.log('Connected. Seeding footer categories...\n');

  let inserted = 0;
  let skipped  = 0;

  for (const cat of CATEGORIES) {
    const [existing] = await ds.query(
      'SELECT id FROM footer_seo_categories WHERE `value` = ? LIMIT 1',
      [cat.value],
    );
    if (existing) {
      console.log(`  ⏭  Skipped (exists): ${cat.value}`);
      skipped++;
      continue;
    }
    await ds.query(
      `INSERT INTO footer_seo_categories (id, \`value\`, label, short, sortOrder, isActive, createdAt, updatedAt)
       VALUES (UUID(), ?, ?, ?, ?, 1, NOW(), NOW())`,
      [cat.value, cat.label, cat.short, cat.sortOrder],
    );
    console.log(`  ✓  Inserted: ${cat.value} — ${cat.label}`);
    inserted++;
  }

  console.log(`\n✅  Inserted : ${inserted}`);
  console.log(`⏭   Skipped  : ${skipped}`);

  await ds.destroy();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });

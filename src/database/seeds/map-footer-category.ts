/**
 * map-footer-category.ts
 *
 * Auto-maps existing footer_seo_link_groups to a `category` slug
 * by matching the group title against known patterns.
 *
 * Safe to re-run: only updates rows where category IS NULL or --force flag.
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/map-footer-category.ts
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/map-footer-category.ts --force
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

// ── category patterns (order matters — most specific first) ───────────────────

const RULES: { pattern: RegExp; category: string; label: string }[] = [
  // Villas before generic "sale"
  { pattern: /villas?\s+for\s+sale/i,              category: 'villas',       label: 'Villas for Sale'          },
  // Plots before generic "sale"
  { pattern: /plots?\s+for\s+sale/i,               category: 'plots',        label: 'Plots for Sale'           },
  // Commercial before generic "rent"
  { pattern: /commercial\s+propert/i,              category: 'commercial',   label: 'Commercial for Rent'      },
  // Office before generic "rent"
  { pattern: /office\s+space/i,                    category: 'office',       label: 'Office Space for Rent'    },
  // Flats rent before flats sale
  { pattern: /flats?\s+for\s+rent/i,               category: 'flats-rent',   label: 'Flats for Rent'           },
  // Flats sale
  { pattern: /flats?\s+for\s+sale/i,               category: 'flats',        label: 'Flats for Sale'           },
  // PG / Co-Living
  { pattern: /pg\s*[\/,]\s*co.?living/i,           category: 'pg',           label: 'PG / Co-Living'           },
  { pattern: /\bpg\b/i,                            category: 'pg',           label: 'PG / Co-Living'           },
  // New Projects
  { pattern: /new\s+project/i,                     category: 'new-projects', label: 'New Projects'             },
  // Property for Rent before Property for Sale
  { pattern: /property\s+for\s+rent/i,             category: 'rent',         label: 'Property for Rent'        },
  // Property for Sale / generic "for sale"
  { pattern: /property\s+for\s+sale/i,             category: 'buy',          label: 'Property for Sale'        },
  { pattern: /propert(?:y|ies)\s+for\s+sale/i,     category: 'buy',          label: 'Property for Sale'        },
];

function detectCategory(title: string): { category: string; label: string } | null {
  for (const rule of RULES) {
    if (rule.pattern.test(title)) {
      return { category: rule.category, label: rule.label };
    }
  }
  return null;
}

async function main() {
  const force = process.argv.includes('--force');

  await ds.initialize();
  console.log(`Connected. Mapping footer group categories... (force=${force})\n`);

  const groups: { id: string; title: string; category: string | null }[] = await ds.query(
    `SELECT id, title, category FROM footer_seo_link_groups ORDER BY sortOrder`
  );

  let updated = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const g of groups) {
    if (g.category && !force) {
      skipped++;
      continue;
    }

    const match = detectCategory(g.title);
    if (!match) {
      console.log(`  ⚠  No match: "${g.title}"`);
      noMatch++;
      continue;
    }

    await ds.query(
      `UPDATE footer_seo_link_groups SET category = ? WHERE id = ?`,
      [match.category, g.id]
    );
    updated++;
    const was = g.category ? ` (was: ${g.category})` : '';
    console.log(`  ✓  "${g.title}" → ${match.category}${was}`);
  }

  console.log(`\n✅  Updated : ${updated}`);
  console.log(`⏭   Skipped : ${skipped} (already had category; use --force to overwrite)`);
  if (noMatch > 0) {
    console.log(`⚠   No match: ${noMatch} (set category manually in admin)`);
  }

  // Summary
  const summary: { category: string | null; count: string }[] = await ds.query(`
    SELECT category, COUNT(*) as count
    FROM footer_seo_link_groups
    GROUP BY category
    ORDER BY category
  `);
  console.log('\n── Summary ───────────────────────────────');
  for (const row of summary) {
    console.log(`  ${(row.category ?? 'NULL').padEnd(16)} : ${row.count} groups`);
  }

  await ds.destroy();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });

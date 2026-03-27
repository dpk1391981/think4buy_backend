/**
 * Property Config Seed
 *
 * Reads prop_categories and prop_types dynamically from the DB (set up via
 * admin panel), then verifies every existing property's type/category slug
 * resolves to a known row. Any orphan slug found on properties that has no
 * matching row in prop_categories / prop_types is auto-created so labels are
 * never blank on property cards, detail pages, or the homepage section.
 *
 * Safe to re-run — skips rows that already exist.
 *
 * Run: npm run seed:property-config
 *   or: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-property-config.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { PropCategory } from '../../modules/property-config/entities/prop-category.entity';
import { PropType } from '../../modules/property-config/entities/prop-type.entity';
import { PropTypeAmenity } from '../../modules/property-config/entities/prop-type-amenity.entity';
import { PropTypeField } from '../../modules/property-config/entities/prop-type-field.entity';
import { ListingFilterConfig } from '../../modules/property-config/entities/listing-filter-config.entity';
import { Amenity } from '../../modules/properties/entities/amenity.entity';

// ─── DataSource ────────────────────────────────────────────────────────────────

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'dpk1391981',
  password: process.env.DB_PASSWORD || 'Dpk1391981!',
  database: process.env.DB_NAME || 'realestate_db',
  entities: [PropCategory, PropType, PropTypeAmenity, PropTypeField, ListingFilterConfig, Amenity],
  synchronize: false,
});

// ─── Fallback icon map — used only when auto-creating orphan rows ──────────────

const FALLBACK_CATEGORY_ICONS: Record<string, string> = {
  buy: '🏠', rent: '🔑', pg: '🛏️', commercial: '🏢',
  industrial: '🏭', builder_project: '🏗️', investment: '📈',
};

const FALLBACK_TYPE_ICONS: Record<string, string> = {
  apartment: '🏢', villa: '🏡', house: '🏠', builder_floor: '🏘️',
  penthouse: '🌆', studio: '🛋️', farm_house: '🌾', plot: '📐',
  pg: '🛏️', co_living: '🏘️', commercial_office: '💼',
  commercial_shop: '🛒', showroom: '🚗', commercial_warehouse: '📦',
  factory: '🏭', industrial_shed: '🏗️', land: '🌍',
};

/** Convert a slug like "builder_floor" → "Builder Floor" */
function slugToLabel(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Seed ──────────────────────────────────────────────────────────────────────

async function seedPropertyConfig() {
  await dataSource.initialize();
  console.log('[PropertyConfig Seed] Database connected\n');

  const catRepo  = dataSource.getRepository(PropCategory);
  const typeRepo = dataSource.getRepository(PropType);

  // ── STEP 1: Load all categories from DB (dynamic — set by admin panel) ────────
  console.log('[PropertyConfig Seed] Step 1: Loading prop_categories from DB...');
  const allCategories = await catRepo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  const catMap = new Map<string, string>(); // slug → id
  for (const c of allCategories) catMap.set(c.slug, c.id);

  console.log(`  Found ${allCategories.length} categor${allCategories.length === 1 ? 'y' : 'ies'}:`);
  allCategories.forEach(c => console.log(`    [${c.status ? '✓' : '✗'}] ${c.slug}  →  "${c.name}"  (id: ${c.id})`));

  // ── STEP 2: Load all property types from DB (dynamic — set by admin panel) ────
  console.log('\n[PropertyConfig Seed] Step 2: Loading prop_types from DB...');
  const allTypes = await typeRepo.find({
    relations: ['category'],
    order: { category: { sortOrder: 'ASC' }, sortOrder: 'ASC', name: 'ASC' } as any,
  });
  const typeMap = new Map<string, string>(); // slug → id
  for (const t of allTypes) typeMap.set(t.slug, t.id);

  console.log(`  Found ${allTypes.length} type${allTypes.length === 1 ? '' : 's'}:`);
  allTypes.forEach(t =>
    console.log(`    [${t.status ? '✓' : '✗'}] ${t.slug}  →  "${t.name}"  (category: ${t.category?.slug ?? t.categoryId})`),
  );

  // ── STEP 3: Find property slugs that don't resolve to any DB row ──────────────
  console.log('\n[PropertyConfig Seed] Step 3: Scanning existing properties for orphan slugs...');

  const orphanCategories: { category: string; count: string }[] = await dataSource.query(`
    SELECT p.category, COUNT(*) AS count
    FROM properties p
    LEFT JOIN prop_categories pc ON pc.slug = p.category
    WHERE pc.id IS NULL
      AND p.category IS NOT NULL AND p.category != ''
    GROUP BY p.category
    ORDER BY count DESC
  `);

  const orphanTypes: { type: string; count: string }[] = await dataSource.query(`
    SELECT p.type, COUNT(*) AS count
    FROM properties p
    LEFT JOIN prop_types pt ON pt.slug = p.type
    WHERE pt.id IS NULL
      AND p.type IS NOT NULL AND p.type != ''
    GROUP BY p.type
    ORDER BY count DESC
  `);

  // ── STEP 4: Auto-create any orphan category rows ──────────────────────────────
  let catsCreated = 0;
  if (orphanCategories.length > 0) {
    console.log(`\n[PropertyConfig Seed] Step 4: Auto-creating ${orphanCategories.length} orphan categor${orphanCategories.length === 1 ? 'y' : 'ies'}...`);
    for (const row of orphanCategories) {
      const existing = await catRepo.findOne({ where: { slug: row.category } });
      if (existing) { catMap.set(row.category, existing.id); continue; } // race guard

      const cat = await catRepo.save(
        catRepo.create({
          name:        slugToLabel(row.category),
          slug:        row.category,
          icon:        FALLBACK_CATEGORY_ICONS[row.category] ?? '🏷️',
          description: `${slugToLabel(row.category)} properties`,
          sortOrder:   allCategories.length + catsCreated + 1,
          status:      true,
        }),
      );
      catMap.set(cat.slug, cat.id);
      catsCreated++;
      console.log(`  [+] Created category: "${cat.slug}" → "${cat.name}" (${cat.id})  [${row.count} properties affected]`);
    }
  } else {
    console.log('\n[PropertyConfig Seed] Step 4: No orphan categories — all property.category slugs resolve. ✅');
  }

  // ── STEP 5: Auto-create any orphan type rows ──────────────────────────────────
  let typesCreated = 0;
  if (orphanTypes.length > 0) {
    console.log(`\n[PropertyConfig Seed] Step 5: Auto-creating ${orphanTypes.length} orphan type${orphanTypes.length === 1 ? '' : 's'}...`);

    // Pick a default fallback category id (use 'buy' if available, else first category)
    const fallbackCatId = catMap.get('buy') ?? (allCategories[0]?.id ?? null);

    for (const row of orphanTypes) {
      const existing = await typeRepo.findOne({ where: { slug: row.type } });
      if (existing) { typeMap.set(row.type, existing.id); continue; } // race guard

      if (!fallbackCatId) {
        console.warn(`  [!] No category found to assign type "${row.type}" — skipping. Create at least one category first.`);
        continue;
      }

      const pt = await typeRepo.save(
        typeRepo.create({
          name:       slugToLabel(row.type),
          slug:       row.type,
          icon:       FALLBACK_TYPE_ICONS[row.type] ?? '🏠',
          categoryId: fallbackCatId,
          sortOrder:  allTypes.length + typesCreated + 1,
          aliasOf:    null,
          status:     true,
        }),
      );
      typeMap.set(pt.slug, pt.id);
      typesCreated++;
      console.log(`  [+] Created type: "${pt.slug}" → "${pt.name}" (${pt.id})  [${row.count} properties affected]`);
    }
  } else {
    console.log('\n[PropertyConfig Seed] Step 5: No orphan types — all property.type slugs resolve. ✅');
  }

  // ── STEP 6: Final verification ────────────────────────────────────────────────
  console.log('\n[PropertyConfig Seed] Step 6: Final verification...');

  const stillMissingCats: { category: string; count: string }[] = await dataSource.query(`
    SELECT p.category, COUNT(*) AS count
    FROM properties p
    LEFT JOIN prop_categories pc ON pc.slug = p.category
    WHERE pc.id IS NULL AND p.category IS NOT NULL AND p.category != ''
    GROUP BY p.category
  `);

  const stillMissingTypes: { type: string; count: string }[] = await dataSource.query(`
    SELECT p.type, COUNT(*) AS count
    FROM properties p
    LEFT JOIN prop_types pt ON pt.slug = p.type
    WHERE pt.id IS NULL AND p.type IS NOT NULL AND p.type != ''
    GROUP BY p.type
  `);

  if (stillMissingCats.length === 0 && stillMissingTypes.length === 0) {
    console.log('  ✅ All property category and type slugs resolve correctly.');
  } else {
    if (stillMissingCats.length > 0) {
      console.warn('  ⚠️  Still unresolved categories:');
      stillMissingCats.forEach(r => console.warn(`     category="${r.category}"  count=${r.count}`));
    }
    if (stillMissingTypes.length > 0) {
      console.warn('  ⚠️  Still unresolved types:');
      stillMissingTypes.forEach(r => console.warn(`     type="${r.type}"  count=${r.count}`));
    }
  }

  console.log(`
[PropertyConfig Seed] ✅ Done!
  Categories in DB   : ${allCategories.length + catsCreated}  (${catsCreated} auto-created)
  Types in DB        : ${allTypes.length + typesCreated}  (${typesCreated} auto-created)
  `);

  await dataSource.destroy();
}

seedPropertyConfig().catch((err) => {
  console.error('[PropertyConfig Seed] ❌ Error:', err);
  process.exit(1);
});

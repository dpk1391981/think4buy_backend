/**
 * Property Config Seed + Data Migration
 *
 * 1. Reads prop_categories and prop_types dynamically from DB.
 * 2. Backfills empty type/category on existing properties by parsing titles.
 * 3. Auto-creates any orphan slug rows still missing after backfill.
 * 4. Final verification: confirms every property resolves to a known row.
 *
 * Safe to re-run — skips already-set properties.
 *
 * Run: npm run seed:property-config
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

// ─── Title → type/category inference ──────────────────────────────────────────

/**
 * TYPE_RULES: ordered list of [titlePattern, typeSlug, categoryOverride | null]
 * - titlePattern: case-insensitive string to look for in the title
 * - typeSlug: the prop_types slug to assign
 * - categoryOverride: if set, always use this category regardless of sale/rent
 *   (null = derive from "for Sale" / "for Rent" in title → buy / rent)
 */
const TYPE_RULES: Array<[string, string, string | null]> = [
  // ── Commercial / Industrial (category is fixed regardless of sale/rent) ──────
  ['office space',      'commercial_office',    'commercial'],
  ['office',            'commercial_office',    'commercial'],
  ['warehouse',         'commercial_warehouse', 'commercial'],
  ['showroom',          'showroom',             'commercial'],
  ['commercial shop',   'commercial_shop',      'commercial'],
  ['shop',              'commercial_shop',      'commercial'],
  ['factory',           'factory',              'industrial'],
  ['industrial shed',   'industrial_shed',      'industrial'],
  // ── PG / Co-living ───────────────────────────────────────────────────────────
  ['co-living',         'co_living',            'pg'],
  ['co living',         'co_living',            'pg'],
  ['paying guest',      'pg',                   'pg'],
  // ── Investment / Land ────────────────────────────────────────────────────────
  ['farm house',        'farm_house',            null],   // farm houses → buy/rent
  ['farmhouse',         'farm_house',            null],
  ['land',              'land',                  'investment'],
  ['plot',              'plot',                  null],   // plots → buy
  // ── Residential (category from sale/rent keyword) ────────────────────────────
  ['independent house', 'house',                 null],
  ['builder floor',     'builder_floor',         null],
  ['penthouse',         'penthouse',             null],
  ['studio apartment',  'studio',                null],
  ['studio',            'studio',                null],
  ['apartment',         'apartment',             null],
  ['flat',              'apartment',             null],
  ['villa',             'villa',                 null],
  ['house',             'house',                 null],
];

function inferTypeAndCategory(
  title: string,
  listingType: string | null,
): { type: string; category: string } | null {
  const t = title.toLowerCase();

  for (const [pattern, typeSlug, catOverride] of TYPE_RULES) {
    if (t.includes(pattern)) {
      let category: string;

      if (catOverride) {
        category = catOverride;
      } else if (listingType && listingType !== '') {
        // listingType field is already buy/rent/commercial etc.
        category = listingType;
      } else if (t.includes('for rent')) {
        category = 'rent';
      } else if (t.includes('for sale')) {
        category = 'buy';
      } else {
        // Special defaults
        category = typeSlug === 'plot' || typeSlug === 'land' ? 'buy' : 'buy';
      }

      return { type: typeSlug, category };
    }
  }

  return null; // can't infer
}

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

function slugToLabel(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Seed ──────────────────────────────────────────────────────────────────────

async function seedPropertyConfig() {
  await dataSource.initialize();
  console.log('[PropertyConfig Seed] Database connected\n');

  const catRepo  = dataSource.getRepository(PropCategory);
  const typeRepo = dataSource.getRepository(PropType);

  // ── STEP 1: Load all categories from DB ──────────────────────────────────────
  console.log('[PropertyConfig Seed] Step 1: Loading prop_categories from DB...');
  const allCategories = await catRepo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  const catMap = new Map<string, string>(); // slug → id
  for (const c of allCategories) catMap.set(c.slug, c.id);
  console.log(`  Found ${allCategories.length} categories: ${allCategories.map(c => c.slug).join(', ')}`);

  // ── STEP 2: Load all types from DB ───────────────────────────────────────────
  console.log('[PropertyConfig Seed] Step 2: Loading prop_types from DB...');
  const allTypes = await typeRepo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  const typeMap = new Map<string, string>(); // slug → id
  for (const t of allTypes) typeMap.set(t.slug, t.id);
  console.log(`  Found ${allTypes.length} types: ${allTypes.map(t => t.slug).join(', ')}`);

  // ── STEP 3: Backfill properties with empty type / category ───────────────────
  console.log('\n[PropertyConfig Seed] Step 3: Backfilling properties with empty type/category...');

  const emptyProps: { id: string; title: string; listingType: string | null }[] =
    await dataSource.query(`
      SELECT id, title, listingType
      FROM properties
      WHERE (type IS NULL OR type = '') OR (category IS NULL OR category = '')
    `);

  console.log(`  Found ${emptyProps.length} properties with missing type/category`);

  let backfilled = 0;
  let skipped = 0;
  const cannotInfer: string[] = [];

  for (const prop of emptyProps) {
    const inferred = inferTypeAndCategory(prop.title, prop.listingType);

    if (!inferred) {
      console.warn(`  [?] Cannot infer  — "${prop.title}"`);
      cannotInfer.push(prop.id);
      skipped++;
      continue;
    }

    await dataSource.query(
      `UPDATE properties SET type = ?, category = ? WHERE id = ?`,
      [inferred.type, inferred.category, prop.id],
    );
    console.log(`  [✓] "${prop.title.substring(0, 60)}"  →  type=${inferred.type}  category=${inferred.category}`);
    backfilled++;
  }

  console.log(`\n  Backfilled: ${backfilled}  |  Could not infer: ${skipped}`);

  // ── STEP 4: Auto-create orphan category rows (slugs on properties with no DB row) ──
  console.log('\n[PropertyConfig Seed] Step 4: Checking for orphan category slugs...');

  const orphanCategories: { category: string; count: string }[] = await dataSource.query(`
    SELECT p.category, COUNT(*) AS count
    FROM properties p
    LEFT JOIN prop_categories pc ON pc.slug = p.category
    WHERE pc.id IS NULL AND p.category IS NOT NULL AND p.category != ''
    GROUP BY p.category ORDER BY count DESC
  `);

  if (orphanCategories.length === 0) {
    console.log('  No orphan categories. ✅');
  } else {
    for (const row of orphanCategories) {
      const existing = await catRepo.findOne({ where: { slug: row.category } });
      if (existing) { catMap.set(row.category, existing.id); continue; }

      const cat = await catRepo.save(catRepo.create({
        name: slugToLabel(row.category),
        slug: row.category,
        icon: FALLBACK_CATEGORY_ICONS[row.category] ?? '🏷️',
        description: `${slugToLabel(row.category)} properties`,
        sortOrder: allCategories.length + 1,
        status: true,
      }));
      catMap.set(cat.slug, cat.id);
      console.log(`  [+] Created category: "${cat.slug}" → "${cat.name}" [${row.count} properties]`);
    }
  }

  // ── STEP 5: Auto-create orphan type rows ─────────────────────────────────────
  console.log('\n[PropertyConfig Seed] Step 5: Checking for orphan type slugs...');

  const orphanTypes: { type: string; count: string }[] = await dataSource.query(`
    SELECT p.type, COUNT(*) AS count
    FROM properties p
    LEFT JOIN prop_types pt ON pt.slug = p.type
    WHERE pt.id IS NULL AND p.type IS NOT NULL AND p.type != ''
    GROUP BY p.type ORDER BY count DESC
  `);

  if (orphanTypes.length === 0) {
    console.log('  No orphan types. ✅');
  } else {
    const fallbackCatId = catMap.get('buy') ?? allCategories[0]?.id ?? null;
    for (const row of orphanTypes) {
      const existing = await typeRepo.findOne({ where: { slug: row.type } });
      if (existing) { typeMap.set(row.type, existing.id); continue; }

      if (!fallbackCatId) {
        console.warn(`  [!] No category to assign type "${row.type}" — create a category first.`);
        continue;
      }
      const pt = await typeRepo.save(typeRepo.create({
        name: slugToLabel(row.type),
        slug: row.type,
        icon: FALLBACK_TYPE_ICONS[row.type] ?? '🏠',
        categoryId: fallbackCatId,
        sortOrder: allTypes.length + 1,
        aliasOf: null,
        status: true,
      }));
      typeMap.set(pt.slug, pt.id);
      console.log(`  [+] Created type: "${pt.slug}" → "${pt.name}" [${row.count} properties]`);
    }
  }

  // ── STEP 6: Final verification ────────────────────────────────────────────────
  console.log('\n[PropertyConfig Seed] Step 6: Final verification...');

  const [stats]: any = await dataSource.query(`
    SELECT
      COUNT(*) AS total,
      SUM(type IS NULL OR type = '') AS emptyType,
      SUM(category IS NULL OR category = '') AS emptyCat
    FROM properties
  `);

  const stillMissingCats: any[] = await dataSource.query(`
    SELECT p.category, COUNT(*) AS count FROM properties p
    LEFT JOIN prop_categories pc ON pc.slug = p.category
    WHERE pc.id IS NULL AND p.category IS NOT NULL AND p.category != ''
    GROUP BY p.category
  `);

  const stillMissingTypes: any[] = await dataSource.query(`
    SELECT p.type, COUNT(*) AS count FROM properties p
    LEFT JOIN prop_types pt ON pt.slug = p.type
    WHERE pt.id IS NULL AND p.type IS NOT NULL AND p.type != ''
    GROUP BY p.type
  `);

  console.log(`  Total properties : ${stats.total}`);
  console.log(`  Still empty type : ${stats.emptyType}`);
  console.log(`  Still empty cat  : ${stats.emptyCat}`);

  if (stillMissingCats.length === 0 && stillMissingTypes.length === 0 && stats.emptyType == 0 && stats.emptyCat == 0) {
    console.log('  ✅ All properties have type and category resolving correctly.');
  } else {
    stillMissingCats.forEach((r: any) => console.warn(`  ⚠️  Unresolved category="${r.category}" count=${r.count}`));
    stillMissingTypes.forEach((r: any) => console.warn(`  ⚠️  Unresolved type="${r.type}" count=${r.count}`));
    if (cannotInfer.length > 0) {
      console.warn(`  ⚠️  ${cannotInfer.length} properties could not be inferred from title — update manually.`);
    }
  }

  console.log(`
[PropertyConfig Seed] ✅ Done!
  Properties backfilled : ${backfilled}
  Properties skipped    : ${skipped}
  `);

  await dataSource.destroy();
}

seedPropertyConfig().catch((err) => {
  console.error('[PropertyConfig Seed] ❌ Error:', err);
  process.exit(1);
});

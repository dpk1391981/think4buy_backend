/**
 * Property Config Seed
 *
 * Seeds prop_categories and prop_types with all enum values used by existing
 * properties so that type/category labels are no longer blank on property cards,
 * detail pages, and the homepage top-properties section.
 *
 * Safe to re-run — uses upsert / skip-if-exists logic.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-property-config.ts
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

// ─── Category definitions (slugs must match PropertyCategory enum) ────────────

const CATEGORIES: Array<{
  name: string;
  slug: string;
  icon: string;
  description: string;
  sortOrder: number;
}> = [
  {
    name: 'Buy',
    slug: 'buy',
    icon: '🏠',
    description: 'Properties available for purchase — residential homes, apartments, villas and plots.',
    sortOrder: 1,
  },
  {
    name: 'Rent',
    slug: 'rent',
    icon: '🔑',
    description: 'Properties available on rental basis — apartments, houses, builder floors.',
    sortOrder: 2,
  },
  {
    name: 'PG / Co-living',
    slug: 'pg',
    icon: '🛏️',
    description: 'Paying-guest accommodations, co-living spaces and hostel-style rooms.',
    sortOrder: 3,
  },
  {
    name: 'Commercial',
    slug: 'commercial',
    icon: '🏢',
    description: 'Commercial spaces — offices, shops, showrooms and warehouses.',
    sortOrder: 4,
  },
  {
    name: 'Industrial',
    slug: 'industrial',
    icon: '🏭',
    description: 'Industrial properties — factories, sheds, warehouses and land.',
    sortOrder: 5,
  },
  {
    name: 'Builder Projects',
    slug: 'builder_project',
    icon: '🏗️',
    description: 'New launch and under-construction projects directly from builders.',
    sortOrder: 6,
  },
  {
    name: 'Investment',
    slug: 'investment',
    icon: '📈',
    description: 'Land parcels and properties with high investment potential.',
    sortOrder: 7,
  },
];

// ─── Type definitions (slugs must match PropertyType enum) ───────────────────
// primaryCategory = slug of the category this type is primarily listed under

const TYPES: Array<{
  name: string;
  slug: string;
  icon: string;
  primaryCategory: string;
  sortOrder: number;
  aliasOf?: string;
}> = [
  // ── Buy / Rent residential ──────────────────────────────────────────────────
  { name: 'Apartment',      slug: 'apartment',      icon: '🏢', primaryCategory: 'buy',            sortOrder: 1 },
  { name: 'Villa',          slug: 'villa',          icon: '🏡', primaryCategory: 'buy',            sortOrder: 2 },
  { name: 'House',          slug: 'house',          icon: '🏠', primaryCategory: 'buy',            sortOrder: 3 },
  { name: 'Builder Floor',  slug: 'builder_floor',  icon: '🏘️', primaryCategory: 'buy',            sortOrder: 4 },
  { name: 'Penthouse',      slug: 'penthouse',      icon: '🌆', primaryCategory: 'buy',            sortOrder: 5 },
  { name: 'Studio',         slug: 'studio',         icon: '🛋️', primaryCategory: 'rent',           sortOrder: 6 },
  { name: 'Farm House',     slug: 'farm_house',     icon: '🌾', primaryCategory: 'buy',            sortOrder: 7 },
  { name: 'Plot',           slug: 'plot',           icon: '📐', primaryCategory: 'buy',            sortOrder: 8 },

  // ── PG / Co-living ──────────────────────────────────────────────────────────
  { name: 'PG',             slug: 'pg',             icon: '🛏️', primaryCategory: 'pg',             sortOrder: 1 },
  { name: 'Co-Living',      slug: 'co_living',      icon: '🏘️', primaryCategory: 'pg',             sortOrder: 2 },

  // ── Commercial ─────────────────────────────────────────────────────────────
  { name: 'Office Space',   slug: 'commercial_office',    icon: '💼', primaryCategory: 'commercial', sortOrder: 1 },
  { name: 'Shop / Retail',  slug: 'commercial_shop',      icon: '🛒', primaryCategory: 'commercial', sortOrder: 2 },
  { name: 'Showroom',       slug: 'showroom',             icon: '🚗', primaryCategory: 'commercial', sortOrder: 3 },
  { name: 'Warehouse',      slug: 'commercial_warehouse', icon: '📦', primaryCategory: 'commercial', sortOrder: 4 },

  // ── Industrial ─────────────────────────────────────────────────────────────
  { name: 'Factory',        slug: 'factory',        icon: '🏭', primaryCategory: 'industrial',     sortOrder: 1 },
  { name: 'Industrial Shed',slug: 'industrial_shed',icon: '🏗️', primaryCategory: 'industrial',     sortOrder: 2 },

  // ── Investment / Land ──────────────────────────────────────────────────────
  { name: 'Land',           slug: 'land',           icon: '🌍', primaryCategory: 'investment',     sortOrder: 1 },
];

// ─── DataSource ───────────────────────────────────────────────────────────────

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

async function seedPropertyConfig() {
  await dataSource.initialize();
  console.log('[PropertyConfig Seed] Database connected');

  const catRepo  = dataSource.getRepository(PropCategory);
  const typeRepo = dataSource.getRepository(PropType);

  // ── STEP 1: Seed categories ──────────────────────────────────────────────────
  console.log('[PropertyConfig Seed] Step 1: Seeding prop_categories...');

  const catMap = new Map<string, string>(); // slug → id

  for (const def of CATEGORIES) {
    let cat = await catRepo.findOne({ where: { slug: def.slug } });
    if (!cat) {
      cat = await catRepo.save(
        catRepo.create({
          name: def.name,
          slug: def.slug,
          icon: def.icon,
          description: def.description,
          sortOrder: def.sortOrder,
          status: true,
        }),
      );
      console.log(`  [+] Created category: ${def.slug} (${cat.id})`);
    } else {
      // Update name/icon/sortOrder in case they changed
      cat.name      = def.name;
      cat.icon      = def.icon;
      cat.sortOrder = def.sortOrder;
      if (!cat.description) cat.description = def.description;
      await catRepo.save(cat);
      console.log(`  [=] Category already exists: ${def.slug} (${cat.id})`);
    }
    catMap.set(def.slug, cat.id);
  }

  console.log(`[PropertyConfig Seed] Categories done. Total: ${catMap.size}`);

  // ── STEP 2: Seed property types ──────────────────────────────────────────────
  console.log('[PropertyConfig Seed] Step 2: Seeding prop_types...');

  let created = 0;
  let updated = 0;

  for (const def of TYPES) {
    const categoryId = catMap.get(def.primaryCategory);
    if (!categoryId) {
      console.warn(`  [!] Category not found for type ${def.slug} (primaryCategory=${def.primaryCategory}) — skipping`);
      continue;
    }

    let pt = await typeRepo.findOne({ where: { slug: def.slug } });
    if (!pt) {
      pt = await typeRepo.save(
        typeRepo.create({
          name:       def.name,
          slug:       def.slug,
          icon:       def.icon,
          categoryId,
          sortOrder:  def.sortOrder,
          aliasOf:    def.aliasOf ?? null,
          status:     true,
        }),
      );
      console.log(`  [+] Created type: ${def.slug} → ${def.primaryCategory} (${pt.id})`);
      created++;
    } else {
      // Keep existing categoryId — only update display fields
      pt.name      = def.name;
      pt.icon      = def.icon;
      pt.sortOrder = def.sortOrder;
      if (def.aliasOf !== undefined) pt.aliasOf = def.aliasOf;
      await typeRepo.save(pt);
      console.log(`  [=] Type already exists: ${def.slug} (${pt.id})`);
      updated++;
    }
  }

  console.log(`[PropertyConfig Seed] Types done. Created: ${created}, Updated: ${updated}`);

  // ── STEP 3: Verify sync with existing properties ─────────────────────────────
  console.log('[PropertyConfig Seed] Step 3: Checking sync with existing properties...');

  const missingCategories: { category: string; count: string }[] = await dataSource.query(`
    SELECT p.category, COUNT(*) AS count
    FROM properties p
    LEFT JOIN prop_categories pc ON pc.slug = p.category
    WHERE pc.id IS NULL
      AND p.category IS NOT NULL AND p.category != ''
    GROUP BY p.category
  `);

  const missingTypes: { type: string; count: string }[] = await dataSource.query(`
    SELECT p.type, COUNT(*) AS count
    FROM properties p
    LEFT JOIN prop_types pt ON pt.slug = p.type
    WHERE pt.id IS NULL
      AND p.type IS NOT NULL AND p.type != ''
    GROUP BY p.type
  `);

  if (missingCategories.length > 0) {
    console.warn('[PropertyConfig Seed] ⚠️  Properties with unresolved category slugs:');
    missingCategories.forEach(r => console.warn(`     category="${r.category}"  count=${r.count}`));
  } else {
    console.log('[PropertyConfig Seed] ✅ All property categories resolve to a prop_categories row.');
  }

  if (missingTypes.length > 0) {
    console.warn('[PropertyConfig Seed] ⚠️  Properties with unresolved type slugs:');
    missingTypes.forEach(r => console.warn(`     type="${r.type}"  count=${r.count}`));
  } else {
    console.log('[PropertyConfig Seed] ✅ All property types resolve to a prop_types row.');
  }

  console.log(`
[PropertyConfig Seed] ✅ Seed complete!
  Categories seeded : ${catMap.size}
  Types created     : ${created}
  Types updated     : ${updated}
  `);

  await dataSource.destroy();
}

seedPropertyConfig().catch((err) => {
  console.error('[PropertyConfig Seed] ❌ Error:', err);
  process.exit(1);
});

/**
 * seed-quick-seo-templates.ts
 *
 * Seeds two groups of Quick SEO templates:
 *
 * GROUP A — City templates (10, one per footer SEO category)
 *   Slug pattern: {prefix}-in-{city}  (no locality)
 *   Apply to a city → creates ONE city-level SEO page per city.
 *   e.g. "Flats for Sale — City"  →  /flats-for-sale-in-delhi
 *
 * GROUP B — Locality template (1, generic)
 *   Slug pattern: {prefix}-in-{city}-{locality}
 *   Apply to a city → creates one locality page per locality in that city.
 *   Reference example: Mumbai (Andheri, Bandra, Juhu…)
 *   The same template works for ANY city — just select a city and apply.
 *
 * Safe to re-run — skips any template whose (name + categorySlug) already exists.
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/seed-quick-seo-templates.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
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

// ── Category metadata ─────────────────────────────────────────────────────────
// Mirrors the footer_seo_categories rows exactly.
const CATEGORIES = [
  { value: 'buy',          label: 'Property for Sale',     short: 'Buy',          urlPrefix: 'property-for-sale-in',  typeWord: 'property',  action: 'buy',  verb: 'sale' },
  { value: 'rent',         label: 'Property for Rent',     short: 'Rent',         urlPrefix: 'property-for-rent-in',  typeWord: 'property',  action: 'rent', verb: 'rent' },
  { value: 'flats',        label: 'Flats for Sale',        short: 'Flats',        urlPrefix: 'flats-for-sale-in',     typeWord: 'flat',      action: 'buy',  verb: 'sale' },
  { value: 'flats-rent',   label: 'Flats for Rent',        short: 'Flats Rent',   urlPrefix: 'flats-for-rent-in',     typeWord: 'flat',      action: 'rent', verb: 'rent' },
  { value: 'villas',       label: 'Villas for Sale',       short: 'Villas',       urlPrefix: 'villas-for-sale-in',    typeWord: 'villa',     action: 'buy',  verb: 'sale' },
  { value: 'plots',        label: 'Plots for Sale',        short: 'Plots',        urlPrefix: 'plots-for-sale-in',     typeWord: 'plot',      action: 'buy',  verb: 'sale' },
  { value: 'commercial',   label: 'Commercial for Rent',   short: 'Commercial',   urlPrefix: 'commercial-property-in', typeWord: 'commercial property', action: 'rent', verb: 'rent' },
  { value: 'office',       label: 'Office Space for Rent', short: 'Office',       urlPrefix: 'office-space-for-rent-in', typeWord: 'office space', action: 'rent', verb: 'rent' },
  { value: 'new-projects', label: 'New Projects',          short: 'New Projects', urlPrefix: 'new-projects-in',       typeWord: 'project',   action: 'buy',  verb: 'launch' },
  { value: 'pg',           label: 'PG / Co-Living',        short: 'PG',           urlPrefix: 'pg-in',                 typeWord: 'PG',        action: 'rent', verb: 'stay' },
];

// ── City content helpers ──────────────────────────────────────────────────────

function cityH1(cat: typeof CATEGORIES[0]): string {
  if (cat.value === 'pg')          return 'PG Accommodation in {city}';
  if (cat.value === 'new-projects') return 'New Launch Projects in {city}';
  if (cat.value === 'commercial')  return 'Commercial Property in {city}';
  if (cat.value === 'office')      return 'Office Space for Rent in {city}';
  const cap = cat.typeWord.charAt(0).toUpperCase() + cat.typeWord.slice(1);
  return `${cat.label} in {city}`;
}

function cityMetaTitle(cat: typeof CATEGORIES[0]): string {
  return `${cat.label} in {city} | ${cat.short} in {city} | Think4BuySale`;
}

function cityMetaDesc(cat: typeof CATEGORIES[0]): string {
  const action = cat.action === 'buy' ? 'buy' : 'rent';
  return `Find verified ${cat.typeWord}s for ${cat.verb} in {city}. Browse thousands of listings with photos, price, RERA details and direct owner contact on Think4BuySale.`;
}

function cityMetaKw(cat: typeof CATEGORIES[0]): string {
  return `${cat.typeWord} for ${cat.verb} in {city}, ${cat.label.toLowerCase()} {city}, {city} real estate, ${cat.typeWord} ${cat.verb} {city}`;
}

function cityIntro(cat: typeof CATEGORIES[0]): string {
  if (cat.value === 'pg') {
    return '<p>Looking for <strong>PG accommodation in {city}</strong>? Browse verified paying guest rooms with meals, Wi-Fi, AC and flexible rent options across all areas of {city}.</p>';
  }
  if (cat.value === 'new-projects') {
    return '<p>Discover the latest <strong>new residential projects in {city}</strong>. From affordable housing to premium launches, find projects with pre-launch pricing and flexible payment plans.</p>';
  }
  return `<p>Looking to ${cat.action} <strong>${cat.typeWord} in {city}</strong>? Explore thousands of verified listings with detailed pricing, photos, RERA information and neighbourhood guides. Connect directly with owners and developers on Think4BuySale.</p>`;
}

function cityBottom(cat: typeof CATEGORIES[0]): string {
  if (cat.value === 'pg') {
    return '<h2>PG Accommodation in {city}</h2><p>{city} has a growing number of quality PG options catering to students and working professionals. Most PGs are well connected to public transport and essential services.</p><h3>What to Look for in a PG</h3><ul><li>Proximity to your workplace or college</li><li>Meal inclusion — breakfast, lunch, dinner</li><li>Wi-Fi, laundry and housekeeping facilities</li><li>Security features — CCTV, biometric entry</li></ul>';
  }
  if (cat.value === 'new-projects') {
    return '<h2>New Residential Developments in {city}</h2><p>The real estate market in {city} continues to grow with multiple new launches from reputed builders. Early investors typically benefit from best-price phases and choice of units.</p><h3>Why Invest in New Projects</h3><ul><li>Modern amenities — clubhouse, pool, gym</li><li>Flexible payment plans and bank financing</li><li>Better price appreciation vs resale</li><li>RERA-compliant with guaranteed timelines</li></ul>';
  }
  if (cat.value === 'commercial' || cat.value === 'office') {
    return `<h2>${cat.label} in {city}</h2><p>{city} is a thriving commercial hub with demand for quality office and retail spaces. From co-working desks to large floor plates, {city} offers options for every business size and budget.</p><h3>Key Commercial Zones in {city}</h3><ul><li>Central Business District — premium Grade-A offices</li><li>IT Parks and tech corridors</li><li>High-street retail and mall spaces</li><li>Industrial and warehouse zones</li></ul>`;
  }
  return `<h2>${cat.label} in {city}</h2><p>{city} is one of India's most dynamic real estate markets. Whether you are a first-time buyer, an investor, or looking to upgrade, {city} offers options across all budgets and configurations.</p><h3>Why Invest in {city} Real Estate</h3><ul><li>Strong infrastructure — metro, highways, airports</li><li>Reputed schools, hospitals and shopping centres</li><li>Consistent price appreciation over the years</li><li>Wide variety of configurations — 1BHK to luxury penthouses</li></ul>`;
}

function cityFaqs(cat: typeof CATEGORIES[0]): { question: string; answer: string }[] {
  if (cat.value === 'pg') return [
    { question: 'What is the average PG rent in {city}?',            answer: 'PG rents in {city} vary by area and facilities. Single rooms start from ₹5,000/month; AC rooms with meals can go up to ₹20,000/month.' },
    { question: 'Are there girls-only PGs in {city}?',                answer: 'Yes, {city} has dedicated girls-only PGs with added security features. Filter by gender preference on our listing page.' },
    { question: 'Do PGs in {city} include food?',                     answer: 'Many PGs in {city} offer meal plans. Check individual listings for inclusion details.' },
  ];
  if (cat.value === 'new-projects') return [
    { question: 'Are new projects in {city} RERA registered?',        answer: 'All listed projects on Think4BuySale carry RERA registration details. Always verify the RERA ID before booking.' },
    { question: 'Can I visit a sample flat in {city} new projects?',   answer: 'Yes, most builders in {city} have a sample flat or virtual tour available. Schedule a site visit through our listings.' },
    { question: 'What payment plans are available in {city} projects?', answer: 'Most new projects in {city} offer construction-linked plans, possession-linked plans, and home loan tie-ups with leading banks.' },
  ];
  if (cat.value === 'commercial' || cat.value === 'office') return [
    { question: `What is the average rent for ${cat.typeWord} in {city}?`,  answer: `${cat.typeWord.charAt(0).toUpperCase() + cat.typeWord.slice(1)} rents in {city} vary by zone and grade. Contact us for current market rates.` },
    { question: `Are there furnished ${cat.typeWord}s available in {city}?`, answer: `Yes, {city} has plug-and-play ${cat.typeWord} options that are fully furnished and ready for immediate occupation.` },
  ];
  const buyOrRent = cat.action === 'buy' ? 'buy' : 'rent';
  return [
    { question: `What is the price range for ${cat.typeWord}s in {city}?`,        answer: `Prices vary by area, size and amenities. Browse our listings for current market rates in {city}.` },
    { question: `Which areas are best to ${buyOrRent} ${cat.typeWord} in {city}?`, answer: `{city} has several sought-after residential areas. The right choice depends on your budget, commute needs and lifestyle preferences.` },
    { question: `Are ${cat.typeWord}s in {city} RERA registered?`,                answer: `New properties in {city} carry RERA registration. Always verify the RERA ID before committing to a purchase or rental.` },
  ];
}

// ── Locality content helpers (Mumbai reference) ───────────────────────────────

function localityH1(): string {
  return 'Flats for Sale in {locality}, {city}';
}
function localityMetaTitle(): string {
  return 'Flat for Sale in {locality} {city} | Buy Flat in {locality}';
}
function localityMetaDesc(): string {
  return 'Find verified flats for sale in {locality}, {city}. Browse 1BHK, 2BHK & 3BHK apartments with price, photos, floor plans & EMI calculator on Think4BuySale.';
}
function localityMetaKw(): string {
  return 'flat for sale in {locality} {city}, buy flat {locality}, {locality} apartments, {city} {locality} flat price';
}
function localityIntro(): string {
  return '<p>Looking to buy a flat in <strong>{locality}, {city}</strong>? Explore our verified listings of 1BHK, 2BHK and 3BHK flats with detailed pricing, amenities, RERA information and neighbourhood guides. All listings include direct owner contact and zero-brokerage options.</p>';
}
function localityBottom(): string {
  return '<h2>About Buying Flats in {locality}, {city}</h2><p>{locality} is one of the well-established residential localities in {city}. The area offers excellent connectivity, social infrastructure and a range of housing options to suit every budget.</p><h3>Why Choose {locality}?</h3><ul><li>Good connectivity to major employment hubs in {city}</li><li>Reputed schools, hospitals and shopping centres nearby</li><li>Variety of flat configurations — 1BHK to 4BHK+</li><li>Strong rental yields and capital appreciation potential</li></ul><h3>Property Price Trends in {locality}</h3><p>Flat prices in {locality}, {city} have shown consistent appreciation. Check our listings for current per sq ft rates and recent transaction data.</p>';
}
function localityFaqs(): { question: string; answer: string }[] {
  return [
    { question: 'What is the price range for a flat in {locality}, {city}?',    answer: 'Flat prices in {locality}, {city} vary based on size, floor and amenities. Browse our listings to see current market rates.' },
    { question: 'Are there ready-to-move flats for sale in {locality}?',         answer: 'Yes, {locality} offers both ready-to-move and under-construction flats. Use the possession filter on the listing page to narrow your search.' },
    { question: 'What BHK sizes are available in {locality}, {city}?',           answer: '1BHK, 2BHK and 3BHK flats are commonly available in {locality}. Larger 4BHK and penthouse options can be found in premium projects.' },
    { question: 'Is {locality} a good area to invest in property in {city}?',    answer: '{locality} in {city} is considered a sound investment due to its established infrastructure, rental demand and appreciation trend.' },
  ];
}

// ── Build full template list ──────────────────────────────────────────────────

const TEMPLATES: any[] = [];

// GROUP A — City templates (one per category)
for (const cat of CATEGORIES) {
  TEMPLATES.push({
    name:            `${cat.label} — City`,
    categorySlug:    cat.value,
    slugPattern:     `${cat.urlPrefix}-{city}`,
    citySlugPattern: `${cat.urlPrefix}-{city}`,
    includeCityPage: false,
    showInFooter:    true,
    h1Title:         cityH1(cat),
    metaTitle:       cityMetaTitle(cat),
    metaDescription: cityMetaDesc(cat),
    metaKeywords:    cityMetaKw(cat),
    canonicalUrl:    null,
    introContent:    cityIntro(cat),
    bottomContent:   cityBottom(cat),
    faqJson:         cityFaqs(cat),
    robots:          'index,follow',
  });
}

// GROUP B — Locality template (generic, Mumbai is the reference example)
// Apply to Mumbai → creates pages for Andheri, Bandra, Juhu, Powai, etc.
// Apply to Delhi  → creates pages for Rohini, Dwarka, Saket, etc.
// The same template works for any city — {city} and {locality} are replaced at apply-time.
TEMPLATES.push({
  name:            'Flat for Sale — Locality (Apply to any city)',
  categorySlug:    'flats',
  slugPattern:     'flats-for-sale-in-{city}-{locality}',
  citySlugPattern: 'flats-for-sale-in-{city}',
  includeCityPage: true,
  showInFooter:    true,
  h1Title:         localityH1(),
  metaTitle:       localityMetaTitle(),
  metaDescription: localityMetaDesc(),
  metaKeywords:    localityMetaKw(),
  canonicalUrl:    null,
  introContent:    localityIntro(),
  bottomContent:   localityBottom(),
  faqJson:         localityFaqs(),
  robots:          'index,follow',
});

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await ds.initialize();
  console.log('Connected. Seeding Quick SEO templates…\n');

  await ds.query(`
    CREATE TABLE IF NOT EXISTS \`quick_seo_templates\` (
      \`id\`              varchar(36)   NOT NULL,
      \`name\`            varchar(200)  NOT NULL,
      \`categorySlug\`    varchar(50)   NOT NULL,
      \`slugPattern\`     varchar(300)  NOT NULL DEFAULT '{category}-in-{city}-{locality}',
      \`citySlugPattern\` varchar(300)  DEFAULT NULL,
      \`includeCityPage\` tinyint       NOT NULL DEFAULT 0,
      \`showInFooter\`    tinyint       NOT NULL DEFAULT 1,
      \`h1Title\`         varchar(250)  DEFAULT NULL,
      \`metaTitle\`       varchar(250)  DEFAULT NULL,
      \`metaDescription\` varchar(500)  DEFAULT NULL,
      \`metaKeywords\`    varchar(300)  DEFAULT NULL,
      \`canonicalUrl\`    varchar(500)  DEFAULT NULL,
      \`introContent\`    text          DEFAULT NULL,
      \`bottomContent\`   text          DEFAULT NULL,
      \`faqJson\`         json          DEFAULT NULL,
      \`robots\`          varchar(100)  NOT NULL DEFAULT 'index,follow',
      \`appliedCount\`    int           NOT NULL DEFAULT 0,
      \`lastAppliedAt\`   datetime      DEFAULT NULL,
      \`createdAt\`       datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updatedAt\`       datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  ✓  Table quick_seo_templates ready\n');

  let inserted = 0, skipped = 0;

  for (const tpl of TEMPLATES) {
    const [existing] = await ds.query(
      'SELECT id FROM quick_seo_templates WHERE name = ? AND categorySlug = ? LIMIT 1',
      [tpl.name, tpl.categorySlug],
    );
    if (existing) {
      console.log(`  ⏭  Skipped (exists): ${tpl.name}`);
      skipped++;
      continue;
    }
    await ds.query(
      `INSERT INTO quick_seo_templates
         (id, name, categorySlug, slugPattern, citySlugPattern, includeCityPage, showInFooter,
          h1Title, metaTitle, metaDescription, metaKeywords, canonicalUrl,
          introContent, bottomContent, faqJson, robots,
          appliedCount, createdAt, updatedAt)
       VALUES
         (UUID(), ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          0, NOW(), NOW())`,
      [
        tpl.name, tpl.categorySlug, tpl.slugPattern, tpl.citySlugPattern ?? null,
        tpl.includeCityPage ? 1 : 0, tpl.showInFooter ? 1 : 0,
        tpl.h1Title, tpl.metaTitle, tpl.metaDescription, tpl.metaKeywords, tpl.canonicalUrl ?? null,
        tpl.introContent, tpl.bottomContent, JSON.stringify(tpl.faqJson),
        tpl.robots,
      ],
    );
    console.log(`  ✓  Inserted: ${tpl.name}`);
    inserted++;
  }

  console.log(`\n✅  Inserted : ${inserted}`);
  console.log(`⏭   Skipped  : ${skipped}`);
  console.log(`📋  Total templates in DB after seed: ${inserted + skipped}`);
  await ds.destroy();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });

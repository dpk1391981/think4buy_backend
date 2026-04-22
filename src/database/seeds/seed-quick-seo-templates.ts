/**
 * seed-quick-seo-templates.ts
 *
 * Seeds four SEO template types:
 *
 *   1. City Category        — {category}-in-{city}
 *   2. City Locality Category — {category}-in-{city}-{locality}
 *   3. Agent City           — agents-in-{city}
 *   4. Agent Locality City  — agents-in-{city}-{locality}
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

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: any[] = [

  // ── 1. City Category ─────────────────────────────────────────────────────────
  {
    name:            'City Category',
    categorySlug:    'buy',
    slugPattern:     'property-for-sale-in-{city}',
    citySlugPattern: 'property-for-sale-in-{city}',
    includeCityPage: false,
    showInFooter:    true,
    h1Title:         'Property for Sale in {city}',
    metaTitle:       'Property for Sale in {city} | Buy Property in {city} | Think4BuySale',
    metaDescription: 'Find verified properties for sale in {city}. Browse thousands of listings with photos, price, RERA details and direct owner contact on Think4BuySale.',
    metaKeywords:    'property for sale in {city}, buy property {city}, {city} real estate, flats villas plots {city}',
    canonicalUrl:    null,
    introContent:    '<p>Looking to <strong>buy property in {city}</strong>? Explore thousands of verified listings with detailed pricing, photos, RERA information and neighbourhood guides. Connect directly with owners and developers on Think4BuySale.</p>',
    bottomContent:   '<h2>Property for Sale in {city}</h2><p>{city} is one of India\'s most dynamic real estate markets. Whether you are a first-time buyer, an investor or looking to upgrade, {city} offers options across all budgets and configurations.</p><h3>Why Invest in {city} Real Estate</h3><ul><li>Strong infrastructure — metro, highways, airports</li><li>Reputed schools, hospitals and shopping centres</li><li>Consistent price appreciation over the years</li><li>Wide variety of configurations — 1BHK to luxury penthouses</li></ul>',
    faqJson: [
      { question: 'What is the price range for properties in {city}?',    answer: 'Prices vary by area, size and amenities. Browse our listings for current market rates in {city}.' },
      { question: 'Which areas are best to buy property in {city}?',      answer: '{city} has several sought-after residential areas. The right choice depends on your budget, commute needs and lifestyle preferences.' },
      { question: 'Are properties in {city} RERA registered?',            answer: 'New properties in {city} carry RERA registration. Always verify the RERA ID before committing to a purchase.' },
    ],
    robots: 'index,follow',
  },

  // ── 2. City Locality Category ─────────────────────────────────────────────────
  {
    name:            'City Locality Category',
    categorySlug:    'buy',
    slugPattern:     'property-for-sale-in-{locality}-{city}',
    citySlugPattern: 'property-for-sale-in-{city}',
    includeCityPage: true,
    showInFooter:    true,
    h1Title:         'Property for Sale in {locality}, {city}',
    metaTitle:       'Property for Sale in {locality} {city} | Buy Property in {locality} | Think4BuySale',
    metaDescription: 'Find verified properties for sale in {locality}, {city}. Browse 1BHK, 2BHK & 3BHK flats, villas and plots with price, photos, floor plans and EMI calculator on Think4BuySale.',
    metaKeywords:    'property for sale in {locality} {city}, buy property {locality}, {locality} real estate, {city} {locality} property price',
    canonicalUrl:    null,
    introContent:    '<p>Looking to <strong>buy property in {locality}, {city}</strong>? Explore our verified listings of flats, villas and plots with detailed pricing, amenities, RERA information and neighbourhood guides. All listings include direct owner contact and zero-brokerage options.</p>',
    bottomContent:   '<h2>About Buying Property in {locality}, {city}</h2><p>{locality} is one of the well-established residential localities in {city}. The area offers excellent connectivity, social infrastructure and a range of housing options to suit every budget.</p><h3>Why Choose {locality}?</h3><ul><li>Good connectivity to major employment hubs in {city}</li><li>Reputed schools, hospitals and shopping centres nearby</li><li>Variety of property configurations — 1BHK to 4BHK+</li><li>Strong rental yields and capital appreciation potential</li></ul><h3>Property Price Trends in {locality}</h3><p>Property prices in {locality}, {city} have shown consistent appreciation. Check our listings for current per sq ft rates and recent transaction data.</p>',
    faqJson: [
      { question: 'What is the price range for property in {locality}, {city}?', answer: 'Property prices in {locality}, {city} vary based on size, floor and amenities. Browse our listings to see current market rates.' },
      { question: 'Are there ready-to-move properties for sale in {locality}?',   answer: 'Yes, {locality} offers both ready-to-move and under-construction properties. Use the possession filter on the listing page to narrow your search.' },
      { question: 'What property types are available in {locality}, {city}?',     answer: 'Flats, villas and plots are available in {locality}. Use filters to find the right type for your requirement.' },
      { question: 'Is {locality} a good area to invest in {city}?',               answer: '{locality} in {city} is considered a sound investment due to its established infrastructure, rental demand and appreciation trend.' },
    ],
    robots: 'index,follow',
  },

  // ── 3. Agent City ──────────────────────────────────────────────────────────────
  {
    name:            'Agent City',
    categorySlug:    'agents',
    slugPattern:     'agents-in-{city}',
    citySlugPattern: 'agents-in-{city}',
    includeCityPage: false,
    showInFooter:    true,
    h1Title:         'Real Estate Agents in {city}',
    metaTitle:       'Real Estate Agents in {city} | Property Brokers {city} | Think4BuySale',
    metaDescription: 'Find verified real estate agents and property brokers in {city}. Connect with experienced agents for buying, selling and renting properties in {city} on Think4BuySale.',
    metaKeywords:    'real estate agents in {city}, property brokers {city}, top agents {city}, buy sell property {city}',
    canonicalUrl:    null,
    introContent:    '<p>Looking for a trusted <strong>real estate agent in {city}</strong>? Browse verified agents and brokers with proven track records. Our agents are experienced in buying, selling and renting residential and commercial properties across all areas of {city}.</p>',
    bottomContent:   '<h2>Real Estate Agents in {city}</h2><p>{city} has a vibrant real estate market served by thousands of professional agents. Choosing the right agent can save you time, money and effort in your property journey.</p><h3>Why Work with a Think4BuySale Agent in {city}</h3><ul><li>Verified credentials and RERA registration</li><li>Deep local market knowledge across all neighbourhoods</li><li>Negotiation expertise to get you the best deal</li><li>End-to-end assistance — from search to registration</li></ul>',
    faqJson: [
      { question: 'How do I find a good real estate agent in {city}?',         answer: 'Browse our verified listings of real estate agents in {city}. Filter by area, experience and specialisation to find the right match for your requirement.' },
      { question: 'Are real estate agents in {city} RERA registered?',        answer: 'All agents listed on Think4BuySale are required to share their RERA registration. Always verify credentials before engaging an agent.' },
      { question: 'What is the agent fee for property in {city}?',            answer: 'Agent fees in {city} typically range from 1% to 2% of the transaction value. This may vary based on the type of property and negotiation.' },
    ],
    robots: 'index,follow',
  },

  // ── 4. Agent Locality City ────────────────────────────────────────────────────
  {
    name:            'Agent Locality City',
    categorySlug:    'agents',
    slugPattern:     'agents-in-{locality}-{city}',
    citySlugPattern: 'agents-in-{city}',
    includeCityPage: true,
    showInFooter:    true,
    h1Title:         'Real Estate Agents in {locality}, {city}',
    metaTitle:       'Real Estate Agents in {locality} {city} | Property Brokers {locality} | Think4BuySale',
    metaDescription: 'Find verified real estate agents and property brokers in {locality}, {city}. Connect with local experts for buying, selling and renting properties in {locality} on Think4BuySale.',
    metaKeywords:    'real estate agents in {locality} {city}, property brokers {locality}, agents {locality} {city}, buy sell property {locality}',
    canonicalUrl:    null,
    introContent:    '<p>Looking for a trusted <strong>real estate agent in {locality}, {city}</strong>? Browse verified local agents and brokers with deep knowledge of the {locality} property market. Our agents help you buy, sell and rent properties with complete transparency and professional guidance.</p>',
    bottomContent:   '<h2>Real Estate Agents in {locality}, {city}</h2><p>{locality} in {city} is a thriving residential area with active property transactions. Local agents in {locality} bring unmatched neighbourhood expertise and access to both listed and off-market properties.</p><h3>Why Work with a Local Agent in {locality}</h3><ul><li>In-depth knowledge of {locality} property prices and trends</li><li>Direct access to listings across all micro-pockets in {locality}</li><li>Established relationships with builders and developers</li><li>Faster deal closures with neighbourhood contacts</li></ul>',
    faqJson: [
      { question: 'Which agents specialise in {locality}, {city}?',                 answer: 'Browse our listings to find agents who focus specifically on {locality}. You can filter by location, experience and property type.' },
      { question: 'Do agents in {locality} handle both buying and renting?',        answer: 'Yes, most agents in {locality}, {city} handle residential buying, selling and rental transactions across all property types.' },
      { question: 'How do I contact a real estate agent in {locality}, {city}?',   answer: 'Click on any agent listing in {locality} to view contact details and send a direct enquiry through Think4BuySale.' },
    ],
    robots: 'index,follow',
  },

];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await ds.initialize();
  console.log('Connected. Seeding SEO templates…\n');

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

  // Remove old category-specific templates (the previous 11-template set)
  const oldPrefixes = [
    'Property for Sale — City', 'Property for Rent — City', 'Flats for Sale — City',
    'Flats for Rent — City', 'Villas for Sale — City', 'Plots for Sale — City',
    'Commercial for Rent — City', 'Office Space for Rent — City', 'New Projects — City',
    'PG / Co-Living — City', 'Flat for Sale — Locality',
  ];
  for (const name of oldPrefixes) {
    const [row] = await ds.query('SELECT id FROM quick_seo_templates WHERE name = ? LIMIT 1', [name]);
    if (row) {
      await ds.query('DELETE FROM quick_seo_templates WHERE id = ?', [row.id]);
      console.log(`  🗑  Removed old template: ${name}`);
    }
  }

  let inserted = 0, skipped = 0;

  for (const tpl of TEMPLATES) {
    const [existing] = await ds.query(
      'SELECT id FROM quick_seo_templates WHERE name = ? LIMIT 1',
      [tpl.name],
    );
    if (existing) {
      // Update in place so the content stays current
      await ds.query(
        `UPDATE quick_seo_templates SET
           categorySlug = ?, slugPattern = ?, citySlugPattern = ?,
           includeCityPage = ?, showInFooter = ?,
           h1Title = ?, metaTitle = ?, metaDescription = ?, metaKeywords = ?,
           canonicalUrl = ?, introContent = ?, bottomContent = ?,
           faqJson = ?, robots = ?, updatedAt = NOW()
         WHERE id = ?`,
        [
          tpl.categorySlug, tpl.slugPattern, tpl.citySlugPattern ?? null,
          tpl.includeCityPage ? 1 : 0, tpl.showInFooter ? 1 : 0,
          tpl.h1Title, tpl.metaTitle, tpl.metaDescription, tpl.metaKeywords,
          tpl.canonicalUrl ?? null, tpl.introContent, tpl.bottomContent,
          JSON.stringify(tpl.faqJson), tpl.robots,
          existing.id,
        ],
      );
      console.log(`  ↺  Updated : ${tpl.name}`);
      skipped++;
    } else {
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
  }

  console.log(`\n✅  Inserted : ${inserted}`);
  console.log(`↺   Updated  : ${skipped}`);
  console.log(`📋  Total SEO templates: ${TEMPLATES.length}`);
  await ds.destroy();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });

/**
 * map-footer-city-locality.ts
 *
 * Auto-maps existing footer_seo_link_groups and footer_seo_links
 * to city/locality records from the database by name matching.
 *
 * Run:  npx ts-node -r tsconfig-paths/register src/database/seeds/map-footer-city-locality.ts
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

// ── helpers ───────────────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalise for loose matching: lowercase, collapse spaces */
function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Extract the city name from a footer link label.
 * e.g. "Flats for Sale in Mumbai"   → "Mumbai"
 *      "Villas for Sale in Greater Noida" → "Greater Noida"
 * Tries longest-first so "Greater Noida" wins over "Noida".
 */
function extractCityFromLabel(label: string, cityNames: string[]): string | null {
  const sorted = [...cityNames].sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    const re = new RegExp(`\\bin\\s+${esc(city)}\\b`, 'i');
    if (re.test(label)) return city;
    // fallback – ends with city name
    if (norm(label).endsWith(norm(city))) return city;
  }
  return null;
}

/**
 * Extract locality from a city-specific group link label.
 * e.g. group city = "Mumbai", label = "Flats for Sale in Andheri East Mumbai"
 *   → "Andheri East"
 * e.g. label = "Flats for Sale in Agripada, Mumbai"
 *   → "Agripada"
 */
function extractLocalityFromLabel(label: string, city: string): string | null {
  // Find last occurrence of " in " and take everything after it
  const inIdx = label.toLowerCase().lastIndexOf(' in ');
  if (inIdx === -1) return null;

  let rest = label.substring(inIdx + 4).trim(); // "Andheri East Mumbai" or "Agripada, Mumbai"

  // Remove trailing city name (with optional comma/space before)
  const cityRe = new RegExp(`[,\\s]*${esc(city)}[\\s,]*$`, 'i');
  rest = rest.replace(cityRe, '').trim();

  // Sanity: must not be empty and not equal to the city itself
  if (!rest || norm(rest) === norm(city)) return null;

  return rest;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  await ds.initialize();
  console.log('Connected. Starting footer SEO city/locality mapping...\n');

  // ── 1. Load reference data ──────────────────────────────────────────────────

  const cities: { id: string; name: string }[] = await ds.query(
    `SELECT id, name FROM cities WHERE isActive = 1 ORDER BY LENGTH(name) DESC`
  );
  const cityByName = new Map<string, { id: string; name: string }>();
  for (const c of cities) cityByName.set(norm(c.name), c);
  const cityNames = cities.map(c => c.name);

  // Build locality lookup: Map<"locality|city" → id>
  const localities: { id: string; locality: string; city: string }[] = await ds.query(
    `SELECT id, locality, city FROM locations
     WHERE isActive = 1 AND locality IS NOT NULL AND locality != ''`
  );
  const localityMap = new Map<string, string>();
  const localityFuzzyMap = new Map<string, string>(); // first match per city
  for (const l of localities) {
    const key = `${norm(l.locality)}|${norm(l.city)}`;
    if (!localityMap.has(key)) localityMap.set(key, l.id);
    // also index city bucket for fuzzy
    const cityKey = norm(l.city);
    if (!localityFuzzyMap.has(cityKey + '|' + norm(l.locality))) {
      localityFuzzyMap.set(cityKey + '|' + norm(l.locality), l.id);
    }
  }

  // ── 2. Load groups + links ──────────────────────────────────────────────────

  const groups: {
    id: string; title: string; cityId: string | null; cityName: string | null;
  }[] = await ds.query(
    `SELECT id, title, cityId, cityName FROM footer_seo_link_groups ORDER BY sortOrder`
  );

  const links: {
    id: string; groupId: string; label: string; url: string;
    localityId: string | null; localityName: string | null;
  }[] = await ds.query(
    `SELECT id, groupId, label, url, localityId, localityName FROM footer_seo_links ORDER BY groupId, sortOrder`
  );

  const linksByGroup = new Map<string, typeof links>();
  for (const l of links) {
    if (!linksByGroup.has(l.groupId)) linksByGroup.set(l.groupId, []);
    linksByGroup.get(l.groupId)!.push(l);
  }

  let groupUpdated = 0;
  let linkUpdated = 0;
  let linkNotMatched = 0;

  // ── 3. Process each group ───────────────────────────────────────────────────

  for (const group of groups) {
    const gl = linksByGroup.get(group.id) || [];

    // ── 3a. Determine city for this group ─────────────────────────────────────
    let resolvedCity = group.cityName ?? null;
    let resolvedCityId = group.cityId ?? null;

    if (!resolvedCity) {
      // Try to extract city from group TITLE
      const extracted = extractCityFromLabel(group.title, cityNames);
      if (extracted) {
        const match = cityByName.get(norm(extracted));
        if (match) {
          resolvedCity = match.name;
          resolvedCityId = match.id;
        }
      }
    }

    // ── 3b. Update group if city was resolved ─────────────────────────────────
    if (resolvedCity && (!group.cityName || !group.cityId)) {
      await ds.query(
        `UPDATE footer_seo_link_groups SET cityId = ?, cityName = ? WHERE id = ?`,
        [resolvedCityId, resolvedCity, group.id]
      );
      groupUpdated++;
      console.log(`  GROUP  "${group.title}"  →  city: ${resolvedCity}`);
    }

    // ── 3c. Process links in this group ───────────────────────────────────────
    for (const link of gl) {
      if (link.localityName && link.localityId) continue; // already mapped

      let localityName: string | null = null;
      let localityId: string | null = null;

      if (resolvedCity) {
        // City-specific group (e.g. "Flats for Sale in Mumbai")
        // Links contain locality names: "Flats for Sale in Andheri East Mumbai"
        const extracted = extractLocalityFromLabel(link.label, resolvedCity);

        if (extracted) {
          localityName = extracted;

          // Exact match
          const exactKey = `${norm(extracted)}|${norm(resolvedCity)}`;
          localityId = localityMap.get(exactKey) ?? null;

          // Partial match if exact fails
          if (!localityId) {
            const cityNorm = norm(resolvedCity);
            const locNorm  = norm(extracted);
            for (const [k, id] of localityFuzzyMap) {
              const [kLoc, kCity] = k.split('|');
              if (kCity === cityNorm && (kLoc.includes(locNorm) || locNorm.includes(kLoc))) {
                localityId = id;
                break;
              }
            }
          }
        }
      } else {
        // Generic group (e.g. "Flats for Sale") — links are city-level
        // Store the city as localityName so city-tab display works
        const cityExtracted = extractCityFromLabel(link.label, cityNames);
        if (cityExtracted) {
          const match = cityByName.get(norm(cityExtracted));
          if (match) {
            localityName = match.name;
            localityId   = match.id;   // using city id for generic links
          }
        }
      }

      if (localityName) {
        await ds.query(
          `UPDATE footer_seo_links SET localityName = ?, localityId = ? WHERE id = ?`,
          [localityName, localityId, link.id]
        );
        linkUpdated++;
        if (!localityId) linkNotMatched++;
      }
    }
  }

  console.log(`\n✅  Groups updated  : ${groupUpdated}`);
  console.log(`✅  Links updated   : ${linkUpdated}`);
  if (linkNotMatched > 0) {
    console.log(`⚠️   Links without DB locality ID (name set but no row match): ${linkNotMatched}`);
  }

  // ── 4. Verification summary ─────────────────────────────────────────────────
  const summary: { group_title: string; cityName: string | null; links_mapped: string; total_links: string }[] =
    await ds.query(`
      SELECT
        g.title AS group_title,
        g.cityName,
        SUM(CASE WHEN l.localityName IS NOT NULL THEN 1 ELSE 0 END) AS links_mapped,
        COUNT(l.id) AS total_links
      FROM footer_seo_link_groups g
      LEFT JOIN footer_seo_links l ON l.groupId = g.id
      GROUP BY g.id
      ORDER BY g.sortOrder
    `);

  console.log('\n── Mapping summary ──────────────────────────────────────────');
  for (const row of summary) {
    const city = row.cityName ? `[${row.cityName}]` : '[generic]';
    console.log(`  ${city.padEnd(16)} "${row.group_title}" — ${row.links_mapped}/${row.total_links} links mapped`);
  }

  await ds.destroy();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });

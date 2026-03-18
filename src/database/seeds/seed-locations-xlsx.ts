/**
 * Seed: Locations from XLSX files  (upsert edition)
 *
 * Reads the 7 city XLSX files from /locations/ folder and upserts:
 *   - cities    table  (insert new / update existing)
 *   - locations table  (insert new / update existing)
 *
 * Geocoding fallback chain (when GEOCODE=true):
 *   1. Nominatim: "{locality}, {city}, India"
 *   2. Nominatim: "{city}, India"  (city-level pincode)
 *   3. Nearest already-resolved locality in same city (by lat/lng distance)
 *
 * Commands:
 *   npm run seed:locations-xlsx              — upsert all rows, no geocoding
 *   npm run seed:locations-xlsx:dry          — preview only, no DB writes
 *   npm run seed:locations-xlsx:geocode      — upsert + fetch pincodes/coords
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as path from 'path';
import * as XLSX from 'xlsx';
import * as https from 'https';
import { DataSource } from 'typeorm';
import { Location } from '../../modules/locations/entities/location.entity';
import { City } from '../../modules/locations/entities/city.entity';
import { State } from '../../modules/locations/entities/state.entity';
import { Country } from '../../modules/locations/entities/country.entity';

// ─── Config ───────────────────────────────────────────────────────────────────

const LOCATIONS_DIR = path.resolve(__dirname, '../../../../locations');
const DRY_RUN  = process.env.DRY_RUN  === 'true';
const GEOCODE  = process.env.GEOCODE  === 'true';
// When GEOCODE=true, also update rows that already have a pincode (re-geocode all)
const FORCE_GEO = process.env.FORCE_GEO === 'true';

// City → State mapping
const CITY_STATE_MAP: Record<string, { state: string; stateCode: string }> = {
  'Bangalore':     { state: 'Karnataka',    stateCode: 'KA' },
  'Delhi':         { state: 'Delhi',        stateCode: 'DL' },
  'Ghaziabad':     { state: 'Uttar Pradesh', stateCode: 'UP' },
  'Greater Noida': { state: 'Uttar Pradesh', stateCode: 'UP' },
  'Gurgaon':       { state: 'Haryana',      stateCode: 'HR' },
  'Hyderabad':     { state: 'Telangana',    stateCode: 'TS' },
  'Noida':         { state: 'Uttar Pradesh', stateCode: 'UP' },
};

// City-level SEO / display meta
const CITY_META: Record<string, { slug: string; imageUrl?: string; isFeatured?: boolean }> = {
  'Bangalore':     { slug: 'bangalore',     isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&q=80' },
  'Delhi':         { slug: 'delhi',         isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=80' },
  'Ghaziabad':     { slug: 'ghaziabad',     isFeatured: false },
  'Greater Noida': { slug: 'greater-noida', isFeatured: false },
  'Gurgaon':       { slug: 'gurgaon',       isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1615853481284-a29fefdbc57f?w=600&q=80' },
  'Hyderabad':     { slug: 'hyderabad',     isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1572445373025-8b4b3ab7dd21?w=600&q=80' },
  'Noida':         { slug: 'noida',         isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1592492152545-9695d3f473f4?w=600&q=80' },
};

// ─── DataSource ───────────────────────────────────────────────────────────────

const dataSource = new DataSource({
  type: 'mysql',
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'dpk1391981',
  password: process.env.DB_PASSWORD || 'Dpk1391981!',
  database: process.env.DB_NAME     || 'realestate_db',
  entities: [Location, City, State, Country],
  synchronize: false,
});

// ─── Geocoding helpers ────────────────────────────────────────────────────────

interface GeoResult {
  pincode:   string | null;
  latitude:  number | null;
  longitude: number | null;
  source:    'locality' | 'city' | 'nearby' | 'none';
}

// Resolved point tracked per city for "nearby" fallback
interface ResolvedPoint {
  locality:  string;
  pincode:   string;
  latitude:  number;
  longitude: number;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'think4buysale-seeder/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestPoint(lat: number, lon: number, pool: ResolvedPoint[]): ResolvedPoint | null {
  if (pool.length === 0) return null;
  let best: ResolvedPoint | null = null;
  let bestDist = Infinity;
  for (const pt of pool) {
    const d = haversineKm(lat, lon, pt.latitude, pt.longitude);
    if (d < bestDist) { bestDist = d; best = pt; }
  }
  return best;
}

/** Call Nominatim with a query string, return first hit's geo data */
async function nominatim(query: string): Promise<{ lat: number; lon: number; pincode: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=in`;
    const raw = await httpsGet(url);
    const results = JSON.parse(raw);
    if (!results || results.length === 0) return null;
    const top = results[0];
    return {
      lat:     parseFloat(top.lat),
      lon:     parseFloat(top.lon),
      pincode: top.address?.postcode ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Geocode a locality with 3-tier fallback:
 *   1. "{locality}, {city}, India"
 *   2. "{city}, India"  → city-level pincode
 *   3. Nearest already-resolved locality in same city
 */
async function geocodeWithFallback(
  locality: string,
  city: string,
  cityGeo: { pincode: string | null; latitude: number | null; longitude: number | null },
  resolvedPool: ResolvedPoint[],
): Promise<GeoResult> {

  // ── Tier 1: exact locality ────────────────────────────────────────────────
  const localityHit = await nominatim(`${locality}, ${city}, India`);
  await sleep(1100); // Nominatim: 1 req/sec

  if (localityHit) {
    if (localityHit.pincode) {
      return {
        pincode:   localityHit.pincode,
        latitude:  localityHit.lat,
        longitude: localityHit.lon,
        source:    'locality',
      };
    }

    // Tier 1 gave lat/lng but no pincode → try nearby from resolved pool
    const near = findNearestPoint(localityHit.lat, localityHit.lon, resolvedPool);
    if (near) {
      return {
        pincode:   near.pincode,
        latitude:  localityHit.lat,   // keep own coordinates
        longitude: localityHit.lon,
        source:    'nearby',
      };
    }

    // Still no pincode → fall through to city pincode with own lat/lng
    if (cityGeo.pincode) {
      return {
        pincode:   cityGeo.pincode,
        latitude:  localityHit.lat,
        longitude: localityHit.lon,
        source:    'city',
      };
    }
  }

  // ── Tier 2: city-level fallback ───────────────────────────────────────────
  if (cityGeo.pincode) {
    return {
      pincode:   cityGeo.pincode,
      latitude:  cityGeo.latitude,
      longitude: cityGeo.longitude,
      source:    'city',
    };
  }

  // ── Tier 3: nearest resolved locality ────────────────────────────────────
  // (city geo also unavailable – rare edge case)
  if (resolvedPool.length > 0) {
    const near = resolvedPool[resolvedPool.length - 1]; // last resolved as rough proxy
    return {
      pincode:   near.pincode,
      latitude:  near.latitude,
      longitude: near.longitude,
      source:    'nearby',
    };
  }

  return { pincode: null, latitude: null, longitude: null, source: 'none' };
}

/** Geocode the city itself (once per city, used as fallback pincode) */
async function geocodeCity(cityName: string): Promise<{ pincode: string | null; latitude: number | null; longitude: number | null }> {
  const hit = await nominatim(`${cityName}, India`);
  await sleep(1100);
  if (!hit) return { pincode: null, latitude: null, longitude: null };
  return { pincode: hit.pincode, latitude: hit.lat, longitude: hit.lon };
}

// ─── Read XLSX files ──────────────────────────────────────────────────────────

interface LocalityRow { city: string; locality: string; }

function readXlsxFiles(): LocalityRow[] {
  const fs = require('fs') as typeof import('fs');
  const files = fs.readdirSync(LOCATIONS_DIR).filter((f: string) => f.endsWith('.xlsx'));
  const rows: LocalityRow[] = [];

  for (const file of files) {
    const wb = XLSX.readFile(path.join(LOCATIONS_DIR, file));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<{ City: string; Locality: string }>(ws);
    for (const row of data) {
      if (row.City && row.Locality) {
        rows.push({ city: row.City.trim(), locality: row.Locality.trim() });
      }
    }
    console.log(`  Read ${data.length} rows from ${file}`);
  }
  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏙️  Seed: Locations from XLSX  (upsert + geocode fallback)`);
  console.log(`   DRY_RUN=${DRY_RUN}  GEOCODE=${GEOCODE}  FORCE_GEO=${FORCE_GEO}`);
  console.log(`   Locations dir: ${LOCATIONS_DIR}\n`);

  console.log('📂 Reading XLSX files...');
  const allRows = readXlsxFiles();
  console.log(`   Total rows: ${allRows.length}`);

  // Group by city
  const byCityMap = new Map<string, string[]>();
  for (const { city, locality } of allRows) {
    if (!byCityMap.has(city)) byCityMap.set(city, []);
    byCityMap.get(city)!.push(locality);
  }
  console.log(`   Cities found: ${[...byCityMap.keys()].join(', ')}\n`);

  // ── Dry run ──────────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log('DRY RUN — listing what would be upserted:\n');
    for (const [city, localities] of byCityMap) {
      const stateInfo = CITY_STATE_MAP[city];
      console.log(`  ${city} (${stateInfo?.state ?? 'UNKNOWN STATE'}) → ${localities.length} localities`);
      localities.slice(0, 5).forEach((l) => console.log(`    - ${l}`));
      if (localities.length > 5) console.log(`    ... and ${localities.length - 5} more`);
    }
    console.log('\nDry run complete. No DB changes made.');
    return;
  }

  // ── Connect DB ───────────────────────────────────────────────────────────
  await dataSource.initialize();
  console.log('✅ DB connected\n');

  const stateRepo    = dataSource.getRepository(State);
  const cityRepo     = dataSource.getRepository(City);
  const locationRepo = dataSource.getRepository(Location);

  let citiesInserted = 0;
  let citiesUpdated  = 0;
  let locInserted    = 0;
  let locUpdated     = 0;
  let locUnchanged   = 0;

  // ── Process each city ────────────────────────────────────────────────────
  for (const [cityName, localities] of byCityMap) {
    const stateInfo = CITY_STATE_MAP[cityName];
    if (!stateInfo) {
      console.warn(`⚠️  No state mapping for "${cityName}" — skipping`);
      continue;
    }

    const stateEntity = await stateRepo.findOne({ where: { code: stateInfo.stateCode } });
    if (!stateEntity) {
      console.warn(`⚠️  State "${stateInfo.state}" not in DB — run main seed first`);
      continue;
    }

    // ── Upsert city ────────────────────────────────────────────────────────
    let cityEntity = await cityRepo.findOne({ where: { name: cityName, stateId: stateEntity.id } });
    const meta = CITY_META[cityName] ?? { slug: cityName.toLowerCase().replace(/\s+/g, '-') };

    if (!cityEntity) {
      cityEntity = await cityRepo.save(cityRepo.create({
        name:            cityName,
        stateId:         stateEntity.id,
        isActive:        true,
        isFeatured:      meta.isFeatured ?? false,
        slug:            meta.slug,
        imageUrl:        meta.imageUrl,
        h1:              `Property in ${cityName}`,
        metaTitle:       `Buy & Rent Property in ${cityName} - Think4BuySale`,
        metaDescription: `Find properties for sale and rent in ${cityName}. Browse all localities.`,
        metaKeywords:    `buy property ${cityName.toLowerCase()}, rent flat ${cityName.toLowerCase()}, ${cityName.toLowerCase()} real estate`,
      }));
      citiesInserted++;
      console.log(`  ✅ City inserted: ${cityName} (${stateInfo.state})`);
    } else {
      // Update slug/meta if missing
      let dirty = false;
      if (!cityEntity.slug && meta.slug) { cityEntity.slug = meta.slug; dirty = true; }
      if (!cityEntity.imageUrl && meta.imageUrl) { cityEntity.imageUrl = meta.imageUrl; dirty = true; }
      if (!cityEntity.metaTitle) { cityEntity.metaTitle = `Buy & Rent Property in ${cityName} - Think4BuySale`; dirty = true; }
      if (dirty) { await cityRepo.save(cityEntity); citiesUpdated++; }
      console.log(`  ♻️  City exists: ${cityName}${dirty ? ' (updated meta)' : ''}`);
    }

    // ── Geocode city once as fallback ──────────────────────────────────────
    let cityGeo = { pincode: null as string | null, latitude: null as number | null, longitude: null as number | null };
    if (GEOCODE) {
      process.stdout.write(`  🌍 Geocoding city "${cityName}"... `);
      cityGeo = await geocodeCity(cityName);
      console.log(cityGeo.pincode ? `pincode=${cityGeo.pincode}` : 'no pincode');
    }

    // Pool of resolved localities (used for nearby fallback)
    const resolvedPool: ResolvedPoint[] = [];

    // ── Upsert localities ──────────────────────────────────────────────────
    console.log(`  📍 Processing ${localities.length} localities...`);
    let cityIns = 0; let cityUpd = 0; let cityUnch = 0;

    for (let i = 0; i < localities.length; i++) {
      const locality = localities[i];
      const existing = await locationRepo.findOne({ where: { city: cityName, locality } });

      if (!existing) {
        // ── INSERT ─────────────────────────────────────────────────────────
        let geo: GeoResult = { pincode: null, latitude: null, longitude: null, source: 'none' };
        if (GEOCODE) {
          process.stdout.write(`    [${i + 1}/${localities.length}] INSERT geocoding "${locality}"... `);
          geo = await geocodeWithFallback(locality, cityName, cityGeo, resolvedPool);
          console.log(`${sourceIcon(geo.source)} pincode=${geo.pincode ?? 'null'} (${geo.source})`);
        }

        const saved = await locationRepo.save(locationRepo.create({
          city:         cityName,
          state:        stateInfo.state,
          locality,
          pincode:      geo.pincode,
          latitude:     geo.latitude,
          longitude:    geo.longitude,
          isActive:     true,
          propertyCount: 0,
        }));

        if (GEOCODE && geo.pincode && geo.latitude && geo.longitude) {
          resolvedPool.push({ locality, pincode: geo.pincode, latitude: geo.latitude, longitude: geo.longitude });
        }
        cityIns++;
        locInserted++;

      } else {
        // ── UPDATE ─────────────────────────────────────────────────────────
        // Decide whether we need to (re)geocode this row
        const needsGeo = GEOCODE && (FORCE_GEO || !existing.pincode || !existing.latitude);

        if (needsGeo) {
          process.stdout.write(`    [${i + 1}/${localities.length}] UPDATE geocoding "${locality}"... `);
          const geo = await geocodeWithFallback(locality, cityName, cityGeo, resolvedPool);
          console.log(`${sourceIcon(geo.source)} pincode=${geo.pincode ?? 'null'} (${geo.source})`);

          existing.pincode   = geo.pincode   ?? existing.pincode;
          existing.latitude  = geo.latitude  ?? existing.latitude;
          existing.longitude = geo.longitude ?? existing.longitude;
          existing.state     = stateInfo.state; // ensure state is set correctly
          await locationRepo.save(existing);

          if (geo.pincode && geo.latitude && geo.longitude) {
            resolvedPool.push({ locality, pincode: geo.pincode, latitude: geo.latitude, longitude: geo.longitude });
          }
          cityUpd++;
          locUpdated++;

        } else {
          // Already fully populated — just track in pool for nearby fallback
          if (existing.pincode && existing.latitude && existing.longitude) {
            resolvedPool.push({
              locality,
              pincode:   existing.pincode,
              latitude:  Number(existing.latitude),
              longitude: Number(existing.longitude),
            });
          }
          // Ensure state field is correct even without geocoding
          if (!existing.state || existing.state !== stateInfo.state) {
            existing.state = stateInfo.state;
            await locationRepo.save(existing);
            cityUpd++;
            locUpdated++;
          } else {
            cityUnch++;
            locUnchanged++;
          }
        }
      }
    }

    console.log(`     → Inserted: ${cityIns}, Updated: ${cityUpd}, Unchanged: ${cityUnch}\n`);
  }

  await dataSource.destroy();

  console.log('─────────────────────────────────────────────────');
  console.log('✅ Seed complete');
  console.log(`   Cities  → inserted: ${citiesInserted}, updated: ${citiesUpdated}`);
  console.log(`   Locations:`);
  console.log(`     inserted  : ${locInserted}`);
  console.log(`     updated   : ${locUpdated}`);
  console.log(`     unchanged : ${locUnchanged}`);
  if (!GEOCODE) {
    console.log(`\n   ℹ️  Pincodes/coordinates not fetched.`);
    console.log(`      Run "npm run seed:locations-xlsx:geocode" to populate them.`);
    console.log(`      Add FORCE_GEO=true to re-geocode rows that already have a pincode.`);
  }
}

function sourceIcon(source: GeoResult['source']): string {
  return { locality: '✅', city: '🏙️', nearby: '📍', none: '❌' }[source];
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

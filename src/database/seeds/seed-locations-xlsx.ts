/**
 * Seed: Locations from XLSX files  (upsert + auto-detect edition)
 *
 * AUTO-DETECT: Scans /locations/*.xlsx automatically.
 *   Any new file dropped in that folder with columns [City, Locality] is picked up.
 *
 * SINGLE FILE: Process only one file:
 *   FILE=mumbai_localities_list.xlsx npm run seed:locations-xlsx
 *   FILE=mumbai                      npm run seed:locations-xlsx   (partial match)
 *
 * State mapping for unknown cities comes from /locations/city-config.json.
 * If a new city is found with no mapping, the seed prints clear instructions
 * and writes a starter entry into city-config.json so you just fill it in.
 *
 * Geocoding fallback chain (GEOCODE=true):
 *   1. Nominatim: "{locality}, {city}, India"
 *   2. Nearest already-resolved locality (Haversine distance)
 *   3. City-level pincode / coords
 *
 * Commands:
 *   npm run seed:locations-xlsx                   upsert all files, no geocoding
 *   npm run seed:locations-xlsx:dry               preview, no DB writes
 *   npm run seed:locations-xlsx:geocode           upsert + geocode missing pincode/coords
 *   npm run seed:locations-xlsx:geocode-force     upsert + re-geocode every row
 *   FILE=mumbai npm run seed:locations-xlsx       process only file(s) matching "mumbai"
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs   from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as https from 'https';
import { DataSource } from 'typeorm';
import { Location } from '../../modules/locations/entities/location.entity';
import { City }     from '../../modules/locations/entities/city.entity';
import { State }    from '../../modules/locations/entities/state.entity';
import { Country }  from '../../modules/locations/entities/country.entity';

// ─── Paths & flags ────────────────────────────────────────────────────────────

const LOCATIONS_DIR  = path.resolve(__dirname, '../../../../locations');
const CITY_CONFIG_FILE = path.join(LOCATIONS_DIR, 'city-config.json');

const DRY_RUN   = process.env.DRY_RUN   === 'true';
const GEOCODE   = process.env.GEOCODE   === 'true';
const FORCE_GEO = process.env.FORCE_GEO === 'true';
const FILE_FILTER = (process.env.FILE ?? '').trim().toLowerCase(); // partial filename match

// ─── Built-in city → state map (fallback if not in city-config.json) ─────────

const BUILTIN_CITY_STATE: Record<string, { state: string; stateCode: string }> = {
  'Bangalore':     { state: 'Karnataka',     stateCode: 'KA' },
  'Bengaluru':     { state: 'Karnataka',     stateCode: 'KA' },
  'Delhi':         { state: 'Delhi',         stateCode: 'DL' },
  'New Delhi':     { state: 'Delhi',         stateCode: 'DL' },
  'Ghaziabad':     { state: 'Uttar Pradesh', stateCode: 'UP' },
  'Greater Noida': { state: 'Uttar Pradesh', stateCode: 'UP' },
  'Gurgaon':       { state: 'Haryana',       stateCode: 'HR' },
  'Gurugram':      { state: 'Haryana',       stateCode: 'HR' },
  'Hyderabad':     { state: 'Telangana',     stateCode: 'TS' },
  'Noida':         { state: 'Uttar Pradesh', stateCode: 'UP' },
  'Mumbai':        { state: 'Maharashtra',   stateCode: 'MH' },
  'Pune':          { state: 'Maharashtra',   stateCode: 'MH' },
  'Nagpur':        { state: 'Maharashtra',   stateCode: 'MH' },
  'Chennai':       { state: 'Tamil Nadu',    stateCode: 'TN' },
  'Kolkata':       { state: 'West Bengal',   stateCode: 'WB' },
  'Ahmedabad':     { state: 'Gujarat',       stateCode: 'GJ' },
  'Surat':         { state: 'Gujarat',       stateCode: 'GJ' },
  'Jaipur':        { state: 'Rajasthan',     stateCode: 'RJ' },
  'Lucknow':       { state: 'Uttar Pradesh', stateCode: 'UP' },
  'Agra':          { state: 'Uttar Pradesh', stateCode: 'UP' },
  'Varanasi':      { state: 'Uttar Pradesh', stateCode: 'UP' },
  'Kochi':         { state: 'Kerala',        stateCode: 'KL' },
  'Faridabad':     { state: 'Haryana',       stateCode: 'HR' },
  'Chandigarh':    { state: 'Chandigarh',    stateCode: 'CH' },
  'Indore':        { state: 'Madhya Pradesh',stateCode: 'MP' },
  'Bhopal':        { state: 'Madhya Pradesh',stateCode: 'MP' },
  'Coimbatore':    { state: 'Tamil Nadu',    stateCode: 'TN' },
  'Mysore':        { state: 'Karnataka',     stateCode: 'KA' },
  'Mysuru':        { state: 'Karnataka',     stateCode: 'KA' },
};

// Built-in SEO meta per city
const BUILTIN_CITY_META: Record<string, { slug: string; imageUrl?: string; isFeatured?: boolean }> = {
  'Bangalore':     { slug: 'bangalore',     isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&q=80' },
  'Delhi':         { slug: 'delhi',         isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=80' },
  'Ghaziabad':     { slug: 'ghaziabad',     isFeatured: false },
  'Greater Noida': { slug: 'greater-noida', isFeatured: false },
  'Gurgaon':       { slug: 'gurgaon',       isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1615853481284-a29fefdbc57f?w=600&q=80' },
  'Hyderabad':     { slug: 'hyderabad',     isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1572445373025-8b4b3ab7dd21?w=600&q=80' },
  'Noida':         { slug: 'noida',         isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1592492152545-9695d3f473f4?w=600&q=80' },
  'Mumbai':        { slug: 'mumbai',        isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=600&q=80' },
  'Pune':          { slug: 'pune',          isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=600&q=80' },
  'Chennai':       { slug: 'chennai',       isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&q=80' },
  'Kolkata':       { slug: 'kolkata',       isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1558431382-27e303142255?w=600&q=80' },
  'Ahmedabad':     { slug: 'ahmedabad',     isFeatured: false },
  'Jaipur':        { slug: 'jaipur',        isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&q=80' },
  'Lucknow':       { slug: 'lucknow',       isFeatured: false },
  'Kochi':         { slug: 'kochi',         isFeatured: false },
};

// ─── city-config.json loader/writer ──────────────────────────────────────────

interface CityConfigEntry {
  state:     string;
  stateCode: string;
  slug?:     string;
  imageUrl?: string;
  isFeatured?: boolean;
}

type CityConfig = Record<string, CityConfigEntry>;

function loadCityConfig(): CityConfig {
  if (!fs.existsSync(CITY_CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CITY_CONFIG_FILE, 'utf-8')) as CityConfig;
  } catch {
    console.warn(`⚠️  city-config.json is invalid JSON — ignoring`);
    return {};
  }
}

function saveCityConfig(config: CityConfig): void {
  fs.writeFileSync(CITY_CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/** Merge built-in + city-config.json, city-config.json takes priority */
function buildCityStateMap(): Record<string, CityConfigEntry> {
  const base: CityConfig = {};
  for (const [city, info] of Object.entries(BUILTIN_CITY_STATE)) {
    base[city] = {
      ...info,
      ...(BUILTIN_CITY_META[city] ?? { slug: city.toLowerCase().replace(/\s+/g, '-') }),
    };
  }
  const custom = loadCityConfig();
  return { ...base, ...custom };
}

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

// ─── Geocoding (Nominatim) ────────────────────────────────────────────────────

interface GeoResult {
  pincode:   string | null;
  latitude:  number | null;
  longitude: number | null;
  source:    'locality' | 'city' | 'nearby' | 'none';
}

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
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestPoint(lat: number, lon: number, pool: ResolvedPoint[]): ResolvedPoint | null {
  let best: ResolvedPoint | null = null, bestDist = Infinity;
  for (const pt of pool) {
    const d = haversineKm(lat, lon, pt.latitude, pt.longitude);
    if (d < bestDist) { bestDist = d; best = pt; }
  }
  return best;
}

async function nominatim(query: string): Promise<{ lat: number; lon: number; pincode: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=in`;
    const raw = await httpsGet(url);
    const res = JSON.parse(raw);
    if (!res?.length) return null;
    return { lat: parseFloat(res[0].lat), lon: parseFloat(res[0].lon), pincode: res[0].address?.postcode ?? null };
  } catch { return null; }
}

async function geocodeCity(cityName: string) {
  const hit = await nominatim(`${cityName}, India`);
  await sleep(1100);
  return hit ? { pincode: hit.pincode, latitude: hit.lat, longitude: hit.lon }
             : { pincode: null, latitude: null, longitude: null };
}

async function geocodeWithFallback(
  locality: string, city: string,
  cityGeo: { pincode: string | null; latitude: number | null; longitude: number | null },
  pool: ResolvedPoint[],
): Promise<GeoResult> {
  // Tier 1 — exact locality
  const hit = await nominatim(`${locality}, ${city}, India`);
  await sleep(1100);

  if (hit) {
    if (hit.pincode) return { pincode: hit.pincode, latitude: hit.lat, longitude: hit.lon, source: 'locality' };
    // Tier 2 — nearby resolved locality
    const near = nearestPoint(hit.lat, hit.lon, pool);
    if (near) return { pincode: near.pincode, latitude: hit.lat, longitude: hit.lon, source: 'nearby' };
    // Tier 3 — city pincode with own coords
    if (cityGeo.pincode) return { pincode: cityGeo.pincode, latitude: hit.lat, longitude: hit.lon, source: 'city' };
  }

  // Tier 3 — city pincode with city coords
  if (cityGeo.pincode) return { pincode: cityGeo.pincode, latitude: cityGeo.latitude, longitude: cityGeo.longitude, source: 'city' };

  // Tier 4 — last resort: first available in pool
  if (pool.length > 0) {
    const pt = pool[pool.length - 1];
    return { pincode: pt.pincode, latitude: pt.latitude, longitude: pt.longitude, source: 'nearby' };
  }

  return { pincode: null, latitude: null, longitude: null, source: 'none' };
}

// ─── XLSX file discovery ──────────────────────────────────────────────────────

interface LocalityRow { city: string; locality: string; file: string; }

function discoverFiles(): string[] {
  const all = fs.readdirSync(LOCATIONS_DIR).filter((f) => f.endsWith('.xlsx'));
  if (!FILE_FILTER) return all;

  const matched = all.filter((f) => f.toLowerCase().includes(FILE_FILTER));
  if (matched.length === 0) {
    console.error(`\n❌  No xlsx file matching FILE="${FILE_FILTER}" found in ${LOCATIONS_DIR}`);
    console.error(`   Available files:\n${all.map((f) => `     - ${f}`).join('\n')}`);
    process.exit(1);
  }
  return matched;
}

function readXlsxFiles(files: string[]): LocalityRow[] {
  const rows: LocalityRow[] = [];
  for (const file of files) {
    const wb   = XLSX.readFile(path.join(LOCATIONS_DIR, file));
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

    // Detect column names case-insensitively
    const sample    = data[0] ?? {};
    const cityCol   = Object.keys(sample).find((k) => k.toLowerCase() === 'city');
    const localCol  = Object.keys(sample).find((k) => k.toLowerCase() === 'locality');

    if (!cityCol || !localCol) {
      console.warn(`  ⚠️  Skipping ${file} — missing "City" or "Locality" columns (found: ${Object.keys(sample).join(', ')})`);
      continue;
    }

    let count = 0;
    for (const row of data) {
      const city     = String(row[cityCol]  ?? '').trim();
      const locality = String(row[localCol] ?? '').trim();
      if (city && locality) { rows.push({ city, locality, file }); count++; }
    }
    console.log(`  ✅ ${file}  →  ${count} rows  (City="${cityCol}", Locality="${localCol}")`);
  }
  return rows;
}

// ─── Unknown city handler ─────────────────────────────────────────────────────

/**
 * For cities not in any map: write a placeholder to city-config.json,
 * print clear instructions, and skip the city in this run.
 */
function handleUnknownCities(unknownCities: Set<string>): void {
  if (unknownCities.size === 0) return;

  const config = loadCityConfig();
  let added = false;

  console.log('\n⚠️  UNKNOWN CITIES — not in built-in map or city-config.json:');
  for (const city of unknownCities) {
    console.log(`   - ${city}`);
    if (!config[city]) {
      config[city] = {
        state:     'TODO — fill state name e.g. Maharashtra',
        stateCode: 'TODO — fill 2-letter code e.g. MH',
        slug:      city.toLowerCase().replace(/\s+/g, '-'),
        isFeatured: false,
      };
      added = true;
    }
  }

  if (added) {
    saveCityConfig(config);
    console.log(`\n   📝 Placeholder entries written to: ${CITY_CONFIG_FILE}`);
  }

  console.log(`
   ─────────────────────────────────────────────────────────
   To add a new city, edit:  ${CITY_CONFIG_FILE}
   Fill in the "state" and "stateCode" fields, then re-run.

   Example entry for Mumbai:
   {
     "Mumbai": {
       "state": "Maharashtra",
       "stateCode": "MH",
       "slug": "mumbai",
       "isFeatured": true,
       "imageUrl": "https://..."
     }
   }
   ─────────────────────────────────────────────────────────
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏙️  Seed: Locations from XLSX  (auto-detect + upsert)`);
  console.log(`   DRY_RUN=${DRY_RUN}  GEOCODE=${GEOCODE}  FORCE_GEO=${FORCE_GEO}`);
  console.log(`   DIR: ${LOCATIONS_DIR}`);
  if (FILE_FILTER) console.log(`   FILE filter: "${FILE_FILTER}"`);
  console.log();

  // 1. Discover & read files
  const files   = discoverFiles();
  console.log(`📂 Found ${files.length} file(s): ${files.join(', ')}`);
  const allRows = readXlsxFiles(files);
  console.log(`   Total rows: ${allRows.length}\n`);

  // 2. Build city→state map (built-in + city-config.json)
  const cityStateMap = buildCityStateMap();

  // 3. Group rows by city, detect unknowns
  const byCityMap    = new Map<string, string[]>();
  const unknownCities = new Set<string>();

  for (const { city, locality } of allRows) {
    if (!byCityMap.has(city)) byCityMap.set(city, []);
    byCityMap.get(city)!.push(locality);
    if (!cityStateMap[city]) unknownCities.add(city);
  }

  handleUnknownCities(unknownCities);

  const knownCities = [...byCityMap.keys()].filter((c) => cityStateMap[c]);
  console.log(`   Known cities (will process)  : ${knownCities.join(', ')}`);
  if (unknownCities.size) {
    console.log(`   Unknown cities (will skip)   : ${[...unknownCities].join(', ')}`);
  }

  // 4. Dry run
  if (DRY_RUN) {
    console.log('\nDRY RUN — listing what would be upserted:\n');
    for (const city of knownCities) {
      const localities = byCityMap.get(city)!;
      const info = cityStateMap[city];
      console.log(`  ${city} (${info.state}) → ${localities.length} localities`);
      localities.slice(0, 5).forEach((l) => console.log(`    - ${l}`));
      if (localities.length > 5) console.log(`    ... and ${localities.length - 5} more`);
    }
    console.log('\nDry run complete. No DB changes made.');
    return;
  }

  // 5. Connect DB
  await dataSource.initialize();
  console.log('\n✅ DB connected\n');

  const stateRepo    = dataSource.getRepository(State);
  const cityRepo     = dataSource.getRepository(City);
  const locationRepo = dataSource.getRepository(Location);

  let citiesInserted = 0, citiesUpdated = 0;
  let locInserted = 0, locUpdated = 0, locUnchanged = 0;

  // 6. Process each known city
  for (const cityName of knownCities) {
    const info      = cityStateMap[cityName];
    const localities = byCityMap.get(cityName)!;

    const stateEntity = await stateRepo.findOne({ where: { code: info.stateCode } });
    if (!stateEntity) {
      console.warn(`  ⚠️  State "${info.state}" (${info.stateCode}) not found in DB — run main seed first, then retry`);
      continue;
    }

    // ── Upsert city ──────────────────────────────────────────────────────────
    let cityEntity = await cityRepo.findOne({ where: { name: cityName, stateId: stateEntity.id } });
    const slug = info.slug ?? cityName.toLowerCase().replace(/\s+/g, '-');

    if (!cityEntity) {
      cityEntity = await cityRepo.save(cityRepo.create({
        name:            cityName,
        stateId:         stateEntity.id,
        isActive:        true,
        isFeatured:      info.isFeatured ?? false,
        slug,
        imageUrl:        info.imageUrl,
        h1:              `Property in ${cityName}`,
        metaTitle:       `Buy & Rent Property in ${cityName} - Think4BuySale`,
        metaDescription: `Find properties for sale and rent in ${cityName}. Browse all localities.`,
        metaKeywords:    `buy property ${cityName.toLowerCase()}, rent flat ${cityName.toLowerCase()}, ${cityName.toLowerCase()} real estate`,
      }));
      citiesInserted++;
      console.log(`  ✅ City inserted : ${cityName} (${info.state})`);
    } else {
      let dirty = false;
      if (!cityEntity.slug     && slug)          { cityEntity.slug     = slug;          dirty = true; }
      if (!cityEntity.imageUrl && info.imageUrl)  { cityEntity.imageUrl = info.imageUrl; dirty = true; }
      if (!cityEntity.metaTitle)                  { cityEntity.metaTitle = `Buy & Rent Property in ${cityName} - Think4BuySale`; dirty = true; }
      if (dirty) { await cityRepo.save(cityEntity); citiesUpdated++; }
      console.log(`  ♻️  City exists  : ${cityName}${dirty ? ' (meta updated)' : ''}`);
    }

    // ── Geocode city once as fallback ────────────────────────────────────────
    let cityGeo = { pincode: null as string | null, latitude: null as number | null, longitude: null as number | null };
    if (GEOCODE) {
      process.stdout.write(`  🌍 Geocoding city "${cityName}"... `);
      cityGeo = await geocodeCity(cityName);
      console.log(cityGeo.pincode ? `pincode=${cityGeo.pincode}` : 'not found');
    }

    const resolvedPool: ResolvedPoint[] = [];

    // ── Upsert localities ────────────────────────────────────────────────────
    console.log(`  📍 Processing ${localities.length} localities...`);
    let ins = 0, upd = 0, unch = 0;

    for (let i = 0; i < localities.length; i++) {
      const locality = localities[i];
      const existing = await locationRepo.findOne({ where: { city: cityName, locality } });

      if (!existing) {
        // ── INSERT ──────────────────────────────────────────────────────────
        let geo: GeoResult = { pincode: null, latitude: null, longitude: null, source: 'none' };
        if (GEOCODE) {
          process.stdout.write(`    [${i + 1}/${localities.length}] INSERT "${locality}"... `);
          geo = await geocodeWithFallback(locality, cityName, cityGeo, resolvedPool);
          console.log(`${srcIcon(geo.source)} pincode=${geo.pincode ?? 'null'} (${geo.source})`);
        }

        await locationRepo.save(locationRepo.create({
          city: cityName, state: info.state, locality,
          pincode: geo.pincode, latitude: geo.latitude, longitude: geo.longitude,
          isActive: true, propertyCount: 0,
        }));

        if (geo.pincode && geo.latitude && geo.longitude) {
          resolvedPool.push({ locality, pincode: geo.pincode, latitude: geo.latitude, longitude: geo.longitude });
        }
        ins++; locInserted++;

      } else {
        // ── UPDATE ──────────────────────────────────────────────────────────
        const needsGeo = GEOCODE && (FORCE_GEO || !existing.pincode || !existing.latitude);

        if (needsGeo) {
          process.stdout.write(`    [${i + 1}/${localities.length}] UPDATE "${locality}"... `);
          const geo = await geocodeWithFallback(locality, cityName, cityGeo, resolvedPool);
          console.log(`${srcIcon(geo.source)} pincode=${geo.pincode ?? 'null'} (${geo.source})`);

          existing.pincode   = geo.pincode   ?? existing.pincode;
          existing.latitude  = geo.latitude  ?? existing.latitude;
          existing.longitude = geo.longitude ?? existing.longitude;
          existing.state     = info.state;
          await locationRepo.save(existing);

          if (geo.pincode && geo.latitude && geo.longitude) {
            resolvedPool.push({ locality, pincode: geo.pincode, latitude: geo.latitude, longitude: geo.longitude });
          }
          upd++; locUpdated++;

        } else {
          // Feed pool from existing data
          if (existing.pincode && existing.latitude && existing.longitude) {
            resolvedPool.push({
              locality, pincode: existing.pincode,
              latitude: Number(existing.latitude), longitude: Number(existing.longitude),
            });
          }
          // Fix state if wrong
          if (existing.state !== info.state) {
            existing.state = info.state;
            await locationRepo.save(existing);
            upd++; locUpdated++;
          } else {
            unch++; locUnchanged++;
          }
        }
      }
    }

    console.log(`     → inserted: ${ins}, updated: ${upd}, unchanged: ${unch}\n`);
  }

  await dataSource.destroy();

  console.log('──────────────────────────────────────────────────────');
  console.log('✅ Seed complete');
  console.log(`   Cities    → inserted: ${citiesInserted}, updated: ${citiesUpdated}`);
  console.log(`   Locations → inserted: ${locInserted}, updated: ${locUpdated}, unchanged: ${locUnchanged}`);
  if (!GEOCODE) {
    console.log(`\n   ℹ️  Pincode/coordinates not fetched.`);
    console.log(`      Run "npm run seed:locations-xlsx:geocode" to populate them.`);
    console.log(`      Use FORCE_GEO=true to re-geocode rows that already have a pincode.`);
  }
}

function srcIcon(s: GeoResult['source']) {
  return { locality: '✅', city: '🏙️ ', nearby: '📍', none: '❌' }[s];
}

main().catch((err) => { console.error('❌ Seed failed:', err); process.exit(1); });

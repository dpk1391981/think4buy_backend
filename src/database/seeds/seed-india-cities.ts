/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  seed-india-cities.ts — bulk import of 537 Indian cities (+ their localities)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Fills `states` + `cities` from src/database/data/india-cities.ts, and
 *  optionally `locations` (the localities table) from OpenStreetMap, so the
 *  admin SEO screens have the whole country to pick from instead of the 20
 *  cities that came out of the xlsx seed.
 *
 *  UPSERT, NEVER DUPLICATE, NEVER RENAME
 *    An existing city is matched by slug, then by a known alias (Bengaluru →
 *    the existing `bangalore` row), then by name, and is left under the name it
 *    already has. That is not cosmetic: `locations.city` and `properties.city`
 *    are name strings, so renaming Bangalore to Bengaluru would orphan its 428
 *    localities and every property in it. Only blank columns are filled in,
 *    unless --force. Localities are matched case-insensitively within a city.
 *
 *  NEW CITIES ARE INACTIVE
 *    LocationsService.getCities() returns active cities alphabetically with a
 *    default limit of 50, and the navbar, the post-property form and the agent
 *    filters all read it. Activating 537 cities at once would push Mumbai and
 *    Delhi out of every one of those pickers. New rows are therefore written
 *    with isActive = 0 — they are still fully selectable in the admin SEO city
 *    picker, which lists inactive cities too. Use --activate for a city once it
 *    genuinely has listings, or flip it in /admin/locations.
 *
 *  LOCALITIES (--localities)
 *    `cities` has no coordinates, so each city is geocoded through Nominatim
 *    (cached on disk) and its localities are read from Overpass within
 *    --radius. Both services are free, anonymous and rate-limited; the delays
 *    below follow their usage policies, which makes a full run slow — several
 *    hours for all 537 cities. Run it in batches with --state / --limit.
 *
 *  CLI FLAGS
 *  ─────────
 *    --dry-run            Preview, no DB writes
 *    --activate           Create (and flip) cities with isActive = 1
 *    --force              Overwrite city SEO fields that are already set
 *    --localities         Also import localities from OpenStreetMap
 *    --radius=N           Overpass search radius in metres (default 15000)
 *    --max-localities=N   Cap new localities per city (default 60)
 *    --city=NAME          Only cities whose name contains NAME
 *    --state=NAME         Only cities whose state contains NAME
 *    --limit=N            Only the first N cities of the (filtered) list
 *    --delay=N            ms between Nominatim calls (default 1200)
 *
 *  npm scripts:
 *    npm run seed:india-cities:dry          preview, no writes
 *    npm run seed:india-cities              cities only (fast, no network)
 *    npm run seed:india-cities:full         cities + localities from OSM (slow)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { DataSource, Repository } from 'typeorm';

import { Location } from '../../modules/locations/entities/location.entity';
import { City } from '../../modules/locations/entities/city.entity';
import { State } from '../../modules/locations/entities/state.entity';
import { Country } from '../../modules/locations/entities/country.entity';
import { INDIA_CITIES, SeedCity } from '../data/india-cities';
import { INDIA_STATE_CODES } from '../data/india-states';

// ─── CLI flags ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const numFlag = (name: string, def: number) => {
  const a = argv.find((v) => v.startsWith(`--${name}=`));
  const n = a ? parseInt(a.split('=')[1], 10) : NaN;
  return Number.isFinite(n) ? n : def;
};
const strFlag = (name: string) => {
  const a = argv.find((v) => v.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : undefined;
};

const DRY_RUN        = flag('dry-run') || process.env.DRY_RUN === 'true';
const ACTIVATE       = flag('activate');
const FORCE          = flag('force');
const LOCALITIES     = flag('localities');
const RADIUS_M       = numFlag('radius', 15000);
const MAX_LOCALITIES = numFlag('max-localities', 60);
const LIMIT          = numFlag('limit', 0);
const GEO_DELAY_MS   = numFlag('delay', 1200); // Nominatim policy: max 1 req/sec
const CITY_FILTER    = strFlag('city')?.toLowerCase();
const STATE_FILTER   = strFlag('state')?.toLowerCase();

const OVERPASS_DELAY_MS = 2000;
const UA = 'think4buysale-seeder/1.0 (think4buysale.com)';
const CACHE_PATH = path.resolve(__dirname, '../../../locations/geocode-cache.json');

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Slug ─────────────────────────────────────────────────────────────────────
// Must match SeoService.toSlug() / the admin UI's toSlug(), or the SEO URLs the
// Quick SEO screen generates won't line up with the rows written here.

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[()&,.]/g, '')
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── OpenStreetMap ────────────────────────────────────────────────────────────

interface GeoResult { lat: number; lon: number; pincode?: string }

/** Mainland + islands. A hit outside this box is not the place we asked for. */
function inIndia(lat: number, lon: number): boolean {
  return lat >= 6 && lat <= 37.6 && lon >= 68 && lon <= 97.5;
}

async function nominatim(params: Record<string, string>): Promise<any | null> {
  const qs = new URLSearchParams({
    format: 'jsonv2', limit: '1', addressdetails: '1', countrycodes: 'in', ...params,
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any[];
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Structured query first — it constrains the search to the right state, which
 * matters in India, where Bilaspur, Hamirpur and Udaipur each name a town in
 * more than one state.
 */
async function geocodeCity(name: string, state: string): Promise<GeoResult | null> {
  // A suffixed name ("Bilaspur (Himachal Pradesh)") is not what OSM calls it.
  const plain = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  let item = await nominatim({ city: plain, state, country: 'India' });
  if (!item) {
    await sleep(GEO_DELAY_MS);
    item = await nominatim({ q: `${plain}, ${state}, India` });
  }
  if (!item) return null;

  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inIndia(lat, lon)) return null;

  return { lat, lon, pincode: item.address?.postcode?.replace(/\s/g, '') || undefined };
}

/** OSM names are often in the local script; we can only store what a user can type. */
function pickLatinName(tags: Record<string, string>): string | null {
  for (const key of ['name:en', 'name', 'int_name']) {
    const v = (tags?.[key] || '').trim();
    if (v && /^[\x20-\x7E]+$/.test(v) && /[A-Za-z]/.test(v)) return v;
  }
  return null;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

interface OsmPlace { name: string; lat: number; lon: number; pincode?: string }

/**
 * Every named suburb/neighbourhood OSM knows within `radiusM` of a point.
 *
 * null (every mirror throttled) is NOT the same as [] (OSM has nothing mapped
 * there) — the caller reports the difference so a half-finished run isn't read
 * as a complete one.
 */
async function fetchLocalitiesNearby(lat: number, lon: number, radiusM: number): Promise<OsmPlace[] | null> {
  const query = `
    [out:json][timeout:60];
    (
      node(around:${radiusM},${lat},${lon})["place"~"^(suburb|neighbourhood|quarter|city_district)$"]["name"];
      way(around:${radiusM},${lat},${lon})["place"~"^(suburb|neighbourhood|quarter|city_district)$"]["name"];
    );
    out center tags;`;

  for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length * 2; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(75_000),
      });
      if (res.status === 429 || res.status >= 500) { await sleep(OVERPASS_DELAY_MS * (attempt + 1)); continue; }
      if (!res.ok) return null;

      const data = (await res.json()) as { elements?: any[] };
      const out: OsmPlace[] = [];
      const seen = new Set<string>();
      for (const el of data.elements || []) {
        const name = pickLatinName(el.tags || {});
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        const plat = el.lat ?? el.center?.lat;
        const plon = el.lon ?? el.center?.lon;
        if (!Number.isFinite(plat) || !Number.isFinite(plon)) continue;
        seen.add(key);
        out.push({ name, lat: plat, lon: plon, pincode: (el.tags?.['addr:postcode'] || '').replace(/\s/g, '') || undefined });
      }
      return out;
    } catch {
      await sleep(OVERPASS_DELAY_MS * (attempt + 1));
    }
  }
  return null;
}

// ─── Geocode cache ────────────────────────────────────────────────────────────
// A full run is hours of rate-limited HTTP. Caching to disk makes every re-run
// (a wider --limit, one more state, a second pass for localities) nearly free.

type Cache = Record<string, GeoResult | null>;

function loadCache(): Cache {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Cache; } catch { return {}; }
}

function saveCache(cache: Cache): void {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (err: any) {
    console.warn(`  ⚠️  Could not write geocode cache: ${err.message}`);
  }
}

async function cachedGeocode(name: string, state: string, cache: Cache): Promise<GeoResult | null> {
  const key = `${name}|${state}`;
  if (key in cache) return cache[key];
  const result = await geocodeCity(name, state);
  await sleep(GEO_DELAY_MS);
  cache[key] = result;
  return result;
}

// ─── DataSource ───────────────────────────────────────────────────────────────

const dataSource = new DataSource({
  type: 'mysql',
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'realestate_db',
  entities: [Location, City, State, Country],
  // Never let a seed alter the schema — this database is built by migrations.
  synchronize: false,
  charset: 'utf8mb4',
});

// ─── City matching ────────────────────────────────────────────────────────────
// One read of `cities`, all matching in memory. Keyed by slug, by lowercased
// name and by lowercased alias, so a seed row finds the existing city whichever
// of its two names that row was created under.

class CityIndex {
  private bySlug = new Map<string, City>();
  private byName = new Map<string, City>();

  static async load(repo: Repository<City>): Promise<CityIndex> {
    const idx = new CityIndex();
    const rows = await repo.find();
    for (const row of rows) {
      if (row.slug) idx.bySlug.set(row.slug.toLowerCase(), row);
      idx.byName.set(row.name.toLowerCase().trim(), row);
      // A row with no slug still has to be findable by the slug we'd give it.
      if (!row.slug) idx.bySlug.set(toSlug(row.name), row);
    }
    return idx;
  }

  find(name: string, aka?: string): City | undefined {
    const candidates = [name, aka].filter(Boolean) as string[];
    for (const candidate of candidates) {
      const hit = this.bySlug.get(toSlug(candidate)) ?? this.byName.get(candidate.toLowerCase().trim());
      if (hit) return hit;
    }
    return undefined;
  }

  add(row: City): void {
    if (row.slug) this.bySlug.set(row.slug.toLowerCase(), row);
    this.byName.set(row.name.toLowerCase().trim(), row);
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const stats = {
  statesCreated: 0,
  citiesCreated: 0, citiesUpdated: 0, citiesUnchanged: 0,
  geoHit: 0, geoMiss: 0,
  localitiesCreated: 0, localitiesSkipped: 0,
};
const noGeo: string[] = [];
const overpassFailed: string[] = [];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let cities: SeedCity[] = INDIA_CITIES;
  if (STATE_FILTER) cities = cities.filter((c) => c.state.toLowerCase().includes(STATE_FILTER));
  if (CITY_FILTER)  cities = cities.filter((c) => c.name.toLowerCase().includes(CITY_FILTER));
  if (LIMIT > 0)    cities = cities.slice(0, LIMIT);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Think4BuySale — India city & locality import');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Mode       : ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '✍️  LIVE'}`);
  console.log(`  Cities     : ${cities.length} of ${INDIA_CITIES.length}`);
  console.log(`  New rows   : ${ACTIVATE ? 'ACTIVE' : 'inactive (use --activate)'}`);
  console.log(`  Existing   : ${FORCE ? 'overwrite SEO fields' : 'fill blanks only (use --force)'}`);
  console.log(`  Localities : ${LOCALITIES ? `YES — OSM, ${RADIUS_M / 1000}km, max ${MAX_LOCALITIES}/city` : 'NO'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (cities.length === 0) {
    console.log('Nothing matched the filters. Check --city / --state.\n');
    return;
  }

  const missingCode = [...new Set(cities.map((c) => c.state))].filter((s) => !INDIA_STATE_CODES[s]);
  if (missingCode.length) {
    console.error(`❌ No state code for: ${missingCode.join(', ')}`);
    console.error(`   Add them to src/database/data/india-states.ts and re-run.\n`);
    process.exit(1);
  }

  await dataSource.initialize();
  const stateRepo    = dataSource.getRepository(State);
  const cityRepo     = dataSource.getRepository(City);
  const locationRepo = dataSource.getRepository(Location);

  // ── States ─────────────────────────────────────────────────────────────────
  const stateByName = new Map<string, State>();
  for (const row of await stateRepo.find()) stateByName.set(row.name.toLowerCase().trim(), row);

  for (const stateName of [...new Set(cities.map((c) => c.state))]) {
    if (stateByName.has(stateName.toLowerCase().trim())) continue;
    const code = INDIA_STATE_CODES[stateName];
    if (DRY_RUN) {
      console.log(`  🏛  State CREATE ${stateName} (${code})`);
      stats.statesCreated++;
      continue;
    }
    // A code collision means this state is already here under another name —
    // reuse that row rather than failing on the unique index.
    const byCode = await stateRepo.findOne({ where: { code } });
    const saved = byCode ?? await stateRepo.save(stateRepo.create({
      name: stateName, code, slug: toSlug(stateName), isActive: true,
    }));
    if (!byCode) { stats.statesCreated++; console.log(`  🏛  State created: ${stateName} (${code})`); }
    stateByName.set(stateName.toLowerCase().trim(), saved);
  }

  // ── Cities ─────────────────────────────────────────────────────────────────
  const index = await CityIndex.load(cityRepo);
  const cache = LOCALITIES ? loadCache() : {};

  let i = 0;
  for (const seed of cities) {
    i++;
    const prefix = `[${String(i).padStart(3)}/${cities.length}] ${seed.name}, ${seed.state}`;
    const state = stateByName.get(seed.state.toLowerCase().trim());
    if (!state && !DRY_RUN) { console.warn(`${prefix} → ⚠️  state row missing, skipped`); continue; }

    const existing = index.find(seed.name, seed.aka);
    const slug = toSlug(seed.name);
    // Everything below is written against the name the row already carries —
    // `locations.city` and `properties.city` join on it by string.
    const cityName = existing?.name ?? seed.name;

    let row = existing;

    if (!existing) {
      if (DRY_RUN) {
        console.log(`${prefix} → CREATE (slug=${slug}, ${ACTIVATE ? 'active' : 'inactive'})`);
        stats.citiesCreated++;
      } else {
        row = await cityRepo.save(cityRepo.create({
          name:            seed.name,
          stateId:         state!.id,
          slug,
          isActive:        ACTIVATE,
          isFeatured:      false,
          h1:              `Property in ${seed.name}`,
          metaTitle:       `Buy & Rent Property in ${seed.name} - Think4BuySale`,
          metaDescription: `Find properties for sale and rent in ${seed.name}, ${seed.state}. Browse verified listings across all localities.`,
          metaKeywords:    `property in ${seed.name.toLowerCase()}, buy property ${seed.name.toLowerCase()}, rent flat ${seed.name.toLowerCase()}, ${seed.name.toLowerCase()} real estate`,
        }));
        index.add(row);
        stats.citiesCreated++;
        console.log(`${prefix} → created (${ACTIVATE ? 'active' : 'inactive'})`);
      }
    } else {
      let dirty = false;
      const set = <K extends keyof City>(key: K, value: City[K]) => {
        if (FORCE || !existing[key]) { existing[key] = value; dirty = true; }
      };
      // Its own name, never the seed's — see the rename note in the header.
      if (!existing.slug) { existing.slug = toSlug(existing.name); dirty = true; }
      set('h1', `Property in ${cityName}`);
      set('metaTitle', `Buy & Rent Property in ${cityName} - Think4BuySale`);
      set('metaDescription', `Find properties for sale and rent in ${cityName}, ${seed.state}. Browse verified listings across all localities.`);
      set('metaKeywords', `property in ${cityName.toLowerCase()}, buy property ${cityName.toLowerCase()}, rent flat ${cityName.toLowerCase()}, ${cityName.toLowerCase()} real estate`);
      if (ACTIVATE && !existing.isActive) { existing.isActive = true; dirty = true; }

      if (dirty && !DRY_RUN) await cityRepo.save(existing);
      if (dirty) { stats.citiesUpdated++; console.log(`${prefix} → updated (${cityName})`); }
      else stats.citiesUnchanged++;
    }

    // ── Localities ───────────────────────────────────────────────────────────
    if (!LOCALITIES) continue;

    const geo = DRY_RUN ? null : await cachedGeocode(cityName, seed.state, cache);
    if (i % 25 === 0) saveCache(cache);

    if (DRY_RUN) { console.log(`      ↳ would fetch localities from OSM`); continue; }
    if (!geo) {
      stats.geoMiss++;
      noGeo.push(`${cityName}, ${seed.state}`);
      console.log(`      ↳ no coordinates for the city, skipping localities`);
      continue;
    }
    stats.geoHit++;

    const places = await fetchLocalitiesNearby(geo.lat, geo.lon, RADIUS_M);
    await sleep(OVERPASS_DELAY_MS);

    if (places === null) {
      overpassFailed.push(`${cityName}, ${seed.state}`);
      console.log(`      ↳ ⚠️  OSM unavailable — re-run with --city="${seed.name}"`);
      continue;
    }
    if (places.length === 0) {
      console.log(`      ↳ OSM knows no localities within ${RADIUS_M / 1000}km`);
      continue;
    }

    // Existing localities of this city, matched case-insensitively by name.
    const known = new Set(
      (await locationRepo.find({ where: { city: cityName } }))
        .map((l) => (l.locality || '').toLowerCase().trim())
        .filter(Boolean),
    );

    const fresh: Location[] = [];
    for (const place of places) {
      if (fresh.length >= MAX_LOCALITIES) break;
      const key = place.name.toLowerCase().trim();
      if (known.has(key)) { stats.localitiesSkipped++; continue; }
      known.add(key);
      fresh.push(locationRepo.create({
        city:      cityName,
        state:     seed.state,
        locality:  place.name,
        pincode:   place.pincode ?? geo.pincode ?? null,
        latitude:  place.lat,
        longitude: place.lon,
        isActive:  true,
        propertyCount: 0,
      }));
    }

    if (fresh.length) {
      await locationRepo.save(fresh, { chunk: 100 });
      stats.localitiesCreated += fresh.length;
    }
    console.log(`      ↳ localities: +${fresh.length} new, ${places.length - fresh.length} already known`);
  }

  if (LOCALITIES) saveCache(cache);
  await dataSource.destroy();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ${DRY_RUN ? 'DRY RUN COMPLETE — nothing was written' : 'IMPORT COMPLETE'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  States     : +${stats.statesCreated} created`);
  console.log(`  Cities     : +${stats.citiesCreated} created  ~${stats.citiesUpdated} updated  ${stats.citiesUnchanged} unchanged`);
  if (LOCALITIES) {
    console.log(`  Geocoding  : ${stats.geoHit} found  ${stats.geoMiss} not found`);
    console.log(`  Localities : +${stats.localitiesCreated} created  ${stats.localitiesSkipped} already existed`);
  }
  if (noGeo.length) {
    console.log(`\n  ⚠️  ${noGeo.length} cities Nominatim could not place (no localities imported):`);
    noGeo.slice(0, 30).forEach((n) => console.log(`       ${n}`));
    if (noGeo.length > 30) console.log(`       … and ${noGeo.length - 30} more`);
  }
  if (overpassFailed.length) {
    console.log(`\n  ⚠️  ${overpassFailed.length} cities got NO localities — every OSM mirror was throttled.`);
    console.log('     This run is incomplete for them; re-running picks them up:');
    overpassFailed.slice(0, 30).forEach((n) => console.log(`       ${n}`));
    if (overpassFailed.length > 30) console.log(`       … and ${overpassFailed.length - 30} more`);
  }
  if (!ACTIVATE && stats.citiesCreated) {
    console.log(`\n  ℹ️  New cities are INACTIVE: they stay out of the navbar / post-property`);
    console.log(`     pickers but are fully selectable in Admin → SEO Templates.`);
    console.log(`     To publish one:  UPDATE cities SET isActive = 1 WHERE slug = 'jodhpur';`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err?.message || err);
  process.exit(1);
});

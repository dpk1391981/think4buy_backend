/**
 * correct-locations.ts
 *
 * Corrects locality / city / state data for India using:
 *   1. India Post PIN API  (free, no key) — resolves State & District from pincode
 *   2. OpenStreetMap Nominatim           — geocodes lat / lng for each locality
 *
 * Run:
 *   npx ts-node src/database/seeds/correct-locations.ts
 *
 * Flags (env):
 *   DRY_RUN=true        — print corrections without writing to DB
 *   GEOCODE=true        — also update lat/lng via Nominatim (slower, 1 req/sec)
 *   BATCH_SIZE=50       — pincodes processed per DB batch (default 50)
 *   PINCODE_DELAY=350   — ms between India-Post API calls (default 350)
 *   GEO_DELAY=1100      — ms between Nominatim calls (default 1100)
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { Location } from '../../modules/locations/entities/location.entity';
import { State }    from '../../modules/locations/entities/state.entity';
import { City }     from '../../modules/locations/entities/city.entity';
import { Country }  from '../../modules/locations/entities/country.entity';

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN      = process.env.DRY_RUN    === 'true';
const DO_GEOCODE   = process.env.GEOCODE     === 'true';
const BATCH_SIZE   = Number(process.env.BATCH_SIZE   || 50);
const PINCODE_DELAY= Number(process.env.PINCODE_DELAY|| 350);
const GEO_DELAY    = Number(process.env.GEO_DELAY    || 1100);

// ── DataSource ───────────────────────────────────────────────────────────────
const dataSource = new DataSource({
  type:       'mysql',
  host:       process.env.DB_HOST     || 'localhost',
  port:       Number(process.env.DB_PORT || 3306),
  username:   process.env.DB_USERNAME || 'dpk1391981',
  password:   process.env.DB_PASSWORD || 'Dpk1391981!',
  database:   process.env.DB_NAME     || 'realestate_db',
  entities:   [Location, State, City, Country],
  synchronize: false,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'think4buysale-location-corrector/1.0 (contact@think4buysale.com)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(1000 * (i + 1));
    }
  }
}

// ── India Post PIN API ────────────────────────────────────────────────────────
interface PinResult {
  state:    string | null;
  district: string | null;
  offices:  string[];
}

async function lookupPincode(pincode: string): Promise<PinResult> {
  try {
    const data = await fetchWithRetry(
      `https://api.postalpincode.in/pincode/${pincode}`
    );
    if (!Array.isArray(data) || data[0]?.Status !== 'Success') {
      return { state: null, district: null, offices: [] };
    }
    const offices: any[] = data[0].PostOffice || [];
    const state    = offices[0]?.State    || null;
    const district = offices[0]?.District || null;
    const names    = offices.map((o: any) => o.Name as string);
    return { state, district, offices: names };
  } catch {
    return { state: null, district: null, offices: [] };
  }
}

// ── Nominatim Geocode ─────────────────────────────────────────────────────────
interface GeoResult {
  lat: number | null;
  lng: number | null;
}

async function geocode(locality: string, city: string, state: string): Promise<GeoResult> {
  try {
    const q   = encodeURIComponent(`${locality}, ${city}, ${state}, India`);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=in`;
    const data = await fetchWithRetry(url);
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return { lat: null, lng: null };
  } catch {
    return { lat: null, lng: null };
  }
}

// ── State name normaliser (India Post names ↔ common names) ──────────────────
const STATE_MAP: Record<string, string> = {
  'Andaman & Nicobar Islands':          'Andaman & Nicobar Islands',
  'Andhra Pradesh':                     'Andhra Pradesh',
  'Arunachal Pradesh':                  'Arunachal Pradesh',
  'Assam':                              'Assam',
  'Bihar':                              'Bihar',
  'Chandigarh':                         'Chandigarh',
  'Chhattisgarh':                       'Chhattisgarh',
  'Dadra & Nagar Haveli':               'Dadra & Nagar Haveli',
  'Daman & Diu':                        'Daman & Diu',
  'Delhi':                              'Delhi',
  'NCT Of Delhi':                       'Delhi',
  'Goa':                                'Goa',
  'Gujarat':                            'Gujarat',
  'Haryana':                            'Haryana',
  'Himachal Pradesh':                   'Himachal Pradesh',
  'Jammu & Kashmir':                    'Jammu & Kashmir',
  'Jharkhand':                          'Jharkhand',
  'Karnataka':                          'Karnataka',
  'Kerala':                             'Kerala',
  'Lakshadweep':                        'Lakshadweep',
  'Madhya Pradesh':                     'Madhya Pradesh',
  'Maharashtra':                        'Maharashtra',
  'Manipur':                            'Manipur',
  'Meghalaya':                          'Meghalaya',
  'Mizoram':                            'Mizoram',
  'Nagaland':                           'Nagaland',
  'Odisha':                             'Odisha',
  'Pondicherry':                        'Puducherry',
  'Puducherry':                         'Puducherry',
  'Punjab':                             'Punjab',
  'Rajasthan':                          'Rajasthan',
  'Sikkim':                             'Sikkim',
  'Tamil Nadu':                         'Tamil Nadu',
  'Telangana':                          'Telangana',
  'Tripura':                            'Tripura',
  'Uttar Pradesh':                      'Uttar Pradesh',
  'Uttarakhand':                        'Uttarakhand',
  'West Bengal':                        'West Bengal',
};

// District → canonical city name for well-known districts
const DISTRICT_TO_CITY: Record<string, string> = {
  'Mumbai':           'Mumbai',
  'Mumbai City':      'Mumbai',
  'Mumbai Suburban':  'Mumbai',
  'Pune':             'Pune',
  'Nagpur':           'Nagpur',
  'Thane':            'Thane',
  'Nashik':           'Nashik',
  'Aurangabad':       'Aurangabad',
  'South West Delhi': 'Delhi',
  'South Delhi':      'Delhi',
  'North Delhi':      'Delhi',
  'East Delhi':       'Delhi',
  'West Delhi':       'Delhi',
  'Central Delhi':    'Delhi',
  'New Delhi':        'Delhi',
  'North East Delhi': 'Delhi',
  'North West Delhi': 'Delhi',
  'Shahdara':         'Delhi',
  'Gurugram':         'Gurgaon',
  'Gurgaon':          'Gurgaon',
  'Faridabad':        'Faridabad',
  'Sonipat':          'Sonipat',
  'Panipat':          'Panipat',
  'Gautam Buddha Nagar': 'Noida',
  'Ghaziabad':        'Ghaziabad',
  'Lucknow':          'Lucknow',
  'Agra':             'Agra',
  'Kanpur Nagar':     'Kanpur',
  'Allahabad':        'Prayagraj',
  'Prayagraj':        'Prayagraj',
  'Varanasi':         'Varanasi',
  'Bangalore':        'Bangalore',
  'Bangalore Rural':  'Bangalore',
  'Bangalore Urban':  'Bangalore',
  'Bengaluru Urban':  'Bangalore',
  'Bengaluru Rural':  'Bangalore',
  'Mysore':           'Mysore',
  'Mysuru':           'Mysore',
  'Mangalore':        'Mangalore',
  'Hubli':            'Hubli',
  'Chennai':          'Chennai',
  'Coimbatore':       'Coimbatore',
  'Madurai':          'Madurai',
  'Tiruchirappalli':  'Tiruchirappalli',
  'Salem':            'Salem',
  'Hyderabad':        'Hyderabad',
  'Rangareddi':       'Hyderabad',
  'Medchal Malkajgiri': 'Hyderabad',
  'Secunderabad':     'Hyderabad',
  'Ahmedabad':        'Ahmedabad',
  'Surat':            'Surat',
  'Vadodara':         'Vadodara',
  'Rajkot':           'Rajkot',
  'Jaipur':           'Jaipur',
  'Jodhpur':          'Jodhpur',
  'Udaipur':          'Udaipur',
  'Kolkata':          'Kolkata',
  'Howrah':           'Howrah',
  'Durgapur':         'Durgapur',
  'Ernakulam':        'Kochi',
  'Thiruvananthapuram': 'Thiruvananthapuram',
  'Kozhikode':        'Kozhikode',
  'Bhopal':           'Bhopal',
  'Indore':           'Indore',
  'Jabalpur':         'Jabalpur',
  'Patna':            'Patna',
  'Ranchi':           'Ranchi',
  'Bhubaneswar':      'Bhubaneswar',
  'Cuttack':          'Cuttack',
  'Chandigarh':       'Chandigarh',
  'Amritsar':         'Amritsar',
  'Ludhiana':         'Ludhiana',
  'Dehradun':         'Dehradun',
  'Shimla':           'Shimla',
};

function normaliseState(raw: string): string {
  return STATE_MAP[raw] ?? raw;
}

function districtToCity(district: string, fallback: string): string {
  return DISTRICT_TO_CITY[district] ?? fallback;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await dataSource.initialize();
  console.log(`\n🗺  Location Correction Script — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  const locationRepo = dataSource.getRepository(Location);

  // 1. Fetch all locations (pages of 1000 to avoid memory overload)
  const PAGE = 1000;
  let offset = 0;
  let totalProcessed = 0;
  let totalCorrected = 0;
  let totalGeoUpdated = 0;
  let totalErrors = 0;

  // Collect unique pincodes first for efficient batching
  const pincodeRows: { pincode: string }[] = await dataSource.query(
    `SELECT DISTINCT pincode FROM locations WHERE pincode IS NOT NULL AND pincode != '' ORDER BY pincode`
  );
  const uniquePincodes = pincodeRows.map(r => r.pincode).filter(Boolean);
  console.log(`Found ${uniquePincodes.length} unique pincodes across locations table.\n`);

  // Build pincode → { state, city } cache
  const pincodeCache: Record<string, { state: string; city: string; offices: string[] }> = {};

  console.log(`Step 1/3 — Resolving pincodes via India Post API...`);
  let pinDone = 0;
  for (const pincode of uniquePincodes) {
    const result = await lookupPincode(pincode);
    if (result.state) {
      const state = normaliseState(result.state);
      const city  = districtToCity(result.district || '', result.district || '');
      pincodeCache[pincode] = { state, city, offices: result.offices };
    }
    pinDone++;
    if (pinDone % 100 === 0) {
      process.stdout.write(`\r  Resolved ${pinDone}/${uniquePincodes.length} pincodes...`);
    }
    await sleep(PINCODE_DELAY);
  }
  console.log(`\n  Done. Resolved ${Object.keys(pincodeCache).length}/${uniquePincodes.length} pincodes.\n`);

  // Step 2 — Update locations table
  console.log(`Step 2/3 — Updating locations table...`);
  offset = 0;
  while (true) {
    const batch = await locationRepo.find({ skip: offset, take: PAGE, order: { id: 'ASC' } });
    if (batch.length === 0) break;

    for (const loc of batch) {
      totalProcessed++;
      const cached = loc.pincode ? pincodeCache[loc.pincode] : null;
      if (!cached) continue;

      const newState = cached.state;
      const newCity  = cached.city || loc.city;

      const stateChanged = loc.state !== newState;
      const cityChanged  = newCity && loc.city !== newCity;

      if (!stateChanged && !cityChanged) continue;

      if (!DRY_RUN) {
        await locationRepo.update(loc.id, {
          ...(stateChanged ? { state: newState }  : {}),
          ...(cityChanged  ? { city:  newCity }   : {}),
        });
      } else {
        console.log(
          `  [DRY] loc ${loc.id}: "${loc.locality}" ${loc.city}/${loc.state}` +
          ` → ${newCity}/${newState}`
        );
      }
      totalCorrected++;
    }
    offset += PAGE;
  }
  console.log(`  Corrected ${totalCorrected} location rows.\n`);

  // Step 3 — Geocode (optional, slow)
  if (DO_GEOCODE) {
    console.log(`Step 3/3 — Geocoding localities via OpenStreetMap Nominatim...`);
    console.log(`  ⚠  Rate-limit: 1 req / ${GEO_DELAY}ms — this will take a while for large datasets.\n`);
    offset = 0;
    while (true) {
      const batch = await locationRepo.find({
        where: { latitude: undefined }, // rows without lat/lng
        skip: offset,
        take: PAGE,
        order: { id: 'ASC' },
      });
      if (batch.length === 0) break;

      for (const loc of batch) {
        if (loc.latitude && loc.longitude) { offset++; continue; }
        const { lat, lng } = await geocode(loc.locality || '', loc.city, loc.state);
        if (lat !== null && lng !== null) {
          if (!DRY_RUN) {
            await locationRepo.update(loc.id, { latitude: lat, longitude: lng });
          }
          totalGeoUpdated++;
        } else {
          totalErrors++;
        }
        await sleep(GEO_DELAY);
      }
      offset += PAGE;
    }
    console.log(`  Geocoded: ${totalGeoUpdated}  |  Not found: ${totalErrors}\n`);
  } else {
    console.log(`Step 3/3 — Geocoding skipped (set GEOCODE=true to enable).\n`);
  }

  // ── Also sync properties table city/state from locations ──────────────────
  console.log(`Bonus — Syncing properties.city / properties.state from pincode cache...`);
  if (!DRY_RUN) {
    let propCorrected = 0;
    const propRows: { id: string; pincode: string; city: string; state: string }[] = await dataSource.query(
      `SELECT id, pincode, city, state FROM properties WHERE pincode IS NOT NULL AND pincode != ''`
    );
    const batchUpdates: Promise<any>[] = [];
    for (const prop of propRows) {
      const cached = prop.pincode ? pincodeCache[prop.pincode] : null;
      if (!cached) continue;
      const newState = cached.state;
      const newCity  = cached.city || prop.city;
      if (prop.state !== newState || prop.city !== newCity) {
        batchUpdates.push(
          dataSource.query(
            `UPDATE properties SET city=?, state=? WHERE id=?`,
            [newCity, newState, prop.id]
          )
        );
        propCorrected++;
        if (batchUpdates.length >= BATCH_SIZE) {
          await Promise.all(batchUpdates.splice(0));
        }
      }
    }
    if (batchUpdates.length > 0) await Promise.all(batchUpdates);
    console.log(`  Updated ${propCorrected} property rows.\n`);
  } else {
    console.log(`  [DRY RUN] Skipped property sync.\n`);
  }

  console.log(`\n✅ Done!`);
  console.log(`   Processed:       ${totalProcessed} location rows`);
  console.log(`   Corrected:       ${totalCorrected} city/state values`);
  if (DO_GEOCODE) {
    console.log(`   Geocoded:        ${totalGeoUpdated}`);
    console.log(`   Geocode errors:  ${totalErrors}`);
  }

  await dataSource.destroy();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

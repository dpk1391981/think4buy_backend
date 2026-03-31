import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as https from 'https';
import { LocationImportJob } from './entities/location-import-job.entity';
import { Location } from '../locations/entities/location.entity';
import { City } from '../locations/entities/city.entity';
import { State } from '../locations/entities/state.entity';
import { LOCATION_IMPORT_QUEUE } from './location-import.service';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LocalityRow { city: string; locality: string; }

interface GeoResult {
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  source: 'locality' | 'city' | 'nearby' | 'none';
}

interface ResolvedPoint {
  locality: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

interface CityConfigEntry {
  state: string;
  stateCode: string;
  slug?: string;
  imageUrl?: string;
  isFeatured?: boolean;
}

// ── Built-in city → state map ──────────────────────────────────────────────────

const BUILTIN_CITY_STATE: Record<string, { state: string; stateCode: string }> = {
  'Bangalore':     { state: 'Karnataka',      stateCode: 'KA' },
  'Bengaluru':     { state: 'Karnataka',      stateCode: 'KA' },
  'Delhi':         { state: 'Delhi',          stateCode: 'DL' },
  'New Delhi':     { state: 'Delhi',          stateCode: 'DL' },
  'Ghaziabad':     { state: 'Uttar Pradesh',  stateCode: 'UP' },
  'Greater Noida': { state: 'Uttar Pradesh',  stateCode: 'UP' },
  'Gurgaon':       { state: 'Haryana',        stateCode: 'HR' },
  'Gurugram':      { state: 'Haryana',        stateCode: 'HR' },
  'Hyderabad':     { state: 'Telangana',      stateCode: 'TS' },
  'Noida':         { state: 'Uttar Pradesh',  stateCode: 'UP' },
  'Mumbai':        { state: 'Maharashtra',    stateCode: 'MH' },
  'Pune':          { state: 'Maharashtra',    stateCode: 'MH' },
  'Nagpur':        { state: 'Maharashtra',    stateCode: 'MH' },
  'Chennai':       { state: 'Tamil Nadu',     stateCode: 'TN' },
  'Kolkata':       { state: 'West Bengal',    stateCode: 'WB' },
  'Ahmedabad':     { state: 'Gujarat',        stateCode: 'GJ' },
  'Surat':         { state: 'Gujarat',        stateCode: 'GJ' },
  'Jaipur':        { state: 'Rajasthan',      stateCode: 'RJ' },
  'Lucknow':       { state: 'Uttar Pradesh',  stateCode: 'UP' },
  'Agra':          { state: 'Uttar Pradesh',  stateCode: 'UP' },
  'Varanasi':      { state: 'Uttar Pradesh',  stateCode: 'UP' },
  'Kochi':         { state: 'Kerala',         stateCode: 'KL' },
  'Faridabad':     { state: 'Haryana',        stateCode: 'HR' },
  'Chandigarh':    { state: 'Chandigarh',     stateCode: 'CH' },
  'Indore':        { state: 'Madhya Pradesh', stateCode: 'MP' },
  'Bhopal':        { state: 'Madhya Pradesh', stateCode: 'MP' },
  'Coimbatore':    { state: 'Tamil Nadu',     stateCode: 'TN' },
  'Mysore':        { state: 'Karnataka',      stateCode: 'KA' },
  'Mysuru':        { state: 'Karnataka',      stateCode: 'KA' },
};

const BUILTIN_CITY_META: Record<string, { slug: string; imageUrl?: string; isFeatured?: boolean }> = {
  'Bangalore':     { slug: 'bangalore',     isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&q=80' },
  'Delhi':         { slug: 'delhi',         isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=80' },
  'Ghaziabad':     { slug: 'ghaziabad',     isFeatured: false },
  'Greater Noida': { slug: 'greater-noida', isFeatured: false },
  'Gurgaon':       { slug: 'gurgaon',       isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1615853481284-a29fefdbc57f?w=600&q=80' },
  'Gurugram':      { slug: 'gurugram',      isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1615853481284-a29fefdbc57f?w=600&q=80' },
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
  'Indore':        { slug: 'indore',        isFeatured: false },
  'Nagpur':        { slug: 'nagpur',        isFeatured: false },
  'Surat':         { slug: 'surat',         isFeatured: false },
  'Faridabad':     { slug: 'faridabad',     isFeatured: false },
  'Chandigarh':    { slug: 'chandigarh',    isFeatured: false },
  'Bhopal':        { slug: 'bhopal',        isFeatured: false },
  'Mysore':        { slug: 'mysore',        isFeatured: false },
  'Mysuru':        { slug: 'mysuru',        isFeatured: false },
  'Coimbatore':    { slug: 'coimbatore',    isFeatured: false },
  'Agra':          { slug: 'agra',          isFeatured: false },
  'Varanasi':      { slug: 'varanasi',      isFeatured: false },
};

const SKIP_LOCALITY_HEADERS = new Set([
  'area name', 'location name', 'location names',
  'locality name', 'localities', 'locations',
]);

// ── Geocoding helpers ──────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestPoint(lat: number, lon: number, pool: ResolvedPoint[]): ResolvedPoint | null {
  let best: ResolvedPoint | null = null;
  let bestDist = Infinity;
  for (const pt of pool) {
    const d = haversineKm(lat, lon, pt.latitude, pt.longitude);
    if (d < bestDist) { bestDist = d; best = pt; }
  }
  return best;
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

async function nominatim(query: string): Promise<{ lat: number; lon: number; pincode: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=in`;
    const raw = await httpsGet(url);
    const res = JSON.parse(raw);
    if (!res?.length) return null;
    return { lat: parseFloat(res[0].lat), lon: parseFloat(res[0].lon), pincode: res[0].address?.postcode ?? null };
  } catch { return null; }
}

// ── Processor ─────────────────────────────────────────────────────────────────

@Processor(LOCATION_IMPORT_QUEUE)
export class LocationImportProcessor extends WorkerHost {
  private readonly logger = new Logger(LocationImportProcessor.name);

  constructor(
    @InjectRepository(LocationImportJob)
    private readonly jobRepo: Repository<LocationImportJob>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(City)
    private readonly cityRepo: Repository<City>,
    @InjectRepository(State)
    private readonly stateRepo: Repository<State>,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    const { jobId } = job.data;

    const importJob = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!importJob) {
      this.logger.error(`Import job ${jobId} not found in DB`);
      return;
    }

    // Mark as processing
    await this.jobRepo.update(jobId, { status: 'processing', startedAt: new Date() });

    // Log buffer — flushed to DB every N rows
    const logBuf: string[] = [];
    const ts = () => new Date().toISOString();
    const log = (msg: string) => {
      const line = `[${ts()}] ${msg}`;
      logBuf.push(line);
      this.logger.log(`[Job:${jobId.slice(0, 8)}] ${msg}`);
    };

    const flushLog = async () => {
      if (logBuf.length === 0) return;
      const text = logBuf.join('\n') + '\n';
      logBuf.length = 0;
      await this.jobRepo.manager.query(
        `UPDATE location_import_jobs SET logOutput = CONCAT(COALESCE(logOutput, ''), ?) WHERE id = ?`,
        [text, jobId],
      );
    };

    try {
      const { options, filePath, fileName } = importJob;
      const { geocode, forceGeocode, dryRun, fileFilter } = options;

      log(`Starting import: ${fileName}`);
      await flushLog();

      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`Uploaded file not found at path: ${filePath}`);
      }

      // Parse spreadsheet
      const wb = XLSX.readFile(filePath);
      log(`Parsed file: ${wb.SheetNames.length} sheet(s) — [${wb.SheetNames.join(', ')}]`);

      // Auto-detect format A vs B
      let rows: LocalityRow[];
      if (wb.SheetNames.length > 1) {
        log(`Detected: Format A (multi-sheet / tab-per-city)`);
        rows = this.readTabBasedXlsx(wb, log);
      } else {
        log(`Detected: Format B (single-sheet with City + Locality columns)`);
        rows = this.readSingleSheetXlsx(wb, log);
      }

      // Apply file filter
      if (fileFilter?.trim()) {
        const filter = fileFilter.toLowerCase();
        const before = rows.length;
        rows = rows.filter((r) => r.city.toLowerCase().includes(filter));
        log(`Filter "${fileFilter}": ${before} → ${rows.length} rows`);
      }

      log(`Total rows to process: ${rows.length}`);
      await this.jobRepo.update(jobId, { totalRows: rows.length });
      await flushLog();

      // Build city→state map
      const cityStateMap = this.buildCityStateMap();

      // Group by city, detect unknowns
      const byCityMap = new Map<string, string[]>();
      const unknownCities = new Set<string>();

      for (const { city, locality } of rows) {
        if (!byCityMap.has(city)) byCityMap.set(city, []);
        byCityMap.get(city)!.push(locality);
        if (!cityStateMap[city]) unknownCities.add(city);
      }

      if (unknownCities.size > 0) {
        log(`⚠️  Unknown cities (skipped — no state mapping): ${[...unknownCities].join(', ')}`);
        log(`   Add them to city-config.json to include in future imports.`);
      }

      const knownCities = [...byCityMap.keys()].filter((c) => cityStateMap[c]);
      log(`Known cities to process: ${knownCities.join(', ')}`);
      await flushLog();

      // Dry-run path
      if (dryRun) {
        log(`--- DRY RUN — No DB writes ---`);
        for (const city of knownCities) {
          const localities = byCityMap.get(city)!;
          const info = cityStateMap[city];
          log(`  ${city} (${info.state}) → ${localities.length} localities`);
          localities.slice(0, 3).forEach((l) => log(`    · ${l}`));
          if (localities.length > 3) log(`    … and ${localities.length - 3} more`);
        }
        log(`Dry run complete.`);
        await flushLog();

        await this.jobRepo.update(jobId, {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
        });
        this.cleanupFile(importJob.filePath);
        return;
      }

      // Total known rows for progress calculation
      const totalKnownRows = knownCities.reduce(
        (sum, c) => sum + (byCityMap.get(c)?.length ?? 0), 0,
      );

      // Counters
      let citiesInserted = 0, citiesUpdated = 0;
      let locInserted = 0, locUpdated = 0, locUnchanged = 0;
      let processedRows = 0;

      // Process each city
      for (const cityName of knownCities) {
        // Check for cancellation
        const current = await this.jobRepo.findOne({
          where: { id: jobId },
          select: ['status'],
        });
        if (current?.status === 'cancelled') {
          log(`Job cancelled by user — stopping.`);
          await flushLog();
          return;
        }

        const info = cityStateMap[cityName];
        const localities = byCityMap.get(cityName)!;

        log(`\n── City: ${cityName} (${info.state}) — ${localities.length} localities ──`);

        const stateEntity = await this.stateRepo.findOne({ where: { code: info.stateCode } });
        if (!stateEntity) {
          log(`⚠️  State "${info.state}" (${info.stateCode}) not found in DB — skipping ${cityName}`);
          log(`   Run seed:states first to create the state record.`);
          processedRows += localities.length;
          await flushLog();
          continue;
        }

        // Upsert city
        let cityEntity = await this.cityRepo.findOne({
          where: { name: cityName, stateId: stateEntity.id },
        });
        const slug = info.slug ?? cityName.toLowerCase().replace(/\s+/g, '-');

        if (!cityEntity) {
          cityEntity = await this.cityRepo.save(
            this.cityRepo.create({
              name: cityName,
              stateId: stateEntity.id,
              isActive: true,
              isFeatured: info.isFeatured ?? false,
              slug,
              imageUrl: info.imageUrl,
              h1: `Property in ${cityName}`,
              metaTitle: `Buy & Rent Property in ${cityName} - Think4BuySale`,
              metaDescription: `Find properties for sale and rent in ${cityName}. Browse all localities.`,
              metaKeywords: `buy property ${cityName.toLowerCase()}, rent flat ${cityName.toLowerCase()}, ${cityName.toLowerCase()} real estate`,
            }),
          );
          citiesInserted++;
          log(`✅ City created: ${cityName}`);
        } else {
          let dirty = false;
          if (!cityEntity.slug && slug) { cityEntity.slug = slug; dirty = true; }
          if (!cityEntity.imageUrl && info.imageUrl) { cityEntity.imageUrl = info.imageUrl; dirty = true; }
          if (!cityEntity.metaTitle) {
            cityEntity.metaTitle = `Buy & Rent Property in ${cityName} - Think4BuySale`;
            dirty = true;
          }
          if (dirty) { await this.cityRepo.save(cityEntity); citiesUpdated++; }
          log(`♻️  City exists: ${cityName}${dirty ? ' (meta filled)' : ''}`);
        }

        // Geocode city once as fallback coords
        let cityGeo = { pincode: null as string | null, latitude: null as number | null, longitude: null as number | null };
        if (geocode) {
          log(`🌍 Geocoding city "${cityName}" for fallback coords…`);
          cityGeo = await this.geocodeCity(cityName, log);
        }

        const resolvedPool: ResolvedPoint[] = [];
        let ins = 0, upd = 0, unch = 0;

        for (let i = 0; i < localities.length; i++) {
          const locality = localities[i];
          const existing = await this.locationRepo.findOne({
            where: { city: cityName, locality },
          });

          if (!existing) {
            let geo: GeoResult = { pincode: null, latitude: null, longitude: null, source: 'none' };
            if (geocode) {
              geo = await this.geocodeWithFallback(locality, cityName, cityGeo, resolvedPool, log);
              log(`   [${i + 1}/${localities.length}] INSERT "${locality}" → ${srcIcon(geo.source)} ${geo.source} pin=${geo.pincode ?? '—'}`);
            }

            await this.locationRepo.save(
              this.locationRepo.create({
                city: cityName,
                state: info.state,
                locality,
                pincode: geo.pincode,
                latitude: geo.latitude,
                longitude: geo.longitude,
                isActive: true,
                propertyCount: 0,
              }),
            );

            if (geo.pincode && geo.latitude && geo.longitude) {
              resolvedPool.push({ locality, pincode: geo.pincode, latitude: geo.latitude, longitude: geo.longitude });
            }
            ins++; locInserted++;

          } else {
            const needsGeo = geocode && (forceGeocode || !existing.pincode || !existing.latitude);

            if (needsGeo) {
              const geo = await this.geocodeWithFallback(locality, cityName, cityGeo, resolvedPool, log);
              log(`   [${i + 1}/${localities.length}] UPDATE "${locality}" → ${srcIcon(geo.source)} ${geo.source} pin=${geo.pincode ?? '—'}`);

              existing.pincode = geo.pincode ?? existing.pincode;
              existing.latitude = geo.latitude ?? existing.latitude;
              existing.longitude = geo.longitude ?? existing.longitude;
              existing.state = info.state;
              await this.locationRepo.save(existing);

              if (geo.pincode && geo.latitude && geo.longitude) {
                resolvedPool.push({ locality, pincode: geo.pincode, latitude: geo.latitude, longitude: geo.longitude });
              }
              upd++; locUpdated++;
            } else {
              if (existing.pincode && existing.latitude && existing.longitude) {
                resolvedPool.push({
                  locality,
                  pincode: existing.pincode,
                  latitude: Number(existing.latitude),
                  longitude: Number(existing.longitude),
                });
              }
              if (existing.state !== info.state) {
                existing.state = info.state;
                await this.locationRepo.save(existing);
                upd++; locUpdated++;
              } else {
                unch++; locUnchanged++;
              }
            }
          }

          processedRows++;
          const progress = totalKnownRows > 0
            ? Math.min(99, Math.round((processedRows / totalKnownRows) * 100))
            : 0;

          // Flush log + update stats every 25 rows or at city end
          if ((i + 1) % 25 === 0 || i === localities.length - 1) {
            await flushLog();
            await this.jobRepo.update(jobId, {
              progress,
              processedRows,
              citiesInserted,
              citiesUpdated,
              localitiesInserted: locInserted,
              localitiesUpdated: locUpdated,
              localitiesUnchanged: locUnchanged,
            });
          }
        }

        log(`  Summary: inserted=${ins}, updated=${upd}, unchanged=${unch}`);
        await flushLog();
      }

      // Finalise
      log(`\n──────────────────────────────────────────────────────`);
      log(`✅ Import complete!`);
      log(`   Cities    → inserted: ${citiesInserted}, updated: ${citiesUpdated}`);
      log(`   Locations → inserted: ${locInserted}, updated: ${locUpdated}, unchanged: ${locUnchanged}`);
      if (!geocode) {
        log(`   ℹ️  Geocoding was disabled. Run again with geocode=true to populate coordinates.`);
      }
      await flushLog();

      await this.jobRepo.update(jobId, {
        status: 'completed',
        progress: 100,
        processedRows,
        citiesInserted,
        citiesUpdated,
        localitiesInserted: locInserted,
        localitiesUpdated: locUpdated,
        localitiesUnchanged: locUnchanged,
        completedAt: new Date(),
      });

      this.cleanupFile(importJob.filePath);

    } catch (err: any) {
      this.logger.error(`Import job ${jobId} failed: ${err.message}`, err.stack);
      logBuf.push(`[${ts()}] ❌ FATAL ERROR: ${err.message}`);
      await flushLog();
      await this.jobRepo.update(jobId, {
        status: 'failed',
        errorMessage: err.message,
        completedAt: new Date(),
      });
    }
  }

  // ── XLSX parsing ─────────────────────────────────────────────────────────────

  private readTabBasedXlsx(wb: XLSX.WorkBook, log: (m: string) => void): LocalityRow[] {
    const rows: LocalityRow[] = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
      if (!data.length) { log(`  ⚠️  Sheet "${sheetName}" is empty — skipping`); continue; }

      const sample = data[0] ?? {};
      const localCol = Object.keys(sample).find((k) =>
        /^(locality|location|locations|location\s*name|locat?ion)$/i.test(k.trim()),
      );
      if (!localCol) {
        log(`  ⚠️  Sheet "${sheetName}" — no locality column found (cols: ${Object.keys(sample).join(', ')}) — skipping`);
        continue;
      }

      const cityCol = Object.keys(sample).find((k) => k.toLowerCase().trim() === 'city');
      let cityName = sheetName.trim();
      if (cityCol) {
        for (const row of data) {
          const val = String(row[cityCol] ?? '').trim();
          if (val) { cityName = val; break; }
        }
      }

      let count = 0;
      for (const row of data) {
        const locality = String(row[localCol] ?? '').trim();
        if (!locality || SKIP_LOCALITY_HEADERS.has(locality.toLowerCase())) continue;
        rows.push({ city: cityName, locality });
        count++;
      }
      log(`  ✅ Sheet "${sheetName}" → city "${cityName}" → ${count} localities`);
    }
    return rows;
  }

  private readSingleSheetXlsx(wb: XLSX.WorkBook, log: (m: string) => void): LocalityRow[] {
    const rows: LocalityRow[] = [];
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

    const sample = data[0] ?? {};
    const cityCol = Object.keys(sample).find((k) => k.toLowerCase().trim() === 'city');
    const localCol = Object.keys(sample).find((k) => k.toLowerCase().trim() === 'locality');

    if (!cityCol || !localCol) {
      log(`  ⚠️  Single-sheet missing "City" or "Locality" columns (found: ${Object.keys(sample).join(', ')})`);
      return rows;
    }

    let count = 0;
    for (const row of data) {
      const city = String(row[cityCol] ?? '').trim();
      const locality = String(row[localCol] ?? '').trim();
      if (city && locality && !SKIP_LOCALITY_HEADERS.has(locality.toLowerCase())) {
        rows.push({ city, locality });
        count++;
      }
    }
    log(`  ✅ Single-sheet: ${count} rows (City="${cityCol}", Locality="${localCol}")`);
    return rows;
  }

  // ── City→State map ────────────────────────────────────────────────────────────

  private buildCityStateMap(): Record<string, CityConfigEntry> {
    const base: Record<string, CityConfigEntry> = {};
    for (const [city, info] of Object.entries(BUILTIN_CITY_STATE)) {
      base[city] = {
        ...info,
        ...(BUILTIN_CITY_META[city] ?? { slug: city.toLowerCase().replace(/\s+/g, '-') }),
      };
    }
    return base;
  }

  // ── Geocoding ─────────────────────────────────────────────────────────────────

  private async geocodeCity(
    cityName: string,
    log: (m: string) => void,
  ): Promise<{ pincode: string | null; latitude: number | null; longitude: number | null }> {
    const hit = await nominatim(`${cityName}, India`);
    await sleep(1100);
    if (hit) {
      log(`   City geo: lat=${hit.lat.toFixed(4)}, lon=${hit.lon.toFixed(4)}, pin=${hit.pincode ?? '—'}`);
      return { pincode: hit.pincode, latitude: hit.lat, longitude: hit.lon };
    }
    log(`   City geo: not found`);
    return { pincode: null, latitude: null, longitude: null };
  }

  private async geocodeWithFallback(
    locality: string,
    city: string,
    cityGeo: { pincode: string | null; latitude: number | null; longitude: number | null },
    pool: ResolvedPoint[],
    log: (m: string) => void,
  ): Promise<GeoResult> {
    const hit = await nominatim(`${locality}, ${city}, India`);
    await sleep(1100);

    if (hit) {
      if (hit.pincode) {
        return { pincode: hit.pincode, latitude: hit.lat, longitude: hit.lon, source: 'locality' };
      }
      const near = nearestPoint(hit.lat, hit.lon, pool);
      if (near) {
        return { pincode: near.pincode, latitude: hit.lat, longitude: hit.lon, source: 'nearby' };
      }
      if (cityGeo.pincode) {
        return { pincode: cityGeo.pincode, latitude: hit.lat, longitude: hit.lon, source: 'city' };
      }
    }

    if (cityGeo.pincode) {
      return { pincode: cityGeo.pincode, latitude: cityGeo.latitude, longitude: cityGeo.longitude, source: 'city' };
    }

    if (pool.length > 0) {
      const pt = pool[pool.length - 1];
      return { pincode: pt.pincode, latitude: pt.latitude, longitude: pt.longitude, source: 'nearby' };
    }

    return { pincode: null, latitude: null, longitude: null, source: 'none' };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  private cleanupFile(filePath: string): void {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`Temp file deleted: ${filePath}`);
      }
    } catch (err: any) {
      this.logger.warn(`Could not delete temp file ${filePath}: ${err.message}`);
    }
  }
}

function srcIcon(s: GeoResult['source']): string {
  return { locality: '✅', city: '🏙️', nearby: '📍', none: '❌' }[s] ?? '?';
}

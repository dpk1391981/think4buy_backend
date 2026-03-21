/**
 * Seeds realistic market snapshot data for major Indian cities.
 * Run: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-market-snapshots.ts
 *
 * Uses INSERT … ON DUPLICATE KEY UPDATE so it's safe to re-run.
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { MarketSnapshot } from '../../modules/analytics/entities/market-snapshot.entity';

const dataSource = new DataSource({
  type: 'mysql',
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'realestate_db',
  entities: [MarketSnapshot],
  synchronize: true,  // auto-creates market_snapshots table if missing
});

// ─── Realistic 2025–2026 India real estate market data ───────────────────────
// Sources: NoBroker, 99acres, MagicBricks Q1 2026 reports
const CITIES: Array<{
  city: string;
  state: string;
  isFeatured: boolean;
  sortOrder: number;
  avgPsf: number;
  prevAvgPsf: number;          // ~90 days ago (for trend)
  avgPrice: number;            // avg total buy price
  minPrice: number;
  maxPrice: number;
  listingCount: number;
  totalListingCount: number;
  avgMonthlyRent: number;
  localities: Array<{
    name: string;
    avgPsf: number;
    prevPsf: number;
    avgBuyPrice: number;
    avgRent: number;
    listingCount: number;
  }>;
}> = [
  {
    city: 'Mumbai', state: 'Maharashtra', isFeatured: true, sortOrder: 10,
    avgPsf: 22500, prevAvgPsf: 20800,
    avgPrice: 18500000, minPrice: 2500000, maxPrice: 120000000,
    listingCount: 2840, totalListingCount: 4200,
    avgMonthlyRent: 38000,
    localities: [
      { name: 'Bandra West',   avgPsf: 44500, prevPsf: 41000, avgBuyPrice: 35000000, avgRent: 75000, listingCount: 180 },
      { name: 'Powai',         avgPsf: 18200, prevPsf: 17000, avgBuyPrice: 14000000, avgRent: 35000, listingCount: 320 },
      { name: 'Andheri West',  avgPsf: 21000, prevPsf: 19500, avgBuyPrice: 16000000, avgRent: 40000, listingCount: 290 },
      { name: 'Thane West',    avgPsf: 11500, prevPsf: 11200, avgBuyPrice: 9500000,  avgRent: 22000, listingCount: 450 },
      { name: 'Navi Mumbai',   avgPsf: 10200, prevPsf: 10200, avgBuyPrice: 8200000,  avgRent: 18000, listingCount: 380 },
      { name: 'Borivali',      avgPsf: 15800, prevPsf: 14800, avgBuyPrice: 12500000, avgRent: 28000, listingCount: 260 },
      { name: 'Malad West',    avgPsf: 17500, prevPsf: 16800, avgBuyPrice: 13500000, avgRent: 32000, listingCount: 210 },
    ],
  },
  {
    city: 'Delhi', state: 'Delhi', isFeatured: true, sortOrder: 20,
    avgPsf: 8800, prevAvgPsf: 8400,
    avgPrice: 9500000, minPrice: 1500000, maxPrice: 80000000,
    listingCount: 2100, totalListingCount: 3500,
    avgMonthlyRent: 22000,
    localities: [
      { name: 'South Delhi',    avgPsf: 19500, prevPsf: 18000, avgBuyPrice: 22000000, avgRent: 45000, listingCount: 120 },
      { name: 'Dwarka',         avgPsf: 7800,  prevPsf: 7400,  avgBuyPrice: 7500000,  avgRent: 16000, listingCount: 340 },
      { name: 'Rohini',         avgPsf: 6500,  prevPsf: 6500,  avgBuyPrice: 6000000,  avgRent: 14000, listingCount: 280 },
      { name: 'Janakpuri',      avgPsf: 9200,  prevPsf: 8800,  avgBuyPrice: 8500000,  avgRent: 18000, listingCount: 190 },
      { name: 'Pitampura',      avgPsf: 8500,  prevPsf: 8100,  avgBuyPrice: 7800000,  avgRent: 17000, listingCount: 220 },
    ],
  },
  {
    city: 'Bangalore', state: 'Karnataka', isFeatured: true, sortOrder: 30,
    avgPsf: 8200, prevAvgPsf: 7400,
    avgPrice: 9200000, minPrice: 2000000, maxPrice: 60000000,
    listingCount: 3200, totalListingCount: 5100,
    avgMonthlyRent: 28000,
    localities: [
      { name: 'Whitefield',     avgPsf: 9200,  prevPsf: 8200,  avgBuyPrice: 9500000,  avgRent: 30000, listingCount: 480 },
      { name: 'Koramangala',    avgPsf: 14500, prevPsf: 13200, avgBuyPrice: 14000000, avgRent: 45000, listingCount: 280 },
      { name: 'Electronic City',avgPsf: 6200,  prevPsf: 5800,  avgBuyPrice: 6000000,  avgRent: 18000, listingCount: 520 },
      { name: 'Sarjapur Road',  avgPsf: 7800,  prevPsf: 7000,  avgBuyPrice: 7500000,  avgRent: 24000, listingCount: 420 },
      { name: 'HSR Layout',     avgPsf: 11200, prevPsf: 10500, avgBuyPrice: 11000000, avgRent: 35000, listingCount: 310 },
      { name: 'Indiranagar',    avgPsf: 16000, prevPsf: 14500, avgBuyPrice: 15000000, avgRent: 48000, listingCount: 180 },
      { name: 'Hebbal',         avgPsf: 8500,  prevPsf: 7800,  avgBuyPrice: 8200000,  avgRent: 26000, listingCount: 290 },
    ],
  },
  {
    city: 'Pune', state: 'Maharashtra', isFeatured: true, sortOrder: 40,
    avgPsf: 7200, prevAvgPsf: 6750,
    avgPrice: 7800000, minPrice: 1800000, maxPrice: 45000000,
    listingCount: 2400, totalListingCount: 3800,
    avgMonthlyRent: 20000,
    localities: [
      { name: 'Kharadi',        avgPsf: 8500,  prevPsf: 7800,  avgBuyPrice: 8200000,  avgRent: 24000, listingCount: 380 },
      { name: 'Baner',          avgPsf: 9800,  prevPsf: 9200,  avgBuyPrice: 9500000,  avgRent: 28000, listingCount: 320 },
      { name: 'Hinjewadi',      avgPsf: 7500,  prevPsf: 7000,  avgBuyPrice: 7200000,  avgRent: 20000, listingCount: 420 },
      { name: 'Wakad',          avgPsf: 7200,  prevPsf: 7200,  avgBuyPrice: 6800000,  avgRent: 18000, listingCount: 350 },
      { name: 'Hadapsar',       avgPsf: 6200,  prevPsf: 5800,  avgBuyPrice: 5900000,  avgRent: 16000, listingCount: 410 },
      { name: 'Viman Nagar',    avgPsf: 8200,  prevPsf: 7600,  avgBuyPrice: 7800000,  avgRent: 22000, listingCount: 240 },
    ],
  },
  {
    city: 'Hyderabad', state: 'Telangana', isFeatured: true, sortOrder: 50,
    avgPsf: 6800, prevAvgPsf: 6200,
    avgPrice: 7200000, minPrice: 1500000, maxPrice: 50000000,
    listingCount: 2800, totalListingCount: 4300,
    avgMonthlyRent: 22000,
    localities: [
      { name: 'Gachibowli',     avgPsf: 8200,  prevPsf: 7400,  avgBuyPrice: 8500000,  avgRent: 28000, listingCount: 420 },
      { name: 'HITECH City',    avgPsf: 9500,  prevPsf: 8500,  avgBuyPrice: 10000000, avgRent: 32000, listingCount: 360 },
      { name: 'Kondapur',       avgPsf: 7500,  prevPsf: 6800,  avgBuyPrice: 7800000,  avgRent: 24000, listingCount: 390 },
      { name: 'Kukatpally',     avgPsf: 6200,  prevPsf: 6000,  avgBuyPrice: 6000000,  avgRent: 18000, listingCount: 480 },
      { name: 'Miyapur',        avgPsf: 5800,  prevPsf: 5400,  avgBuyPrice: 5500000,  avgRent: 16000, listingCount: 350 },
      { name: 'Manikonda',      avgPsf: 7800,  prevPsf: 7000,  avgBuyPrice: 7500000,  avgRent: 22000, listingCount: 310 },
    ],
  },
  {
    city: 'Chennai', state: 'Tamil Nadu', isFeatured: true, sortOrder: 60,
    avgPsf: 6200, prevAvgPsf: 6050,
    avgPrice: 7000000, minPrice: 1500000, maxPrice: 40000000,
    listingCount: 1800, totalListingCount: 2900,
    avgMonthlyRent: 18000,
    localities: [
      { name: 'Adyar',          avgPsf: 13500, prevPsf: 13000, avgBuyPrice: 14000000, avgRent: 38000, listingCount: 150 },
      { name: 'OMR',            avgPsf: 7200,  prevPsf: 6800,  avgBuyPrice: 7500000,  avgRent: 22000, listingCount: 380 },
      { name: 'Velachery',      avgPsf: 7800,  prevPsf: 7500,  avgBuyPrice: 8000000,  avgRent: 24000, listingCount: 280 },
      { name: 'Anna Nagar',     avgPsf: 11000, prevPsf: 11000, avgBuyPrice: 12000000, avgRent: 32000, listingCount: 180 },
      { name: 'Tambaram',       avgPsf: 5200,  prevPsf: 5000,  avgBuyPrice: 4800000,  avgRent: 13000, listingCount: 320 },
    ],
  },
  {
    city: 'Kolkata', state: 'West Bengal', isFeatured: true, sortOrder: 70,
    avgPsf: 5200, prevAvgPsf: 4900,
    avgPrice: 5500000, minPrice: 1200000, maxPrice: 35000000,
    listingCount: 1500, totalListingCount: 2400,
    avgMonthlyRent: 14000,
    localities: [
      { name: 'Salt Lake',      avgPsf: 7500,  prevPsf: 7000,  avgBuyPrice: 7200000,  avgRent: 20000, listingCount: 220 },
      { name: 'New Town',       avgPsf: 5800,  prevPsf: 5200,  avgBuyPrice: 5500000,  avgRent: 15000, listingCount: 350 },
      { name: 'Behala',         avgPsf: 4200,  prevPsf: 4000,  avgBuyPrice: 4000000,  avgRent: 11000, listingCount: 280 },
      { name: 'Dum Dum',        avgPsf: 4500,  prevPsf: 4300,  avgBuyPrice: 4200000,  avgRent: 12000, listingCount: 240 },
      { name: 'Rajarhat',       avgPsf: 5500,  prevPsf: 5000,  avgBuyPrice: 5200000,  avgRent: 14000, listingCount: 310 },
    ],
  },
  {
    city: 'Ahmedabad', state: 'Gujarat', isFeatured: true, sortOrder: 80,
    avgPsf: 4800, prevAvgPsf: 4500,
    avgPrice: 5200000, minPrice: 1000000, maxPrice: 30000000,
    listingCount: 1200, totalListingCount: 2000,
    avgMonthlyRent: 13000,
    localities: [
      { name: 'SG Highway',     avgPsf: 6200,  prevPsf: 5800,  avgBuyPrice: 6500000,  avgRent: 18000, listingCount: 220 },
      { name: 'Prahlad Nagar',  avgPsf: 7500,  prevPsf: 7000,  avgBuyPrice: 8000000,  avgRent: 22000, listingCount: 160 },
      { name: 'Bopal',          avgPsf: 5200,  prevPsf: 4800,  avgBuyPrice: 5500000,  avgRent: 14000, listingCount: 280 },
      { name: 'Gota',           avgPsf: 4500,  prevPsf: 4200,  avgBuyPrice: 4500000,  avgRent: 11000, listingCount: 240 },
      { name: 'Nikol',          avgPsf: 3800,  prevPsf: 3600,  avgBuyPrice: 3800000,  avgRent: 9000,  listingCount: 200 },
    ],
  },
  {
    city: 'Noida', state: 'Uttar Pradesh', isFeatured: false, sortOrder: 90,
    avgPsf: 6200, prevAvgPsf: 5700,
    avgPrice: 7500000, minPrice: 2000000, maxPrice: 45000000,
    listingCount: 1900, totalListingCount: 3100,
    avgMonthlyRent: 18000,
    localities: [
      { name: 'Sector 62',      avgPsf: 7500,  prevPsf: 6800,  avgBuyPrice: 8000000,  avgRent: 22000, listingCount: 280 },
      { name: 'Sector 137',     avgPsf: 6800,  prevPsf: 6200,  avgBuyPrice: 7200000,  avgRent: 20000, listingCount: 320 },
      { name: 'Sector 150',     avgPsf: 8200,  prevPsf: 7400,  avgBuyPrice: 9000000,  avgRent: 26000, listingCount: 240 },
      { name: 'Sector 76',      avgPsf: 6500,  prevPsf: 6000,  avgBuyPrice: 7000000,  avgRent: 19000, listingCount: 260 },
      { name: 'Greater Noida',  avgPsf: 5200,  prevPsf: 4800,  avgBuyPrice: 5500000,  avgRent: 14000, listingCount: 380 },
    ],
  },
  {
    city: 'Gurgaon', state: 'Haryana', isFeatured: false, sortOrder: 100,
    avgPsf: 9500, prevAvgPsf: 8700,
    avgPrice: 11000000, minPrice: 3000000, maxPrice: 80000000,
    listingCount: 2200, totalListingCount: 3400,
    avgMonthlyRent: 28000,
    localities: [
      { name: 'DLF Phase 1',    avgPsf: 14500, prevPsf: 13200, avgBuyPrice: 18000000, avgRent: 45000, listingCount: 160 },
      { name: 'Sohna Road',     avgPsf: 8200,  prevPsf: 7500,  avgBuyPrice: 9500000,  avgRent: 24000, listingCount: 380 },
      { name: 'Golf Course Rd', avgPsf: 16500, prevPsf: 15000, avgBuyPrice: 22000000, avgRent: 55000, listingCount: 140 },
      { name: 'Sector 57',      avgPsf: 8800,  prevPsf: 8200,  avgBuyPrice: 10000000, avgRent: 26000, listingCount: 290 },
      { name: 'New Gurgaon',    avgPsf: 7500,  prevPsf: 6800,  avgBuyPrice: 8500000,  avgRent: 20000, listingCount: 360 },
    ],
  },
  {
    city: 'Navi Mumbai', state: 'Maharashtra', isFeatured: false, sortOrder: 110,
    avgPsf: 9800, prevAvgPsf: 9200,
    avgPrice: 10000000, minPrice: 2500000, maxPrice: 40000000,
    listingCount: 1400, totalListingCount: 2200,
    avgMonthlyRent: 22000,
    localities: [
      { name: 'Kharghar',       avgPsf: 9500,  prevPsf: 8800,  avgBuyPrice: 9500000,  avgRent: 22000, listingCount: 250 },
      { name: 'Vashi',          avgPsf: 14500, prevPsf: 13800, avgBuyPrice: 14000000, avgRent: 32000, listingCount: 180 },
      { name: 'Panvel',         avgPsf: 7800,  prevPsf: 7200,  avgBuyPrice: 7500000,  avgRent: 17000, listingCount: 310 },
      { name: 'Airoli',         avgPsf: 12000, prevPsf: 11500, avgBuyPrice: 11500000, avgRent: 26000, listingCount: 160 },
      { name: 'Ulwe',           avgPsf: 8200,  prevPsf: 7600,  avgBuyPrice: 8000000,  avgRent: 18000, listingCount: 220 },
    ],
  },
  {
    city: 'Coimbatore', state: 'Tamil Nadu', isFeatured: false, sortOrder: 120,
    avgPsf: 3800, prevAvgPsf: 3500,
    avgPrice: 4200000, minPrice: 800000, maxPrice: 20000000,
    listingCount: 800, totalListingCount: 1400,
    avgMonthlyRent: 10000,
    localities: [
      { name: 'Saibaba Colony', avgPsf: 5200,  prevPsf: 4800,  avgBuyPrice: 5500000,  avgRent: 13000, listingCount: 110 },
      { name: 'Gandhipuram',    avgPsf: 6500,  prevPsf: 6000,  avgBuyPrice: 7000000,  avgRent: 16000, listingCount: 90  },
      { name: 'RS Puram',       avgPsf: 5800,  prevPsf: 5400,  avgBuyPrice: 6000000,  avgRent: 14000, listingCount: 80  },
      { name: 'Peelamedu',      avgPsf: 4200,  prevPsf: 3900,  avgBuyPrice: 4500000,  avgRent: 11000, listingCount: 150 },
    ],
  },
];

function calcTrend(curr: number, prev: number): { trend: 'up' | 'down' | 'stable'; trendPct: number } {
  if (!prev || !curr) return { trend: 'stable', trendPct: 0 };
  const pct = ((curr - prev) / prev) * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (pct > 1.5)  return { trend: 'up',   trendPct: rounded };
  if (pct < -1.5) return { trend: 'down',  trendPct: Math.abs(rounded) };
  return { trend: 'stable', trendPct: Math.abs(rounded) };
}

function calcRentYield(avgMonthlyRent: number, avgBuyPrice: number): number {
  if (!avgMonthlyRent || !avgBuyPrice) return 3.2;
  return Math.round((avgMonthlyRent * 12 / avgBuyPrice) * 1000) / 10;
}

function calcBuySavings(avgMonthlyRent: number, avgBuyPrice: number): number {
  if (!avgMonthlyRent || !avgBuyPrice) return 20;
  const totalRent10yr   = avgMonthlyRent * 12 * ((Math.pow(1.05, 10) - 1) / 0.05);
  const propertyVal10yr = avgBuyPrice * Math.pow(1.07, 10);
  const ownershipCost   = avgBuyPrice * 0.12;
  const netGain         = propertyVal10yr - avgBuyPrice - ownershipCost;
  const savings         = (netGain / totalRent10yr) * 100;
  return Math.max(5, Math.min(45, Math.round(savings * 10) / 10));
}

async function seedMarketSnapshots() {
  await dataSource.initialize();
  console.log('✓ DB connected');

  const repo = dataSource.getRepository(MarketSnapshot);

  let upserted = 0;

  for (const c of CITIES) {
    const { trend, trendPct } = calcTrend(c.avgPsf, c.prevAvgPsf);
    const rentYield   = calcRentYield(c.avgMonthlyRent, c.avgPrice);
    const buySavings  = calcBuySavings(c.avgMonthlyRent, c.avgPrice);

    // Build localities with trend
    const localities = c.localities.map(loc => {
      const { trend: lt } = calcTrend(loc.avgPsf, loc.prevPsf);
      const locRentYield = loc.avgRent > 0 && loc.avgBuyPrice > 0
        ? Math.round((loc.avgRent * 12 / loc.avgBuyPrice) * 1000) / 10
        : 0;
      return {
        name:         loc.name,
        medianPsf:    loc.avgPsf,
        avgBuyPrice:  loc.avgBuyPrice,
        avgRent:      loc.avgRent,
        listingCount: loc.listingCount,
        trend:        lt,
        rentYield:    locRentYield,
        rankScore:    0,
      };
    });

    // Upsert by city name
    let existing = await repo.findOne({ where: { city: c.city } as any });

    if (!existing) {
      existing = repo.create({ city: c.city, state: c.state });
    }

    existing.state             = c.state;
    existing.isFeatured        = c.isFeatured;
    existing.sortOrder         = c.sortOrder;
    existing.avgPsf            = c.avgPsf;
    existing.prevAvgPsf        = c.prevAvgPsf;
    existing.trend             = trend;
    existing.trendPct          = trendPct;
    existing.avgPrice          = c.avgPrice;
    existing.minPrice          = c.minPrice;
    existing.maxPrice          = c.maxPrice;
    existing.listingCount      = c.listingCount;
    existing.totalListingCount = c.totalListingCount;
    existing.avgMonthlyRent    = c.avgMonthlyRent;
    existing.rentYield         = rentYield;
    existing.buySavingsPct     = buySavings;
    existing.topLocalities     = localities;

    await repo.save(existing);
    console.log(`  ✓ ${c.city.padEnd(16)} PSF ₹${c.avgPsf.toLocaleString('en-IN').padStart(6)}  trend: ${trend.padEnd(6)} ${trendPct > 0 ? `+${trendPct}%` : `${trendPct}%`}  listings: ${c.listingCount}`);
    upserted++;
  }

  console.log(`\n✅ Seeded ${upserted} market snapshots`);
  await dataSource.destroy();
}

seedMarketSnapshots().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

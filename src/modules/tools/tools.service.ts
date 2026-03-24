import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketSnapshot } from '../analytics/entities/market-snapshot.entity';
import { Property } from '../properties/entities/property.entity';
import { SearchLog } from '../smart-search/entities/search-log.entity';

// Conversion factors to sq.ft
const AREA_TO_SQFT: Record<string, number> = {
  sqft:    1,
  sqm:     10.7639,
  sqyard:  9,
  acre:    43560,
  hectare: 107639,
  gaj:     9,
  marla:   272.25,
  kanal:   5445,
  bigha:   27000,
};

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(MarketSnapshot) private snapshotRepo: Repository<MarketSnapshot>,
    @InjectRepository(Property)       private propertyRepo: Repository<Property>,
    @InjectRepository(SearchLog)      private searchLogRepo: Repository<SearchLog>,
  ) {}

  // ── EMI Calculator ─────────────────────────────────────────────────────────
  calcEmi(principal: number, annualRate: number, tenureMonths: number) {
    const r = annualRate / 12 / 100;
    const n = tenureMonths;
    const emi = r === 0
      ? principal / n
      : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalAmount   = emi * n;
    const totalInterest = totalAmount - principal;

    // Build amortisation schedule (yearly summary)
    const schedule: { year: number; principal: number; interest: number; balance: number }[] = [];
    let balance = principal;
    for (let year = 1; year <= Math.ceil(n / 12); year++) {
      let yearInterest = 0;
      let yearPrincipal = 0;
      for (let m = 0; m < 12 && (year - 1) * 12 + m < n; m++) {
        const intPart = balance * r;
        const prinPart = emi - intPart;
        yearInterest  += intPart;
        yearPrincipal += prinPart;
        balance       -= prinPart;
      }
      schedule.push({
        year,
        principal: Math.round(yearPrincipal),
        interest:  Math.round(yearInterest),
        balance:   Math.max(0, Math.round(balance)),
      });
    }

    return {
      emi:           Math.round(emi),
      totalInterest: Math.round(totalInterest),
      totalAmount:   Math.round(totalAmount),
      schedule,
    };
  }

  // ── Property Price Breakdown ────────────────────────────────────────────────
  calcPriceBreakdown(areaSqft: number, pricePerSqft: number) {
    const basePrice       = areaSqft * pricePerSqft;
    const stampDutyPct    = 5;                                        // ~5% (varies by state)
    const regFeePct       = 2;                                        // ~2%
    const registration    = Math.round(basePrice * (stampDutyPct + regFeePct) / 100);
    const gstApplicable   = Math.round(basePrice * 0.05 * (2 / 3)); // effective ~3.33% on under-construction

    return {
      basePrice:         Math.round(basePrice),
      stampDuty:         Math.round(basePrice * stampDutyPct / 100),
      registrationFee:   Math.round(basePrice * regFeePct / 100),
      registration,
      registrationPct:   stampDutyPct + regFeePct,
      gstApplicable,
      totalWithReg:      Math.round(basePrice + registration),
      totalWithAll:      Math.round(basePrice + registration + gstApplicable),
      note:              'Registration % is indicative. Stamp duty varies by state/city.',
    };
  }

  // ── ROI Calculator ─────────────────────────────────────────────────────────
  calcRoi(propertyPrice: number, monthlyRent: number, appreciationPct: number, years: number[]) {
    const annualRent  = monthlyRent * 12;
    const rentalYield = annualRent / propertyPrice * 100;

    const returns = years.map(y => {
      const futureValue     = propertyPrice * Math.pow(1 + appreciationPct / 100, y);
      const totalRentIncome = annualRent * y;
      const totalReturn     = futureValue + totalRentIncome - propertyPrice;
      return {
        years:          y,
        futureValue:    Math.round(futureValue),
        totalRent:      Math.round(totalRentIncome),
        appreciation:   Math.round(futureValue - propertyPrice),
        totalReturn:    Math.round(totalReturn),
        totalReturnPct: Math.round(totalReturn / propertyPrice * 1000) / 10,
      };
    });

    return {
      rentalYield: Math.round(rentalYield * 100) / 100,
      grossYield:  Math.round(rentalYield * 100) / 100,
      returns,
    };
  }

  // ── Area Converter ─────────────────────────────────────────────────────────
  convertArea(value: number, from: string, to: string) {
    const sqftValue = value * (AREA_TO_SQFT[from] ?? 1);
    const result    = sqftValue / (AREA_TO_SQFT[to] ?? 1);

    // Return all conversions at once for convenience
    const all: Record<string, number> = {};
    for (const [unit, factor] of Object.entries(AREA_TO_SQFT)) {
      all[unit] = Math.round((sqftValue / factor) * 1000000) / 1000000;
    }

    return { value: result, from, to, allConversions: all };
  }

  // ── Price Prediction ────────────────────────────────────────────────────────
  async predictPrice(city: string, propertyType: string, bhk: number, areaSqft: number) {
    // Try exact match first, fall back to city-wide average
    let snapshot = await this.snapshotRepo.findOne({ where: { city, propertyType, listingType: 'sale' } })
      ?? await this.snapshotRepo.findOne({ where: { city, propertyType } })
      ?? await this.snapshotRepo.findOne({ where: { city, propertyType: null } })
      ?? await this.snapshotRepo.findOne({ where: { city } });

    if (!snapshot || !snapshot.avgPsf) {
      return { hasData: false, error: 'Insufficient listing data for this location/type.' };
    }

    const avgPsf = Number(snapshot.avgPsf);

    // BHK size multiplier (larger BHK units often price slightly higher per sqft due to location premium)
    const bhkMultipliers: Record<number, number> = { 1: 0.92, 2: 1.0, 3: 1.05, 4: 1.08, 5: 1.12 };
    const bhkMult     = bhkMultipliers[bhk] ?? 1.0;
    const estimatedPsf  = avgPsf * bhkMult;
    const estimatedPrice = estimatedPsf * areaSqft;

    return {
      hasData:        true,
      estimatedPrice: Math.round(estimatedPrice),
      minPrice:       Math.round(estimatedPrice * 0.85),
      maxPrice:       Math.round(estimatedPrice * 1.15),
      psfUsed:        Math.round(estimatedPsf),
      avgPsfCity:     Math.round(avgPsf),
      confidence:     snapshot.dataQuality ?? 'low',
      confidenceScore: snapshot.confidenceScore ?? 0,
      trend:          snapshot.trend,
      trendPct:       snapshot.trendPct,
      listingCount:   snapshot.listingCount,
      dataSource:     'Indicative — based on active listing data',
    };
  }

  // ── Price Trends ────────────────────────────────────────────────────────────
  async getPriceTrends(city: string, propertyType?: string, listingType?: string) {
    let snapshot = await this.snapshotRepo.findOne({
      where: {
        city,
        ...(propertyType ? { propertyType } : { propertyType: null }),
        ...(listingType  ? { listingType }  : { listingType: null }),
      },
    }) ?? await this.snapshotRepo.findOne({ where: { city } });

    if (!snapshot) return { hasData: false, data: [], city };

    return {
      hasData:         true,
      city,
      avgPsf:          snapshot.avgPsf,
      medianPsf:       snapshot.medianPsf,
      prevAvgPsf:      snapshot.prevAvgPsf,
      trend:           snapshot.trend,
      trendPct:        snapshot.trendPct,
      avgPrice:        snapshot.avgPrice,
      minPrice:        snapshot.minPrice,
      maxPrice:        snapshot.maxPrice,
      avgMonthlyRent:  snapshot.avgMonthlyRent,
      rentYield:       snapshot.rentYield,
      listingCount:    snapshot.listingCount,
      monthlyTrend:    snapshot.priceTrend ?? [],
      topLocalities:   (snapshot.topLocalities ?? []).slice(0, 10),
      byType:          snapshot.byType ?? {},
      smartInsights:   snapshot.smartInsights ?? [],
      dataQuality:     snapshot.dataQuality,
      confidenceScore: snapshot.confidenceScore,
      updatedAt:       snapshot.updatedAt,
    };
  }

  // ── Demand Insights ──────────────────────────────────────────────────────────
  async getDemandInsights(city?: string) {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [topSearches, popularBhk, topCities] = await Promise.all([
      // Top searched terms last 30 days
      this.searchLogRepo
        .createQueryBuilder('sl')
        .select('sl.searchQuery', 'query')
        .addSelect('COUNT(*)', 'count')
        .where('sl.createdAt > :since', { since: since30d })
        .andWhere('LENGTH(sl.searchQuery) > 3')
        .groupBy('sl.searchQuery')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),

      // Most common BHK in published listings
      this.propertyRepo
        .createQueryBuilder('p')
        .select('p.bhk', 'bhk')
        .addSelect('COUNT(*)', 'count')
        .where('p.status = :status', { status: 'published' })
        .andWhere('p.bhk IS NOT NULL')
        .andWhere(city ? 'p.city = :city' : '1=1', city ? { city } : {})
        .groupBy('p.bhk')
        .orderBy('count', 'DESC')
        .limit(6)
        .getRawMany(),

      // Top cities by listing count from market snapshots
      this.snapshotRepo
        .createQueryBuilder('ms')
        .select('ms.city', 'city')
        .addSelect('SUM(ms.listingCount)', 'listingCount')
        .addSelect('AVG(CAST(ms.avgPsf AS DECIMAL))', 'avgPsf')
        .addSelect('AVG(CAST(ms.trendPct AS DECIMAL))', 'trendPct')
        .where('ms.city IS NOT NULL')
        .groupBy('ms.city')
        .orderBy('listingCount', 'DESC')
        .limit(8)
        .getRawMany(),
    ]);

    return {
      topSearches: topSearches.slice(0, 8),
      popularBhk,
      topCities,
    };
  }

  // ── Market Insight Cards ─────────────────────────────────────────────────────
  async getMarketCards(city?: string, state?: string) {
    const qb = this.snapshotRepo
      .createQueryBuilder('ms')
      .where('ms.listingCount > 3');

    if (city)        qb.andWhere('ms.city = :city', { city });
    else if (state)  qb.andWhere('ms.state = :state', { state });

    const snapshots = await qb.orderBy('ms.updatedAt', 'DESC').take(15).getMany();

    const cards: {
      city: string; state: string; insight: string;
      trend: string; trendPct: number; avgPsf: number; tag: string;
    }[] = [];

    for (const snap of snapshots) {
      if (snap.smartInsights?.length) {
        for (const insight of snap.smartInsights) {
          cards.push({
            city: snap.city, state: snap.state,
            insight, trend: snap.trend,
            trendPct: Number(snap.trendPct),
            avgPsf: Number(snap.avgPsf),
            tag: 'Market Insight',
          });
        }
      }
    }

    // Computed cards from top-trend cities
    const topTrend = await this.snapshotRepo
      .createQueryBuilder('ms')
      .where('ms.trendPct > 3')
      .andWhere('ms.trend = :t', { t: 'up' })
      .andWhere('ms.city IS NOT NULL')
      .andWhere(city ? 'ms.city = :city' : '1=1', city ? { city } : {})
      .orderBy('ms.trendPct', 'DESC')
      .take(6)
      .getMany();

    for (const snap of topTrend) {
      if (!cards.find(c => c.city === snap.city && c.tag === 'Price Trend')) {
        cards.push({
          city: snap.city, state: snap.state,
          insight: `Property prices in ${snap.city} rose by ${Number(snap.trendPct).toFixed(1)}% recently — market is trending upward.`,
          trend: snap.trend, trendPct: Number(snap.trendPct),
          avgPsf: Number(snap.avgPsf), tag: 'Price Trend',
        });
      }
    }

    return cards.slice(0, 12);
  }

  // ── List available cities ────────────────────────────────────────────────────
  async getAvailableCities() {
    return this.snapshotRepo
      .createQueryBuilder('ms')
      .select('DISTINCT ms.city', 'city')
      .where('ms.city IS NOT NULL')
      .orderBy('ms.city', 'ASC')
      .getRawMany();
  }
}

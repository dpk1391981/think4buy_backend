import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { TopPropertiesCache } from './entities/top-properties-cache.entity';
import { TopAgentsCache } from './entities/top-agents-cache.entity';
import { TopProjectsCache } from './entities/top-projects-cache.entity';
import { TopLocationsCache } from './entities/top-locations-cache.entity';
import { CategoryAnalytics } from './entities/category-analytics.entity';
import { MarketSnapshot } from './entities/market-snapshot.entity';
import { LocalityCircleRate } from './entities/locality-circle-rate.entity';
import { ScoringConfig } from './entities/scoring-config.entity';
import { PropType } from '../property-config/entities/prop-type.entity';

// ─── Resolve area value from column or extraDetails JSON fallback ─────────────
// Priority: p.area column → extraDetails.carpet_area[0].value → extraDetails.area[0].value
// Both carpet_area and area use the DEPENDENT field format: [{label, value, unit}]
const RESOLVED_AREA_SQL = `
  COALESCE(
    NULLIF(p.area, 0),
    CASE WHEN JSON_TYPE(JSON_EXTRACT(p.extraDetails, '$.carpet_area')) = 'ARRAY'
         THEN CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.extraDetails, '$.carpet_area[0].value')), '') AS DECIMAL(15,2))
    END,
    CASE WHEN JSON_TYPE(JSON_EXTRACT(p.extraDetails, '$.area')) = 'ARRAY'
         THEN CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.extraDetails, '$.area[0].value')), '') AS DECIMAL(15,2))
    END
  )
`;

// ─── Resolve area unit from column or extraDetails JSON fallback ──────────────
const RESOLVED_UNIT_SQL = `
  COALESCE(
    NULLIF(p.areaUnit, ''),
    CASE WHEN JSON_TYPE(JSON_EXTRACT(p.extraDetails, '$.carpet_area')) = 'ARRAY'
         THEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.extraDetails, '$.carpet_area[0].unit')), '')
    END,
    CASE WHEN JSON_TYPE(JSON_EXTRACT(p.extraDetails, '$.area')) = 'ARRAY'
         THEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.extraDetails, '$.area[0].unit')), '')
    END,
    'Sq.ft.'
  )
`;

// ─── Unit normalisation (all areas → Sq.Ft.) ─────────────────────────────────
const AREA_TO_SQFT_SQL = `
  CASE
    WHEN (${RESOLVED_UNIT_SQL}) IS NULL OR (${RESOLVED_UNIT_SQL}) = ''
      OR LOWER((${RESOLVED_UNIT_SQL})) LIKE '%sq%ft%'
      OR LOWER((${RESOLVED_UNIT_SQL})) LIKE '%sqft%'   THEN (${RESOLVED_AREA_SQL})
    WHEN LOWER((${RESOLVED_UNIT_SQL})) LIKE '%sq%yd%'
      OR LOWER((${RESOLVED_UNIT_SQL})) LIKE '%sqyd%'   THEN (${RESOLVED_AREA_SQL}) * 9.0
    WHEN LOWER((${RESOLVED_UNIT_SQL})) LIKE '%sq%mt%'
      OR LOWER((${RESOLVED_UNIT_SQL})) LIKE '%sq%m%'
      OR LOWER((${RESOLVED_UNIT_SQL})) LIKE '%sqmt%'   THEN (${RESOLVED_AREA_SQL}) * 10.764
    WHEN LOWER((${RESOLVED_UNIT_SQL})) LIKE '%acre%'   THEN (${RESOLVED_AREA_SQL}) * 43560.0
    WHEN LOWER((${RESOLVED_UNIT_SQL})) LIKE '%bigha%'  THEN (${RESOLVED_AREA_SQL}) * 27000.0
    WHEN LOWER((${RESOLVED_UNIT_SQL})) LIKE '%marla%'  THEN (${RESOLVED_AREA_SQL}) * 272.25
    WHEN LOWER((${RESOLVED_UNIT_SQL})) LIKE '%kanal%'  THEN (${RESOLVED_AREA_SQL}) * 5445.0
    ELSE (${RESOLVED_AREA_SQL})
  END
`;

// ─── Minimum area threshold (sqft) — filters out garages, balconies, invalid rows
const MIN_AREA_SQFT = 50;

// ─── Sale PSF expression ──────────────────────────────────────────────────────
// priceUnit='per sqft' → direct PSF (any category).
// priceUnit='total' → only confirmed sale categories (buy, builder_project,
// investment). Commercial/industrial 'total' is ambiguous (often monthly rent).
// Area must be >= 50 sqft to prevent micro-area distortions (garages, balconies).
const BUY_PSF_SQL = `
  CASE
    WHEN p.priceUnit = 'per sqft' AND p.price > 0
      THEN p.price
    WHEN (p.priceUnit = 'total' OR p.priceUnit IS NULL OR p.priceUnit = '')
      AND p.category IN ('buy', 'builder_project', 'investment')
      AND (${RESOLVED_AREA_SQL}) >= ${MIN_AREA_SQFT} AND p.price > 0
      AND (${AREA_TO_SQFT_SQL}) >= ${MIN_AREA_SQFT}
      THEN p.price / (${AREA_TO_SQFT_SQL})
    ELSE NULL
  END
`;

// ─── Sale price (total value) ─────────────────────────────────────────────────
const SALE_PRICE_SQL = `
  CASE
    WHEN p.category IN ('buy', 'builder_project', 'investment', 'commercial', 'industrial')
      AND p.priceUnit != 'per month'
      AND p.price > 0
      THEN p.price
    ELSE NULL
  END
`;

// ─── Monthly rent ─────────────────────────────────────────────────────────────
const RENT_PRICE_SQL = `
  CASE
    WHEN p.priceUnit = 'per month' AND p.price > 0
      THEN p.price
    WHEN p.category IN ('rent', 'pg')
      AND (p.priceUnit = 'total' OR p.priceUnit IS NULL OR p.priceUnit = '')
      AND p.price > 0
      THEN p.price
    ELSE NULL
  END
`;

// ─── Rent PSF (rent per sq.ft) — for apples-to-apples comparison with sale PSF ─
// Uses same area resolution as BUY_PSF_SQL but divides monthly rent by area.
// Area must be >= 50 sqft to prevent tiny-unit distortions.
const RENT_PSF_SQL = `
  CASE
    WHEN p.category IN ('rent', 'pg')
      AND (p.priceUnit = 'total' OR p.priceUnit IS NULL OR p.priceUnit = '' OR p.priceUnit = 'per month')
      AND p.price > 0
      AND (${RESOLVED_AREA_SQL}) >= ${MIN_AREA_SQFT}
      AND (${AREA_TO_SQFT_SQL}) >= ${MIN_AREA_SQFT}
      THEN p.price / (${AREA_TO_SQFT_SQL})
    ELSE NULL
  END
`;

// ─── Outlier bounds (Indian real estate context) ──────────────────────────────
const PSF_MIN      = 500;           // ₹500/sqft  — minimum credible PSF (per requirements)
const PSF_MAX      = 1_00_000;      // ₹1L/sqft   — ultra-luxury cap (per requirements)
const PRICE_MIN    = 1_00_000;      // ₹1 lakh
const PRICE_MAX    = 50_00_00_000;  // ₹50 crore
const RENT_MIN     = 1_000;         // ₹1k/month
const RENT_MAX     = 5_00_000;      // ₹5 lakh/month (per requirements)
const RENT_PSF_MIN = 2;             // ₹2/sqft/month  — very affordable rentals
const RENT_PSF_MAX = 1_000;         // ₹1000/sqft/month — ultra-luxury rentals

// ─── Minimum listing count for credible market signal ────────────────────────
// Raised to 5 per production requirements — eliminates single-listing noise
const MIN_PSF_LISTINGS      = 5;  // Need >= 5 sale listings to show PSF
const MIN_RENT_LISTINGS     = 5;  // Need >= 5 rent listings to show rent PSF
const MIN_TREND_LISTINGS    = 5;  // Need >= 5 in both periods for trend
const MIN_LOCALITY_LISTINGS = 5;  // Localities with < 5 listings are low-confidence

// ─── Property type segmentation maps ─────────────────────────────────────────
// Maps segment key → array of p.type values to include in SQL IN clause.
// This is the primary mechanism for separating apartments from villas/commercial.
const SEGMENT_TYPE_MAP: Record<string, string[]> = {
  apartment:   ['apartment', 'penthouse', 'studio'],
  villa:       ['villa', 'house', 'builder_floor', 'farm_house'],
  commercial:  ['commercial_office', 'commercial_shop', 'commercial_warehouse', 'showroom', 'industrial_shed', 'factory'],
  plot:        ['plot', 'land'],
  residential: ['apartment', 'villa', 'house', 'penthouse', 'studio', 'builder_floor', 'farm_house'],
};

// Segment keys with human-readable labels for UI
export const SEGMENT_LABELS: Record<string, string> = {
  apartment:   'Apartments',
  villa:       'Villas & Houses',
  commercial:  'Commercial',
  plot:        'Plots & Land',
  residential: 'Residential',
};

// ─── City-specific appreciation & rent growth models ─────────────────────────
// Based on 10-year historical CAGR data from NHB / PropEquity reports.
const CITY_MODELS: Record<string, { appreciation: number; rentGrowth: number }> = {
  'mumbai':      { appreciation: 0.05, rentGrowth: 0.03 },
  'delhi':       { appreciation: 0.06, rentGrowth: 0.04 },
  'new delhi':   { appreciation: 0.06, rentGrowth: 0.04 },
  'bangalore':   { appreciation: 0.08, rentGrowth: 0.06 },
  'bengaluru':   { appreciation: 0.08, rentGrowth: 0.06 },
  'hyderabad':   { appreciation: 0.09, rentGrowth: 0.07 },
  'pune':        { appreciation: 0.07, rentGrowth: 0.05 },
  'chennai':     { appreciation: 0.06, rentGrowth: 0.04 },
  'kolkata':     { appreciation: 0.05, rentGrowth: 0.03 },
  'noida':       { appreciation: 0.07, rentGrowth: 0.05 },
  'gurgaon':     { appreciation: 0.07, rentGrowth: 0.05 },
  'gurugram':    { appreciation: 0.07, rentGrowth: 0.05 },
  'navi mumbai': { appreciation: 0.06, rentGrowth: 0.04 },
  'ahmedabad':   { appreciation: 0.07, rentGrowth: 0.05 },
  'ghaziabad':   { appreciation: 0.06, rentGrowth: 0.04 },
  'faridabad':   { appreciation: 0.05, rentGrowth: 0.03 },
  'lucknow':     { appreciation: 0.06, rentGrowth: 0.04 },
  'jaipur':      { appreciation: 0.06, rentGrowth: 0.04 },
  'surat':       { appreciation: 0.07, rentGrowth: 0.05 },
  'coimbatore':  { appreciation: 0.06, rentGrowth: 0.04 },
  'kochi':       { appreciation: 0.07, rentGrowth: 0.05 },
  'indore':      { appreciation: 0.07, rentGrowth: 0.05 },
};
const DEFAULT_CITY_MODEL = { appreciation: 0.07, rentGrowth: 0.05 };

// ─── Default Scoring Weights ──────────────────────────────────────────────────
// These are the out-of-box defaults. Admin can override them in scoring_config table.
const DEFAULT_WEIGHTS = {
  // ── Listing feed score (home feed) ── total must = 1.0
  LISTING_VIEWS_7D:      0.20,  // normalized 7-day views
  LISTING_INQUIRIES_7D:  0.25,  // 7-day inquiry count
  LISTING_SAVES_7D:      0.15,  // 7-day save/favourite count
  LISTING_RECENCY:       0.15,  // freshness bonus (decays over 60 days)
  LISTING_AGENT_BOOST:   0.15,  // agent authority / subscription boost
  LISTING_PLAN_BOOST:    0.10,  // listing plan tier boost
  // cap for views normalisation (raw views ÷ this = 0..1)
  LISTING_VIEWS_CAP:     500,

  // ── Featured score ── total must = 1.0
  FEATURED_PLAN:         0.40,  // listing plan weight
  FEATURED_BOOST_ACTIVE: 0.30,  // is boost active?
  FEATURED_PERFORMANCE:  0.30,  // normalized perf (views+inquiries)

  // ── Hot Deal score ── total must = 1.0
  HOT_VIEWS_24H:         0.30,
  HOT_INQUIRIES_24H:     0.40,
  HOT_SAVES_24H:         0.15,
  HOT_BOOST_ACTIVE:      0.15,
  // threshold (raw hot score) to earn the tag
  HOT_THRESHOLD:         5,
  // Trending velocity threshold (this-week inquiries / last-week inquiries > x)
  TRENDING_VELOCITY:     1.5,

  // ── Agent score ── total must = 1.0
  AGENT_LISTINGS:        0.20,
  AGENT_INQUIRIES_7D:    0.30,
  AGENT_CONVERSION:      0.20,
  AGENT_RATING:          0.15,
  AGENT_PREMIUM:         0.10,
  AGENT_RECENCY:         0.05,
  // caps for normalisation
  AGENT_LISTINGS_CAP:    50,
  AGENT_INQ_CAP:         100,

  // ── Legacy / location / category weights ──
  LOC_PROPS:     0.30,
  LOC_SEARCHES:  0.25,
  LOC_VIEWS:     0.25,
  LOC_INQUIRIES: 0.20,
  CAT_LISTINGS:  0.25,
  CAT_VIEWS:     0.30,
  CAT_SEARCHES:  0.20,
  CAT_INQUIRIES: 0.15,
  CAT_SAVES:     0.10,
};

type Weights = typeof DEFAULT_WEIGHTS;

// Keep the old W alias for legacy code that still references W.PROP_* etc.
const W = {
  PROP_VIEWS:     DEFAULT_WEIGHTS.LISTING_VIEWS_7D,
  PROP_INQUIRIES: DEFAULT_WEIGHTS.LISTING_INQUIRIES_7D,
  PROP_SAVES:     DEFAULT_WEIGHTS.LISTING_SAVES_7D,
  PROP_RECENCY:   DEFAULT_WEIGHTS.LISTING_RECENCY,
  AGENT_RATING:   DEFAULT_WEIGHTS.AGENT_RATING,
  AGENT_LISTINGS: DEFAULT_WEIGHTS.AGENT_LISTINGS,
  AGENT_VIEWS:    0.20,
  AGENT_DEALS:    0.25,
  LOC_PROPS:      DEFAULT_WEIGHTS.LOC_PROPS,
  LOC_SEARCHES:   DEFAULT_WEIGHTS.LOC_SEARCHES,
  LOC_VIEWS:      DEFAULT_WEIGHTS.LOC_VIEWS,
  LOC_INQUIRIES:  DEFAULT_WEIGHTS.LOC_INQUIRIES,
  CAT_LISTINGS:   DEFAULT_WEIGHTS.CAT_LISTINGS,
  CAT_VIEWS:      DEFAULT_WEIGHTS.CAT_VIEWS,
  CAT_SEARCHES:   DEFAULT_WEIGHTS.CAT_SEARCHES,
  CAT_INQUIRIES:  DEFAULT_WEIGHTS.CAT_INQUIRIES,
  CAT_SAVES:      DEFAULT_WEIGHTS.CAT_SAVES,
};

const TRENDING_THRESHOLD = 0.20; // 20% growth triggers trending badge

// ─── Indian rupee formatter (backend — for API response display strings) ──────
function formatINR(value: number | null | undefined): string {
  if (!value || value <= 0) return '₹0';
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1).replace(/\.0$/, '')} Cr`;
  if (value >= 1_00_000)    return `₹${(value / 1_00_000).toFixed(1).replace(/\.0$/, '')} L`;
  if (value >= 1_000)       return `₹${Math.round(value / 1_000)}K`;
  return `₹${value.toLocaleString('en-IN')}`;
}

// ─── Confidence label from listing count ─────────────────────────────────────
function confidenceLabelFromCount(count: number): 'High' | 'Medium' | 'Low' {
  if (count >= 20) return 'High';
  if (count >= 5)  return 'Medium';
  return 'Low';
}

// Property type metadata for category cards
export const PROPERTY_TYPE_META: Record<string, { label: string; icon: string }> = {
  apartment:             { label: 'Apartments',       icon: '🏢' },
  villa:                 { label: 'Villas',           icon: '🏡' },
  plot:                  { label: 'Plots / Land',     icon: '📐' },
  house:                 { label: 'Houses',           icon: '🏠' },
  penthouse:             { label: 'Penthouses',       icon: '🌆' },
  studio:                { label: 'Studio Flats',     icon: '🛋️' },
  commercial_office:     { label: 'Office Spaces',    icon: '🏢' },
  commercial_shop:       { label: 'Retail Shops',     icon: '🏪' },
  commercial_warehouse:  { label: 'Warehouses',       icon: '🏭' },
  pg:                    { label: 'PG / Hostel',      icon: '🛏️' },
  co_living:             { label: 'Co-Living',        icon: '🤝' },
  builder_floor:         { label: 'Builder Floors',   icon: '🏗️' },
  farm_house:            { label: 'Farm Houses',      icon: '🌾' },
  land:                  { label: 'Land',             icon: '🗺️' },
  showroom:              { label: 'Showrooms',        icon: '🏬' },
  industrial_shed:       { label: 'Industrial Sheds', icon: '⚙️' },
  factory:               { label: 'Factories',        icon: '🏭' },
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventRepo: Repository<AnalyticsEvent>,

    @InjectRepository(TopPropertiesCache)
    private readonly topPropsRepo: Repository<TopPropertiesCache>,

    @InjectRepository(TopAgentsCache)
    private readonly topAgentsRepo: Repository<TopAgentsCache>,

    @InjectRepository(TopProjectsCache)
    private readonly topProjectsRepo: Repository<TopProjectsCache>,

    @InjectRepository(TopLocationsCache)
    private readonly topLocRepo: Repository<TopLocationsCache>,

    @InjectRepository(CategoryAnalytics)
    private readonly catRepo: Repository<CategoryAnalytics>,

    @InjectRepository(MarketSnapshot)
    private readonly snapshotRepo: Repository<MarketSnapshot>,

    @InjectRepository(LocalityCircleRate)
    private readonly circleRateRepo: Repository<LocalityCircleRate>,

    @InjectRepository(ScoringConfig)
    private readonly scoringConfigRepo: Repository<ScoringConfig>,

    @InjectRepository(PropType)
    private readonly propTypeRepo: Repository<PropType>,

    private readonly dataSource: DataSource,
  ) {}

  // ─── Dynamic type alias resolution ──────────────────────────────────────────

  /**
   * Returns a map of slug → canonicalSlug from the prop_types table.
   * Aliases (aliasOf != null) map to their canonical slug.
   * Canonical types map to themselves.
   */
  private async getAliasMap(): Promise<Map<string, string>> {
    try {
      const types = await this.propTypeRepo.find({ select: ['slug', 'aliasOf'] });
      const map = new Map<string, string>();
      for (const t of types) {
        map.set(t.slug, t.aliasOf ?? t.slug);
      }
      return map;
    } catch {
      return new Map();
    }
  }

  /**
   * Returns label+icon for each canonical type slug.
   * Prefers values from prop_types DB, falls back to PROPERTY_TYPE_META.
   */
  private async getTypeMeta(): Promise<Map<string, { label: string; icon: string }>> {
    const map = new Map<string, { label: string; icon: string }>();
    // Seed with hardcoded fallbacks first
    for (const [slug, meta] of Object.entries(PROPERTY_TYPE_META)) {
      map.set(slug, { ...meta });
    }
    try {
      const types = await this.propTypeRepo.find({ where: { status: true }, select: ['slug', 'name', 'icon', 'aliasOf'] });
      for (const t of types) {
        const canonical = t.aliasOf ?? t.slug;
        if (!map.has(canonical)) {
          // New type not in hardcoded list — use DB name/icon
          map.set(canonical, { label: t.name || canonical, icon: t.icon || '🏠' });
        }
        // Alias itself should also resolve meta through canonical
        if (t.aliasOf && !map.has(t.slug)) {
          map.set(t.slug, map.get(t.aliasOf) ?? { label: t.name || t.slug, icon: t.icon || '🏠' });
        }
      }
    } catch {
      // ignore — hardcoded fallbacks already seeded
    }
    return map;
  }

  // ─── Load weights (DB overrides defaults) ────────────────────────────────────
  private async loadWeights(): Promise<Weights> {
    const rows = await this.scoringConfigRepo.find();
    const w: Weights = { ...DEFAULT_WEIGHTS };
    for (const row of rows) {
      if (row.key in w) (w as any)[row.key] = parseFloat(row.value as any);
    }
    return w;
  }

  // ─── Admin: get / update scoring config ─────────────────────────────────────
  async getScoringConfig() {
    const saved = await this.scoringConfigRepo.find({ order: { group: 'ASC', key: 'ASC' } });
    const savedMap = new Map(saved.map(r => [r.key, r]));

    // Merge defaults with any DB overrides so all keys are always returned
    return Object.entries(DEFAULT_WEIGHTS).map(([key, defaultVal]) => {
      const db = savedMap.get(key);
      return {
        key,
        value:       db ? parseFloat(db.value as any) : defaultVal,
        description: db?.description || '',
        group:       db?.group || this.guessGroup(key),
        isOverridden: !!db,
        defaultValue: defaultVal,
      };
    });
  }

  async setScoringConfig(key: string, value: number, description?: string) {
    if (!(key in DEFAULT_WEIGHTS)) throw new Error(`Unknown config key: ${key}`);
    let row = await this.scoringConfigRepo.findOne({ where: { key } });
    if (!row) {
      row = this.scoringConfigRepo.create({ key, group: this.guessGroup(key) });
    }
    row.value = value;
    if (description !== undefined) row.description = description;
    return this.scoringConfigRepo.save(row);
  }

  async resetScoringConfig(key: string) {
    await this.scoringConfigRepo.delete({ key });
  }

  private guessGroup(key: string): string {
    if (key.startsWith('LISTING')) return 'listing';
    if (key.startsWith('FEATURED')) return 'featured';
    if (key.startsWith('HOT')) return 'hot';
    if (key.startsWith('AGENT')) return 'agent';
    return 'misc';
  }

  // ─── Event Tracking ─────────────────────────────────────────────────────────

  async trackEvent(dto: {
    eventType: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    sessionId?: string;
    country?: string;
    state?: string;
    city?: string;
    deviceType?: string;
    source?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.eventRepo.insert({
        eventType:  dto.eventType,
        entityType: dto.entityType,
        entityId:   dto.entityId,
        userId:     dto.userId,
        sessionId:  dto.sessionId,
        country:    dto.country,
        state:      dto.state,
        city:       dto.city,
        deviceType: dto.deviceType || 'desktop',
        source:     dto.source || 'direct',
        metadata:   dto.metadata,
      });
    } catch (err: any) {
      // Analytics tracking must never break the main app
      this.logger.warn('Event tracking failed silently', err?.message);
    }
  }

  // ─── Home API: Top Categories ────────────────────────────────────────────────

  async getTopCategories(filters: {
    country?: string;
    state?: string;
    city?: string;
    limit?: number;
  }) {
    const limit = Math.min(filters.limit || 12, 20);

    // ── Always fetch live listing counts so the displayed number matches the
    //    listing page exactly (cache can be stale between cron runs).
    const liveQb = this.dataSource
      .createQueryBuilder()
      .select('p.type', 'propertyType')
      .addSelect('COUNT(*)', 'cnt')
      .from('properties', 'p')
      .where('p.approvalStatus = :s', { s: 'approved' })
      .andWhere("p.status = 'active'")
      .andWhere('p.isDraft = :isDraft', { isDraft: false })
      .groupBy('p.type');

    if (filters.city)        liveQb.andWhere('p.city = :city',   { city:  filters.city  });
    else if (filters.state)  liveQb.andWhere('p.state = :state', { state: filters.state });

    const liveCounts: { propertyType: string; cnt: string }[] = await liveQb.getRawMany();

    // Resolve aliases so canonical type → sum of all alias type counts
    const aliasMapForLive = await this.getAliasMap();
    const liveCountMap = new Map<string, number>();
    for (const r of liveCounts) {
      const canonical = aliasMapForLive.get(r.propertyType) ?? r.propertyType;
      liveCountMap.set(canonical, (liveCountMap.get(canonical) ?? 0) + parseInt(r.cnt));
    }

    // ── Build location-aware WHERE for cache (used for rank / trending only) ──
    const qb = this.catRepo
      .createQueryBuilder('c')
      .orderBy('c.rank', 'ASC')
      .limit(limit);

    if (filters.city) {
      qb.where('c.city = :city', { city: filters.city });
    } else if (filters.state) {
      qb.where('c.state = :state AND (c.city IS NULL OR c.city = \'\')', { state: filters.state });
    } else if (filters.country) {
      qb.where('c.country = :country AND (c.state IS NULL OR c.state = \'\')', { country: filters.country });
    } else {
      // Global (no location filter) — null/empty state & city
      qb.where('(c.state IS NULL OR c.state = \'\') AND (c.city IS NULL OR c.city = \'\')');
    }

    const rows = await qb.getMany();

    // If cache is empty, fall back to live query (already uses live counts)
    if (rows.length === 0) {
      return this.getLiveCategoryData(filters, limit);
    }

    // Merge: live count for totalListings, cache for rank/trending/views/searches
    return rows
      .map(r => ({
        propertyType:  r.propertyType,
        label:         r.label,
        icon:          r.icon,
        totalListings: liveCountMap.get(r.propertyType) ?? r.totalListings,
        totalViews:    r.totalViews,
        totalSearches: r.totalSearches,
        score:         Number(r.score),
        rank:          r.rank,
        isTrending:    r.isTrending,
        trendingScore: Number(r.trendingScore),
      }))
      .filter(r => r.totalListings > 0)   // hide types with no active listings
      .sort((a, b) => a.rank - b.rank);
  }

  /** Live fallback: count properties by type from main DB, with alias resolution */
  private async getLiveCategoryData(
    filters: { country?: string; state?: string; city?: string },
    limit: number,
  ) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('p.type', 'propertyType')
      .addSelect('COUNT(*)', 'totalListings')
      .from('properties', 'p')
      .where('p.approvalStatus = :s', { s: 'approved' })
      .andWhere("p.status = 'active'")
      .andWhere('p.isDraft = :isDraft', { isDraft: false })
      .groupBy('p.type')
      .orderBy('totalListings', 'DESC')
      .limit(limit * 3); // fetch more to account for alias merging

    if (filters.city)    qb.andWhere('p.city = :city', { city: filters.city });
    else if (filters.state) qb.andWhere('p.state = :state', { state: filters.state });

    const rows: { propertyType: string; totalListings: string }[] = await qb.getRawMany();

    const [aliasMap, typeMeta] = await Promise.all([this.getAliasMap(), this.getTypeMeta()]);

    // Merge aliased types into their canonical slug
    const merged = new Map<string, number>();
    for (const r of rows) {
      const canonical = aliasMap.get(r.propertyType) ?? r.propertyType;
      merged.set(canonical, (merged.get(canonical) ?? 0) + parseInt(r.totalListings));
    }

    return Array.from(merged.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([slug, count], idx) => {
        const meta = typeMeta.get(slug) ?? { label: slug, icon: '🏠' };
        return {
          propertyType:  slug,
          label:         meta.label,
          icon:          meta.icon,
          totalListings: count,
          totalViews:    0,
          totalSearches: 0,
          score:         count,
          rank:          idx + 1,
          isTrending:    false,
          trendingScore: 0,
        };
      });
  }

  // ─── Home API: Top States ────────────────────────────────────────────────────

  async getTopStates(country?: string, limit = 12) {
    const qb = this.topLocRepo
      .createQueryBuilder('l')
      .where('l.entityType = :t', { t: 'state' })
      .orderBy('l.rank', 'ASC')
      .limit(Math.min(limit, 20));

    if (country) qb.andWhere('l.parentName = :c', { c: country });

    const rows = await qb.getMany();
    if (rows.length === 0) return this.getLiveStates(country, limit);

    return rows.map(r => ({
      id:            r.entityId,
      name:          r.entityName,
      imageUrl:      r.imageUrl,
      propertyCount: r.propertyCount,
      searchCount:   r.searchCount,
      viewCount:     r.viewCount,
      score:         Number(r.score),
      rank:          r.rank,
      isTrending:    r.isTrending,
    }));
  }

  private async getLiveStates(country: string | undefined, limit: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select(['s.id', 's.name', 's.imageUrl', 's.propertyCount'])
      .from('states', 's')
      .where('s.isActive = 1')
      .orderBy('s.propertyCount', 'DESC')
      .limit(limit);

    const rows = await qb.getRawMany();
    return rows.map((r, i) => ({
      id:            r.s_id,
      name:          r.s_name,
      imageUrl:      r.s_imageUrl,
      propertyCount: r.s_propertyCount || 0,
      searchCount:   0,
      viewCount:     0,
      score:         r.s_propertyCount || 0,
      rank:          i + 1,
      isTrending:    false,
    }));
  }

  // ─── Home API: Top Cities ────────────────────────────────────────────────────

  async getTopCities(state?: string, country?: string, limit = 12) {
    const qb = this.topLocRepo
      .createQueryBuilder('l')
      .where('l.entityType = :t', { t: 'city' })
      .orderBy('l.rank', 'ASC')
      .limit(Math.min(limit, 20));

    if (state) qb.andWhere('l.parentName = :s', { s: state });

    const rows = await qb.getMany();
    if (rows.length === 0) return this.getLiveCities(state, limit);

    return rows.map(r => ({
      id:            r.entityId,
      name:          r.entityName,
      imageUrl:      r.imageUrl,
      stateName:     r.parentName,
      propertyCount: r.propertyCount,
      searchCount:   r.searchCount,
      viewCount:     r.viewCount,
      score:         Number(r.score),
      rank:          r.rank,
      isTrending:    r.isTrending,
    }));
  }

  private async getLiveCities(state: string | undefined, limit: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select(['c.id', 'c.name', 'c.imageUrl', 'c.propertyCount', 's.name AS stateName'])
      .from('cities', 'c')
      .leftJoin('states', 's', 's.id = c.state_id')
      .where('c.isActive = 1')
      .orderBy('c.propertyCount', 'DESC')
      .limit(limit);

    if (state) qb.andWhere('s.name = :state', { state });

    const rows = await qb.getRawMany();
    return rows.map((r, i) => ({
      id:            r.c_id,
      name:          r.c_name,
      imageUrl:      r.c_imageUrl,
      stateName:     r.stateName,
      propertyCount: r.c_propertyCount || 0,
      searchCount:   0,
      viewCount:     0,
      score:         r.c_propertyCount || 0,
      rank:          i + 1,
      isTrending:    false,
    }));
  }

  // ─── Home API: Top Properties ─────────────────────────────────────────────────

  async getTopProperties(filters: {
    tab?: string;       // featured | premium | most_viewed | just_listed | new_projects
    country?: string;
    state?: string;
    city?: string;
    limit?: number;
    period?: string;
  }) {
    const tab    = filters.tab    || 'featured';
    const period = filters.period || '7d';
    const limit  = Math.min(filters.limit || 8, 20);

    const qb = this.topPropsRepo
      .createQueryBuilder('tp')
      .leftJoinAndSelect('tp.property', 'p')
      .leftJoinAndSelect('p.images', 'img')
      .leftJoinAndSelect('p.owner', 'owner')
      .where('tp.tab = :tab', { tab })
      .andWhere('tp.period = :period', { period })
      .orderBy('tp.rank', 'ASC')
      .limit(limit);

    if (filters.city)    qb.andWhere('tp.city = :city', { city: filters.city });
    else if (filters.state) qb.andWhere('tp.state = :state AND (tp.city IS NULL OR tp.city = \'\')', { state: filters.state });

    const rows = await qb.getMany();

    if (rows.length > 0) {
      return rows
        .filter(r => r.property)
        .map(r => ({
          ...r.property,
          _score:       Number(r.score),
          _rank:        r.rank,
          _viewsLast7d: r.viewsCount,
          _inqLast7d:   r.inquiriesCount,
        }));
    }

    // Live fallback
    return this.getLiveProperties(filters, tab, limit);
  }

  private async getLiveProperties(
    filters: { country?: string; state?: string; city?: string },
    tab: string,
    limit: number,
  ) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('p.*')
      .from('properties', 'p')
      .where('p.approvalStatus = :s', { s: 'approved' })
      .andWhere("p.status = 'active'")
      .limit(limit);

    if (filters.city)    qb.andWhere('p.city = :city', { city: filters.city });
    else if (filters.state) qb.andWhere('p.state = :state', { state: filters.state });

    switch (tab) {
      case 'premium':        qb.andWhere('p.isPremium = 1').orderBy('p.featuredScore', 'DESC'); break;
      case 'most_viewed':    qb.orderBy('p.viewCount', 'DESC');                                 break;
      case 'just_listed':    qb.orderBy('p.createdAt', 'DESC');                                 break;
      case 'new_projects':   qb.andWhere("p.possessionStatus = 'under_construction'").orderBy('p.createdAt', 'DESC'); break;
      case 'smart_featured': qb.orderBy('p.listingScore', 'DESC');                              break;
      default:               qb.andWhere('p.isFeatured = 1').orderBy('p.featuredScore', 'DESC'); break;
    }

    if (!['most_viewed', 'just_listed', 'new_projects'].includes(tab)) {
      qb.orderBy('p.viewCount', 'DESC');
    }

    return qb.getRawMany();
  }

  // ─── Home API: Top Agents ─────────────────────────────────────────────────────

  async getTopAgents(filters: { country?: string; state?: string; city?: string; limit?: number }) {
    const limit = Math.min(filters.limit || 8, 20);

    const qb = this.topAgentsRepo
      .createQueryBuilder('ta')
      .leftJoinAndSelect('ta.agent', 'u')
      .orderBy('ta.rank', 'ASC')
      .limit(limit);

    if (filters.city)    qb.where('ta.city = :city', { city: filters.city });
    else if (filters.state) qb.where('ta.state = :state AND (ta.city IS NULL OR ta.city = \'\')', { state: filters.state });

    const rows = await qb.getMany();
    if (rows.length > 0) {
      return rows.filter(r => r.agent).map(r => ({
        ...r.agent,
        _score:    Number(r.score),
        _rank:     r.rank,
        _views:    r.profileViews,
      }));
    }

    // Live fallback
    return this.getLiveAgents(filters, limit);
  }

  private async getLiveAgents(
    filters: { country?: string; state?: string; city?: string },
    limit: number,
  ) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('u.*')
      .from('users', 'u')
      .where("u.role = 'agent'")
      .andWhere('u.isActive = 1')
      .orderBy('(u.agentRating * 0.3 + u.totalDeals * 0.4 + u.agentExperience * 0.3)', 'DESC')
      .limit(limit);

    if (filters.city)    qb.andWhere('u.city = :city', { city: filters.city });
    else if (filters.state) qb.andWhere('u.state = :state', { state: filters.state });

    return qb.getRawMany();
  }

  // ─── Home API: Top Projects ────────────────────────────────────────────────────

  async getTopProjects(filters: { country?: string; state?: string; city?: string; limit?: number }) {
    const limit = Math.min(filters.limit || 8, 20);

    const qb = this.topProjectsRepo
      .createQueryBuilder('tp')
      .leftJoinAndSelect('tp.property', 'p')
      .leftJoinAndSelect('p.images', 'img')
      .leftJoinAndSelect('p.owner', 'owner')
      .orderBy('tp.rank', 'ASC')
      .limit(limit);

    if (filters.city)    qb.where('tp.city = :city', { city: filters.city });
    else if (filters.state) qb.where('tp.state = :state AND (tp.city IS NULL OR tp.city = \'\')', { state: filters.state });

    const rows = await qb.getMany();
    if (rows.length > 0) {
      return rows.filter(r => r.property).map(r => ({ ...r.property, _score: Number(r.score), _rank: r.rank }));
    }

    return this.getLiveProjects(filters, limit);
  }

  private async getLiveProjects(
    filters: { country?: string; state?: string; city?: string },
    limit: number,
  ) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('p.*')
      .from('properties', 'p')
      .where('p.approvalStatus = :s', { s: 'approved' })
      .andWhere("p.status = 'active'")
      .andWhere("p.possessionStatus = 'under_construction'")
      .orderBy('p.viewCount', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .limit(limit);

    if (filters.city)    qb.andWhere('p.city = :city', { city: filters.city });
    else if (filters.state) qb.andWhere('p.state = :state', { state: filters.state });

    return qb.getRawMany();
  }

  // ─── Home API: Trending Properties ──────────────────────────────────────────
  // Scores each active property by: viewCount (35%) + 7-day inquiries (45%) + recency (20%)

  async getTrendingProperties(filters: {
    city?: string;
    state?: string;
    category?: string;
    limit?: number;
  }) {
    const limit  = Math.min(filters.limit || 8, 20);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Build parameterized location + category filters
    const whereParts: string[] = [
      `p.approvalStatus = 'approved'`,
      `p.status = 'active'`,
      `p.isDraft = 0`,
    ];
    const params: any[] = [since7d];

    if (filters.city) {
      whereParts.push('p.city = ?');
      params.push(filters.city);
    } else if (filters.state) {
      whereParts.push('p.state = ?');
      params.push(filters.state);
    }
    if (filters.category === 'rent') {
      // "For Rent" — includes rent + pg
      whereParts.push("p.category IN ('rent', 'pg')");
    } else if (filters.category && filters.category !== 'all') {
      // "For Sale" (buy) — includes buy, commercial, industrial, builder_project, investment
      whereParts.push("p.category NOT IN ('rent', 'pg')");
    }
    params.push(limit);

    const where = whereParts.join(' AND ');

    // Raw query: join 7-day inquiry counts onto properties, score in SQL
    const rows: any[] = await this.dataSource.query(`
      SELECT
        p.id, p.title, p.slug, p.price, p.priceUnit,
        p.area, p.areaUnit, p.bedrooms, p.bathrooms,
        p.city, p.locality, p.state, p.category, p.type,
        p.viewCount, p.createdAt, p.isFeatured,
        p.furnishingStatus, p.possessionStatus, p.extraDetails,
        COALESCE(inq.cnt, 0)                                         AS weeklyInquiries,
        DATEDIFF(NOW(), p.createdAt)                                 AS daysOld,
        (
          p.viewCount * 0.35
          + COALESCE(inq.cnt, 0) * 150
          + (30.0 / (DATEDIFF(NOW(), p.createdAt) + 1)) * 20
        )                                                            AS trendScore
      FROM properties p
      LEFT JOIN (
        SELECT propertyId, COUNT(*) AS cnt
        FROM inquiries
        WHERE createdAt >= ?
        GROUP BY propertyId
      ) inq ON inq.propertyId = p.id
      WHERE ${where}
      ORDER BY trendScore DESC
      LIMIT ?
    `, params);

    if (!rows.length) return [];

    // Normalise for demand-level bucketing
    const maxScore = Math.max(...rows.map((r: any) => parseFloat(r.trendScore) || 0), 1);

    // Fetch images for all returned properties
    const ids = rows.map((r: any) => r.id);
    const images: any[] = await this.dataSource.query(
      `SELECT propertyId, url, isPrimary, alt
       FROM property_images
       WHERE propertyId IN (${ids.map(() => '?').join(',')})
       ORDER BY isPrimary DESC, sortOrder ASC`,
      ids,
    );
    const imgMap = new Map<string, any[]>();
    for (const img of images) {
      if (!imgMap.has(img.propertyId)) imgMap.set(img.propertyId, []);
      imgMap.get(img.propertyId)!.push({ url: img.url, alt: img.alt, isPrimary: !!img.isPrimary });
    }

    return rows.map((r: any, i: number) => {
      const score = parseFloat(r.trendScore) || 0;
      const pct   = score / maxScore;
      const demandLevel =
        pct >= 0.75 ? 'very_high' :
        pct >= 0.50 ? 'high'      :
        pct >= 0.25 ? 'medium'    : 'active';

      // Parse extraDetails JSON string (raw SQL returns JSON columns as strings)
      let extraDetails: Record<string, any> | null = null;
      if (r.extraDetails) {
        try { extraDetails = typeof r.extraDetails === 'string' ? JSON.parse(r.extraDetails) : r.extraDetails; } catch {}
      }

      // Resolve area: prefer area column, fall back to extraDetails.carpet_area,
      // then extraDetails.area (new [{unit, label, value}] format)
      let area: number | null = r.area ? parseFloat(r.area) : null;
      let areaUnit: string = r.areaUnit || 'Sq.ft.';

      function resolveAreaFromRaw(raw: any, currentUnit: string): { area: number | null; areaUnit: string } {
        if (Array.isArray(raw) && raw.length > 0 && raw[0].value) {
          return { area: parseFloat(raw[0].value) || null, areaUnit: raw[0].unit || currentUnit };
        }
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].value) {
              return { area: parseFloat(parsed[0].value) || null, areaUnit: parsed[0].unit || currentUnit };
            }
            if (typeof parsed === 'number' && parsed > 0) return { area: parsed, areaUnit: currentUnit };
          } catch { /* ignore */ }
          const num = parseFloat(raw);
          if (!isNaN(num) && num > 0) return { area: num, areaUnit: currentUnit };
        }
        if (typeof raw === 'number' && raw > 0) return { area: raw, areaUnit: currentUnit };
        return { area: null, areaUnit: currentUnit };
      }

      if (!area && extraDetails) {
        // Try carpet_area first (legacy key)
        if (extraDetails.carpet_area !== undefined && extraDetails.carpet_area !== null) {
          const resolved = resolveAreaFromRaw(extraDetails.carpet_area, areaUnit);
          if (resolved.area) { area = resolved.area; areaUnit = resolved.areaUnit; }
        }
        // Try area key (new format: [{unit, label, value}])
        if (!area && extraDetails.area !== undefined && extraDetails.area !== null) {
          const resolved = resolveAreaFromRaw(extraDetails.area, areaUnit);
          if (resolved.area) { area = resolved.area; areaUnit = resolved.areaUnit; }
        }
      }

      return {
        id:               r.id,
        title:            r.title,
        slug:             r.slug,
        price:            parseFloat(r.price) || 0,
        priceUnit:        r.priceUnit,
        area,
        areaUnit,
        bedrooms:         r.bedrooms ? parseInt(r.bedrooms) : null,
        bathrooms:        r.bathrooms ? parseInt(r.bathrooms) : null,
        city:             r.city,
        locality:         r.locality,
        state:            r.state,
        category:         r.category,
        type:             r.type,
        viewCount:        parseInt(r.viewCount) || 0,
        weeklyInquiries:  parseInt(r.weeklyInquiries) || 0,
        createdAt:        r.createdAt,
        trendScore:       Math.round(score * 10) / 10,
        demandLevel,
        rank:             i + 1,
        images:           imgMap.get(r.id) || [],
        extraDetails,
      };
    });
  }

  // ─── Home API: Compare Properties ────────────────────────────────────────────
  // Returns full data for up to 3 property IDs for side-by-side comparison

  async getCompareProperties(ids: string[]) {
    if (!ids.length || ids.length > 3) return [];

    const placeholders = ids.map(() => '?').join(',');
    const rows: any[] = await this.dataSource.query(`
      SELECT p.*
      FROM properties p
      WHERE p.id IN (${placeholders})
        AND p.approvalStatus = 'approved'
        AND p.status = 'active'
    `, ids);

    if (!rows.length) return [];

    // Fetch images
    const images: any[] = await this.dataSource.query(
      `SELECT propertyId, url, isPrimary, alt
       FROM property_images
       WHERE propertyId IN (${placeholders})
       ORDER BY isPrimary DESC, sortOrder ASC`,
      ids,
    );
    const imgMap = new Map<string, any[]>();
    for (const img of images) {
      if (!imgMap.has(img.propertyId)) imgMap.set(img.propertyId, []);
      imgMap.get(img.propertyId)!.push({ url: img.url, alt: img.alt, isPrimary: !!img.isPrimary });
    }

    // Fetch amenity counts (join table uses propertiesId column)
    const amenityCounts: any[] = await this.dataSource.query(`
      SELECT pa.propertiesId AS propertyId, COUNT(*) AS cnt
      FROM property_amenities pa
      WHERE pa.propertiesId IN (${placeholders})
      GROUP BY pa.propertiesId
    `, ids);
    const amenityCountMap = new Map(amenityCounts.map((r: any) => [r.propertyId, parseInt(r.cnt)]));

    return rows.map((p: any) => ({
      id:                p.id,
      title:             p.title,
      slug:              p.slug,
      price:             parseFloat(p.price) || 0,
      priceUnit:         p.priceUnit,
      area:              p.area ? parseFloat(p.area) : null,
      areaUnit:          p.areaUnit,
      pricePerSqft:      (() => {
        const price = parseFloat(p.price);
        const area  = parseFloat(p.area);
        if (!price || !area) return null;
        const unit = (p.areaUnit || '').toLowerCase();
        const sqft =
          unit.includes('sq') && unit.includes('yd') ? area * 9 :
          unit.includes('sq') && (unit.includes('mt') || unit.includes('m')) ? area * 10.764 :
          unit.includes('acre') ? area * 43560 :
          unit.includes('bigha') ? area * 27000 :
          unit.includes('marla') ? area * 272.25 :
          unit.includes('kanal') ? area * 5445 :
          area; // sqft or unknown
        if (p.priceUnit === 'per sqft') return Math.round(price);
        return sqft > 0 ? Math.round(price / sqft) : null;
      })(),
      bedrooms:          p.bedrooms ? parseInt(p.bedrooms) : null,
      bathrooms:         p.bathrooms ? parseInt(p.bathrooms) : null,
      floorNumber:       p.floorNumber ?? null,
      totalFloors:       p.totalFloors ?? null,
      city:              p.city,
      locality:          p.locality,
      state:             p.state,
      category:          p.category,
      type:              p.type,
      furnishingStatus:  p.furnishingStatus,
      possessionStatus:  p.possessionStatus,
      isFeatured:        !!p.isFeatured,
      isVerified:        !!p.isVerified,
      viewCount:         parseInt(p.viewCount) || 0,
      amenitiesCount:    amenityCountMap.get(p.id) || 0,
      images:            imgMap.get(p.id) || [],
    }));
  }

  // ─── Home API: Market Cities ──────────────────────────────────────────────────
  // Returns the ordered list of cities for the homepage Market Intelligence tabs.
  // Featured (admin-pinned) cities come first, then by listing count.

  async getMarketCities(limit = 12): Promise<{
    city: string; state: string | null; listingCount: number;
    isFeatured: boolean; sortOrder: number; hasData: boolean; updatedAt: string | null;
  }[]> {
    // 1. Get all-types aggregate snapshots (propertyType IS NULL) — one row per city
    const snapshots = await this.snapshotRepo.find({
      where: { propertyType: null as any },
      order: { isFeatured: 'DESC', sortOrder: 'ASC', totalListingCount: 'DESC' },
    });

    // Filter to snapshots that have a city name
    const withCity = snapshots.filter(s => s.city);

    if (withCity.length >= limit) {
      return withCity.slice(0, limit).map(s => ({
        city:         s.city!,
        state:        s.state,
        listingCount: s.totalListingCount,
        isFeatured:   s.isFeatured,
        sortOrder:    s.sortOrder,
        hasData:      s.avgPsf > 0 || s.totalListingCount > 0,
        updatedAt:    s.updatedAt?.toISOString() || null,
      }));
    }

    // 2. Also pull live cities from DB (in case not yet in snapshot table)
    const liveCities: any[] = await this.dataSource.query(`
      SELECT city, state, COUNT(*) AS cnt
      FROM properties
      WHERE approvalStatus = 'approved'
        AND status = 'active'
        AND isDraft = 0
        AND city IS NOT NULL AND city != ''
      GROUP BY city, state
      ORDER BY cnt DESC
      LIMIT ?
    `, [limit * 2]);

    // Merge: snapshot cities first, then live cities not yet snapshotted
    const known = new Set(withCity.map(s => s.city!.toLowerCase()));
    const extra = liveCities
      .filter((r: any) => !known.has((r.city as string).toLowerCase()))
      .slice(0, limit - withCity.length);

    return [
      ...withCity.slice(0, limit).map(s => ({
        city:         s.city!,
        state:        s.state,
        listingCount: s.totalListingCount,
        isFeatured:   s.isFeatured,
        sortOrder:    s.sortOrder,
        hasData:      s.avgPsf > 0 || s.totalListingCount > 0,
        updatedAt:    s.updatedAt?.toISOString() || null,
      })),
      ...extra.map((r: any) => ({
        city:         r.city,
        state:        r.state || null,
        listingCount: parseInt(r.cnt) || 0,
        isFeatured:   false,
        sortOrder:    100,
        hasData:      parseInt(r.cnt) > 0,
        updatedAt:    null,
      })),
    ].slice(0, limit);
  }

  // ─── Home API: Price Snapshot ─────────────────────────────────────────────────
  // Serves from the market_snapshots cache; falls back to live calculation if not cached.

  async getPriceSnapshot(city?: string, state?: string) {
    // 1. Try snapshot cache first
    if (city) {
      const cached = await this.snapshotRepo.findOne({
        where: { city, propertyType: null as any, listingType: null as any } as any,
      });
      // Use cache if younger than 6 hours
      if (cached && cached.updatedAt && (Date.now() - cached.updatedAt.getTime()) < 6 * 60 * 60 * 1000) {
        return this.formatSnapshot(cached);
      }
    }

    // 2. Live calculation (also saves to snapshot table)
    return this.refreshMarketSnapshot(city, state);
  }

  private formatSnapshot(s: MarketSnapshot) {
    const medPsf   = Math.round(Number(s.medianPsf  ?? s.avgPsf));
    const medPrice = Math.round(Number(s.medianPrice ?? s.avgPrice));
    const medRent  = Math.round(Number(s.medianRent  ?? s.avgMonthlyRent));

    // rentYield/buySavingsPct stored as 0 in DB when null — restore null for UI
    const rawRentYield    = Number(s.rentYield);
    const rawBuySavings   = Number(s.buySavingsPct);
    const rentYield       = rawRentYield    > 0 ? Math.round(rawRentYield    * 10) / 10 : null;
    const buySavingsPct   = rawBuySavings   > 0 ? Math.round(rawBuySavings   * 10) / 10 : null;

    const psfCount        = s.listingCount ?? 0;
    const confidenceLabel = confidenceLabelFromCount(psfCount);

    return {
      city:               s.city,
      state:              s.state,
      // Sale metrics
      avgPricePerSqft:    medPsf,
      medianPricePerSqft: medPsf,
      avgPrice:           medPrice,
      medianPrice:        medPrice,
      minPrice:           Math.round(Number(s.minPrice)),
      maxPrice:           Math.round(Number(s.maxPrice)),
      // Indian rupee formatted
      avgPricePerSqftFormatted: medPsf   > 0 ? `₹${medPsf.toLocaleString('en-IN')}/sqft` : 'No Data',
      avgPriceFormatted:        medPrice > 0 ? formatINR(medPrice) : 'No Data',
      minPriceFormatted:        Number(s.minPrice) > 0 ? formatINR(Number(s.minPrice)) : 'No Data',
      maxPriceFormatted:        Number(s.maxPrice) > 0 ? formatINR(Number(s.maxPrice)) : 'No Data',
      // Data validity
      insufficientData:   psfCount < MIN_PSF_LISTINGS,
      lowConfidence:      psfCount < MIN_PSF_LISTINGS,
      psfListingCount:    psfCount,
      listingCount:       psfCount,
      totalListingCount:  s.totalListingCount,
      trend:              s.trend,
      trendPct:           Math.round(Number(s.trendPct) * 10) / 10,
      // Rent metrics (null = no real data)
      avgMonthlyRent:     medRent,
      medianRent:         medRent,
      avgMonthlyRentFormatted: medRent > 0 ? formatINR(medRent) : 'No Data',
      avgRentPsf:         Math.round(Number(s.avgRentPsf ?? 0)),
      rentYield,          // null when stored value is 0 (= no data)
      buySavingsPct,      // null when stored value is 0 (= no data)
      // Localities + trend data
      localities:         s.topLocalities || [],
      priceTrend:         s.priceTrend || [],
      // Data quality
      confidenceScore:    s.confidenceScore ?? 0,
      dataQuality:        s.dataQuality ?? 'low',
      confidenceLabel,
      priceType:          s.priceType ?? 'Indicative Listing Price',
      dataWindow:         '90d',
      // Smart insights
      smartInsights:      s.smartInsights || [],
      lastUpdated:        s.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  // ─── Core computation: market-grade snapshot ──────────────────────────────
  //
  // Improvements over basic AVG:
  //  1. Median (P50) instead of AVG — resistant to luxury-listing skew
  //  2. Outlier filtering — PSF 200–150k, price 1L–50Cr, rent 1k–50L
  //  3. Freshness weighting — weight = 1/(days_old+1)
  //  4. Separate sale & rent pipelines — never mixed
  //  5. Smart locality ranking — PSF growth + rent yield + volume
  //  6. City-specific economic models — not generic 7%/5%
  //  7. Confidence scoring — count + variance + recency
  //  8. P10/P90 price range — outlier-safe min/max
  async refreshMarketSnapshot(
    city?:  string,
    state?: string,
  ) {
    const since90d = new Date(Date.now() -  90 * 24 * 60 * 60 * 1000);
    const prev90d  = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const since30d = new Date(Date.now() -  30 * 24 * 60 * 60 * 1000);

    // ── Location filter ──────────────────────────────────────────────────────
    const locParts: string[] = [];
    const locParams: any[]   = [];
    if (city)       { locParts.push('LOWER(p.city) = LOWER(?)');  locParams.push(city); }
    else if (state) { locParts.push('LOWER(p.state) = LOWER(?)'); locParams.push(state); }
    const locWhere = locParts.length ? locParts.join(' AND ') : '1=1';

    // ── City-specific economic model ─────────────────────────────────────────
    const cityKey = (city || state || '').toLowerCase().trim();
    const { appreciation, rentGrowth } = CITY_MODELS[cityKey] || DEFAULT_CITY_MODEL;

    // ── Base conditions string (reused across queries) ───────────────────────
    const BASE_WHERE = `p.approvalStatus = 'approved' AND p.status = 'active' AND p.isDraft = 0`;

    // ── 1. Weighted sale + rent stats (outlier-filtered, freshness-weighted) ─
    // Inner subquery: compute psf, price, rent, freshness weight per row.
    // Outer query: aggregate with outlier bounds using CASE guards.
    // rent_psf is included here so rentPsfCount drives rent yield gating.
    const [saleStats]: any[] = await this.dataSource.query(`
      SELECT
        /* ── Sale PSF (outlier-filtered, freshness-weighted) ── */
        SUM(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN psf * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN w ELSE 0 END), 0)
                                                       AS weightedPsf,
        COUNT(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN 1 END)
                                                       AS psfCount,
        STDDEV(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN psf END)
                                                       AS psfStddev,

        /* ── Sale price (outlier-filtered, freshness-weighted) ── */
        SUM(CASE WHEN price BETWEEN ${PRICE_MIN} AND ${PRICE_MAX} THEN price * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN price BETWEEN ${PRICE_MIN} AND ${PRICE_MAX} THEN w ELSE 0 END), 0)
                                                       AS weightedPrice,
        COUNT(CASE WHEN price BETWEEN ${PRICE_MIN} AND ${PRICE_MAX} THEN 1 END)
                                                       AS priceCount,

        /* ── Rent (outlier-filtered, freshness-weighted) ── */
        SUM(CASE WHEN rent BETWEEN ${RENT_MIN} AND ${RENT_MAX} THEN rent * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN rent BETWEEN ${RENT_MIN} AND ${RENT_MAX} THEN w ELSE 0 END), 0)
                                                       AS weightedRent,
        COUNT(CASE WHEN rent BETWEEN ${RENT_MIN} AND ${RENT_MAX} THEN 1 END)
                                                       AS rentCount,

        /* ── Rent PSF count (gating rent metrics) ── */
        COUNT(CASE WHEN rent_psf BETWEEN ${RENT_PSF_MIN} AND ${RENT_PSF_MAX} THEN 1 END)
                                                       AS rentPsfCount,

        /* ── Totals ── */
        COUNT(*)                                       AS totalCount,
        SUM(isRecent)                                  AS recentCount,
        /* ── Skipped (NULL psf) count for debug logging ── */
        COUNT(CASE WHEN psf IS NULL THEN 1 END)        AS skippedCount
      FROM (
        SELECT
          ${BUY_PSF_SQL}                                              AS psf,
          ${RENT_PSF_SQL}                                             AS rent_psf,
          ${SALE_PRICE_SQL}                                           AS price,
          ${RENT_PRICE_SQL}                                           AS rent,
          1.0 / (DATEDIFF(NOW(), p.createdAt) + 1)                   AS w,
          CASE WHEN p.createdAt >= ? THEN 1 ELSE 0 END               AS isRecent
        FROM properties p
        WHERE ${BASE_WHERE} AND ${locWhere} AND p.createdAt >= ?
      ) enriched
    `, [since30d, ...locParams, since90d]);

    // ── 2. Median PSF — P50 via ROW_NUMBER window function (MySQL 8+) ────────
    const [medPsfRow]: any[] = await this.dataSource.query(`
      SELECT AVG(psf) AS medianPsf
      FROM (
        SELECT
          psf,
          ROW_NUMBER() OVER (ORDER BY psf)  AS rn,
          COUNT(*)     OVER ()              AS total
        FROM (
          SELECT ${BUY_PSF_SQL} AS psf
          FROM properties p
          WHERE ${BASE_WHERE} AND ${locWhere} AND p.createdAt >= ?
        ) raw
        WHERE psf IS NOT NULL AND psf BETWEEN ${PSF_MIN} AND ${PSF_MAX}
      ) windowed
      WHERE rn IN (FLOOR((total + 1.0) / 2), CEIL((total + 1.0) / 2))
    `, [...locParams, since90d]);

    // ── 3. Median Sale Price ──────────────────────────────────────────────────
    const [medPriceRow]: any[] = await this.dataSource.query(`
      SELECT AVG(price) AS medianPrice
      FROM (
        SELECT
          price,
          ROW_NUMBER() OVER (ORDER BY price) AS rn,
          COUNT(*)     OVER ()               AS total
        FROM (
          SELECT ${SALE_PRICE_SQL} AS price
          FROM properties p
          WHERE ${BASE_WHERE} AND ${locWhere} AND p.createdAt >= ?
        ) raw
        WHERE price IS NOT NULL AND price BETWEEN ${PRICE_MIN} AND ${PRICE_MAX}
      ) windowed
      WHERE rn IN (FLOOR((total + 1.0) / 2), CEIL((total + 1.0) / 2))
    `, [...locParams, since90d]);

    // ── 4. Median Monthly Rent ────────────────────────────────────────────────
    const [medRentRow]: any[] = await this.dataSource.query(`
      SELECT AVG(rent) AS medianRent
      FROM (
        SELECT
          rent,
          ROW_NUMBER() OVER (ORDER BY rent) AS rn,
          COUNT(*)     OVER ()              AS total
        FROM (
          SELECT ${RENT_PRICE_SQL} AS rent
          FROM properties p
          WHERE ${BASE_WHERE} AND ${locWhere} AND p.createdAt >= ?
        ) raw
        WHERE rent IS NOT NULL AND rent BETWEEN ${RENT_MIN} AND ${RENT_MAX}
      ) windowed
      WHERE rn IN (FLOOR((total + 1.0) / 2), CEIL((total + 1.0) / 2))
    `, [...locParams, since90d]);

    // ── 5. P10/P90 price range (outlier-safe bounds) ──────────────────────────
    const [priceRange]: any[] = await this.dataSource.query(`
      SELECT
        MIN(CASE WHEN rn >= FLOOR(total * 0.10) AND rn <= CEIL(total * 0.10) THEN price END) AS p10,
        MAX(CASE WHEN rn >= FLOOR(total * 0.90) AND rn <= CEIL(total * 0.90) THEN price END) AS p90
      FROM (
        SELECT
          price,
          ROW_NUMBER() OVER (ORDER BY price) AS rn,
          COUNT(*)     OVER ()               AS total
        FROM (
          SELECT ${SALE_PRICE_SQL} AS price
          FROM properties p
          WHERE ${BASE_WHERE} AND ${locWhere} AND p.createdAt >= ?
        ) raw
        WHERE price IS NOT NULL AND price BETWEEN ${PRICE_MIN} AND ${PRICE_MAX}
      ) ranked
    `, [...locParams, since90d]);

    // ── 6. Previous-period weighted PSF + count (for trend validation) ──────────
    // prevPsfCount gates trend calculation — need >= 3 in BOTH windows
    const [prevStats]: any[] = await this.dataSource.query(`
      SELECT
        SUM(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN psf * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN w ELSE 0 END), 0)
                                                       AS weightedPsf,
        COUNT(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN 1 END)
                                                       AS prevPsfCount
      FROM (
        SELECT
          ${BUY_PSF_SQL}                              AS psf,
          1.0 / (DATEDIFF(NOW(), p.createdAt) + 1)   AS w
        FROM properties p
        WHERE ${BASE_WHERE} AND ${locWhere}
          AND p.createdAt BETWEEN ? AND ?
      ) prev_enriched
    `, [...locParams, prev90d, since90d]);

    // ── 7. Locality stats — current 90d (includes rent PSF) ─────────────────
    const localityCurrent: any[] = await this.dataSource.query(`
      SELECT
        locality,
        COUNT(*)                                                                AS listingCount,
        COUNT(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN 1 END)      AS psfCount,
        COUNT(CASE WHEN rent_psf BETWEEN ${RENT_PSF_MIN} AND ${RENT_PSF_MAX} THEN 1 END) AS rentPsfCount,
        SUM(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN psf * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN w ELSE 0 END), 0)
                                                                                AS medianPsf,
        SUM(CASE WHEN rent_psf BETWEEN ${RENT_PSF_MIN} AND ${RENT_PSF_MAX} THEN rent_psf * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN rent_psf BETWEEN ${RENT_PSF_MIN} AND ${RENT_PSF_MAX} THEN w ELSE 0 END), 0)
                                                                                AS avgRentPsf,
        SUM(CASE WHEN price BETWEEN ${PRICE_MIN} AND ${PRICE_MAX} THEN price * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN price BETWEEN ${PRICE_MIN} AND ${PRICE_MAX} THEN w ELSE 0 END), 0)
                                                                                AS avgBuyPrice,
        SUM(CASE WHEN rent BETWEEN ${RENT_MIN} AND ${RENT_MAX} THEN rent * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN rent BETWEEN ${RENT_MIN} AND ${RENT_MAX} THEN w ELSE 0 END), 0)
                                                                                AS avgRent
      FROM (
        SELECT
          p.locality,
          ${BUY_PSF_SQL}                                                        AS psf,
          ${RENT_PSF_SQL}                                                        AS rent_psf,
          ${SALE_PRICE_SQL}                                                      AS price,
          ${RENT_PRICE_SQL}                                                      AS rent,
          1.0 / (DATEDIFF(NOW(), p.createdAt) + 1)                              AS w
        FROM properties p
        WHERE ${BASE_WHERE} AND ${locWhere}
          AND p.locality IS NOT NULL AND p.locality != ''
          AND p.createdAt >= ?
      ) loc_enriched
      GROUP BY locality
      HAVING listingCount >= ${MIN_LOCALITY_LISTINGS}
    `, [...locParams, since90d]);

    // ── 8. Locality stats — previous 90d (sale PSF + rent PSF for trends) ───
    // prevPsfCount per locality allows gating: trend only shown if prev >= 3
    const localityPrev: any[] = await this.dataSource.query(`
      SELECT
        locality,
        COUNT(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN 1 END)
                                                        AS prevPsfCount,
        SUM(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN psf * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN w ELSE 0 END), 0)
                                                        AS medianPsf,
        SUM(CASE WHEN rent_psf BETWEEN ${RENT_PSF_MIN} AND ${RENT_PSF_MAX} THEN rent_psf * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN rent_psf BETWEEN ${RENT_PSF_MIN} AND ${RENT_PSF_MAX} THEN w ELSE 0 END), 0)
                                                        AS prevRentPsf
      FROM (
        SELECT
          p.locality,
          ${BUY_PSF_SQL}                               AS psf,
          ${RENT_PSF_SQL}                              AS rent_psf,
          1.0 / (DATEDIFF(NOW(), p.createdAt) + 1)    AS w
        FROM properties p
        WHERE ${BASE_WHERE} AND ${locWhere}
          AND p.locality IS NOT NULL AND p.locality != ''
          AND p.createdAt BETWEEN ? AND ?
      ) prev_loc
      GROUP BY locality
    `, [...locParams, prev90d, since90d]);

    // ── 9. 6-month monthly price trend ───────────────────────────────────────
    const monthlyTrend: any[] = await this.dataSource.query(`
      SELECT
        DATE_FORMAT(createdAt, '%b %y')            AS month,
        YEAR(createdAt) * 100 + MONTH(createdAt) AS sortKey,
        COUNT(*)                                      AS totalCount,
        COUNT(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN 1 END)          AS saleCount,
        AVG(CASE WHEN psf BETWEEN ${PSF_MIN} AND ${PSF_MAX} THEN psf END)           AS avgSalePsf,
        COUNT(CASE WHEN rent_psf BETWEEN ${RENT_PSF_MIN} AND ${RENT_PSF_MAX} THEN 1 END) AS rentCount,
        AVG(CASE WHEN rent_psf BETWEEN ${RENT_PSF_MIN} AND ${RENT_PSF_MAX} THEN rent_psf END) AS avgRentPsf
      FROM (
        SELECT
          p.createdAt,
          ${BUY_PSF_SQL}   AS psf,
          ${RENT_PSF_SQL}  AS rent_psf
        FROM properties p
        WHERE ${BASE_WHERE} AND ${locWhere}
          AND p.createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      ) monthly_enriched
      GROUP BY month, sortKey
      ORDER BY sortKey ASC
    `, [...locParams]);

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPUTE METRICS
    // ═══════════════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════════
    // EXTRACT RAW COUNTS — gates all downstream calculations
    // ═══════════════════════════════════════════════════════════════════════════
    const psfCount      = parseInt(saleStats?.psfCount)     || 0;
    const rentPsfCount  = parseInt(saleStats?.rentPsfCount) || 0;
    const priceCount    = parseInt(saleStats?.priceCount)   || 0;
    const totalCount    = parseInt(saleStats?.totalCount)   || 0;
    const recentCount   = parseInt(saleStats?.recentCount)  || 0;
    const skippedCount  = parseInt(saleStats?.skippedCount) || 0;
    const prevPsfCount  = parseInt(prevStats?.prevPsfCount) || 0;
    const psfStddev     = parseFloat(saleStats?.psfStddev)  || 0;

    // ── Debug log: data quality inputs ───────────────────────────────────────
    this.logger.log(
      `[MarketSnapshot:${city || state || 'ALL'}] ` +
      `psfCount=${psfCount} rentPsfCount=${rentPsfCount} prevPsfCount=${prevPsfCount} ` +
      `totalCount=${totalCount} recentCount=${recentCount} skippedCount=${skippedCount}`,
    );

    // ── Median PSF — ONLY if >= MIN_PSF_LISTINGS valid listings ──────────────
    // Fallback chain: Median P50 → weighted avg → 0 (no fake data)
    const rawMedianPsf    = parseFloat(medPsfRow?.medianPsf)      || 0;
    const rawWeightedPsf  = parseFloat(saleStats?.weightedPsf)    || 0;
    const medianPsf = psfCount >= MIN_PSF_LISTINGS
      ? (rawMedianPsf || rawWeightedPsf)
      : 0;  // ← insufficient data: do NOT show PSF

    if (psfCount < MIN_PSF_LISTINGS) {
      this.logger.warn(
        `[MarketSnapshot:${city || state || 'ALL'}] ` +
        `Insufficient PSF data (${psfCount}/${MIN_PSF_LISTINGS} required) — PSF suppressed`,
      );
    }

    // ── Median price ─────────────────────────────────────────────────────────
    const rawMedianPrice   = parseFloat(medPriceRow?.medianPrice)   || 0;
    const rawWeightedPrice = parseFloat(saleStats?.weightedPrice)   || 0;
    const medianPrice = priceCount >= MIN_PSF_LISTINGS
      ? (rawMedianPrice || rawWeightedPrice)
      : 0;

    // ── Median rent — ONLY if >= MIN_RENT_LISTINGS valid rent listings ────────
    const rawMedianRent   = parseFloat(medRentRow?.medianRent)   || 0;
    const rawWeightedRent = parseFloat(saleStats?.weightedRent)  || 0;
    const medianRent = rentPsfCount >= MIN_RENT_LISTINGS
      ? (rawMedianRent || rawWeightedRent)
      : 0;  // ← insufficient data: do NOT show rent

    if (rentPsfCount < MIN_RENT_LISTINGS) {
      this.logger.warn(
        `[MarketSnapshot:${city || state || 'ALL'}] ` +
        `Insufficient rent data (${rentPsfCount}/${MIN_RENT_LISTINGS} required) — rent metrics suppressed`,
      );
    }

    this.logger.log(
      `[MarketSnapshot:${city || state || 'ALL'}] ` +
      `medianPsf=${medianPsf} medianPrice=${medianPrice} medianRent=${medianRent}`,
    );

    // ── P10/P90 price range ───────────────────────────────────────────────────
    const p10Price = parseFloat(priceRange?.p10) || (medianPrice > 0 ? medianPrice * 0.7 : 0);
    const p90Price = parseFloat(priceRange?.p90) || (medianPrice > 0 ? medianPrice * 1.5 : 0);

    // ── Trend — ONLY if BOTH periods have >= MIN_TREND_LISTINGS ──────────────
    // 'insufficient_data' replaces fake 'stable' when data is too thin
    const prevPsf = parseFloat(prevStats?.weightedPsf) || 0;
    let trendPct = 0;
    let trend: 'up' | 'down' | 'stable' | 'insufficient_data' = 'insufficient_data';

    if (psfCount >= MIN_TREND_LISTINGS && prevPsfCount >= MIN_TREND_LISTINGS
        && prevPsf > 0 && medianPsf > 0) {
      trendPct = Math.round(((medianPsf - prevPsf) / prevPsf) * 1000) / 10;
      trend = trendPct > 1.5 ? 'up' : trendPct < -1.5 ? 'down' : 'stable';
    } else {
      this.logger.warn(
        `[MarketSnapshot:${city || state || 'ALL'}] ` +
        `Insufficient trend data (cur=${psfCount}, prev=${prevPsfCount}) — trend='insufficient_data'`,
      );
    }

    // ── Rent yield — ONLY when BOTH real medianRent AND medianPrice exist ─────
    // Removed: default 3.2 fallback — that was misleading fake data
    const rentYield: number | null = medianRent > 0 && medianPrice > 0
      ? Math.min(15, Math.max(1, Math.round((medianRent * 12 / medianPrice) * 1000) / 10))
      : null;

    // ── Buy-vs-rent 10-year estimate with city-specific model ─────────────────
    // null when insufficient data (not a fake 20% default)
    let buySavingsPct: number | null = null;
    if (medianRent > 0 && medianPrice > 0) {
      const totalRent10yr   = medianRent * 12 * ((Math.pow(1 + rentGrowth, 10) - 1) / rentGrowth);
      const propertyVal10yr = medianPrice * Math.pow(1 + appreciation, 10);
      const ownershipCost   = medianPrice * 0.12; // stamp duty + registration + maintenance
      const netGain         = propertyVal10yr - medianPrice - ownershipCost;
      const savings         = (netGain / totalRent10yr) * 100;
      buySavingsPct         = Math.max(5, Math.min(45, Math.round(savings * 10) / 10));
    }

    this.logger.log(
      `[MarketSnapshot:${city || state || 'ALL'}] ` +
      `trend=${trend} trendPct=${trendPct} rentYield=${rentYield} buySavingsPct=${buySavingsPct}`,
    );

    // ── Confidence score (enhanced: count + variance + recency) ──────────────
    // Count score: 0–40 pts (max at 50 listings)
    const countScore    = Math.min(40, (psfCount / 50) * 40);
    // Variance score: 0–40 pts (CV = stddev/mean; CV < 0.3 = max; CV > 1.5 = 0)
    const cv            = medianPsf > 0 ? psfStddev / medianPsf : 1.5;
    const varianceScore = Math.max(0, Math.min(40, ((1.5 - cv) / 1.5) * 40));
    // Recency score: 0–20 pts (proportion of listings in last 30d)
    const recencyScore  = totalCount > 0 ? Math.min(20, (recentCount / totalCount) * 20) : 0;
    const confidenceScore = Math.round(countScore + varianceScore + recencyScore);
    const dataQuality = confidenceScore >= 70 ? 'high' : confidenceScore >= 40 ? 'medium' : 'low';
    const confidenceLabel = confidenceLabelFromCount(psfCount);

    // ── Load circle rates for this city ──────────────────────────────────────
    const circleRateRows = city
      ? await this.circleRateRepo.find({ where: { city } as any })
      : [];
    const circleRateMap = new Map<string, number>(
      circleRateRows.map((r) => [r.locality.toLowerCase(), parseFloat(r.circleRate as any) || 0]),
    );

    // ── Locality smart ranking (now includes rent PSF + circle rate) ──────────
    const prevLocMap = new Map<string, { psf: number; rentPsf: number; psfCount: number }>(
      localityPrev.map((r: any) => [
        r.locality as string,
        {
          psf:      parseFloat(r.medianPsf)    || 0,
          rentPsf:  parseFloat(r.prevRentPsf)  || 0,
          psfCount: parseInt(r.prevPsfCount)   || 0,
        },
      ]),
    );

    const localities = localityCurrent
      .map((r: any) => {
        const count      = parseInt(r.listingCount)   || 0;
        const psfCnt     = parseInt(r.psfCount)       || 0;
        const rentCnt    = parseInt(r.rentPsfCount)   || 0;
        const locRent    = parseFloat(r.avgRent)      || 0;
        const locPrice   = parseFloat(r.avgBuyPrice)  || 0;

        // ── Low-confidence flag: < MIN_LOCALITY_LISTINGS total OR < 3 valid PSF
        const lowConfidence = count < MIN_LOCALITY_LISTINGS || psfCnt < MIN_PSF_LISTINGS;

        // ── PSF only when sufficient listings — else 0 (not shown in UI)
        const currPsf     = psfCnt  >= MIN_PSF_LISTINGS  ? (parseFloat(r.medianPsf)  || 0) : 0;
        const currRentPsf = rentCnt >= MIN_RENT_LISTINGS ? (parseFloat(r.avgRentPsf) || 0) : 0;

        const prevData = prevLocMap.get(r.locality as string)
          || { psf: 0, rentPsf: 0, psfCount: 0 };

        // ── Sale PSF trend — only when BOTH periods have enough data
        let localTrend: 'up' | 'down' | 'stable' | 'insufficient_data' = 'insufficient_data';
        let psfGrowthPct = 0;
        if (!lowConfidence && prevData.psfCount >= MIN_TREND_LISTINGS
            && prevData.psf > 0 && currPsf > 0) {
          psfGrowthPct = ((currPsf - prevData.psf) / prevData.psf) * 100;
          localTrend = psfGrowthPct > 1.5 ? 'up' : psfGrowthPct < -1.5 ? 'down' : 'stable';
        }

        // ── Rent PSF trend
        let rentTrend: 'up' | 'down' | 'stable' | 'insufficient_data' = 'insufficient_data';
        if (prevData.rentPsf > 0 && currRentPsf > 0) {
          const rentGrowthPct = ((currRentPsf - prevData.rentPsf) / prevData.rentPsf) * 100;
          rentTrend = rentGrowthPct > 1.5 ? 'up' : rentGrowthPct < -1.5 ? 'down' : 'stable';
        }

        // ── Circle rate + premium — null when circleRate = 0 OR insufficient PSF data
        const circleRate   = circleRateMap.get((r.locality as string).toLowerCase()) || 0;
        const pricePremium = circleRate > 0 && psfCnt >= MIN_PSF_LISTINGS && currPsf > 0
          ? Math.round(((currPsf - circleRate) / circleRate) * 100 * 10) / 10
          : null;  // ← was 0 — null means "no data" not "0% premium"

        // ── Rent yield — null when real data not available
        const localRentYield: number | null = locRent > 0 && locPrice > 0
          ? Math.min(20, (locRent * 12 / locPrice) * 100)
          : currRentPsf > 0 && currPsf > 0
            ? Math.min(20, (currRentPsf * 12 / currPsf) * 100)
            : null;  // ← was 0 — null means "no data"

        // ── Smart rank score: PSF growth 40% + rent yield 30% + volume 30%
        // Low-confidence localities get zero rank score (excluded from top 10)
        const psfGrowthNorm = Math.max(0, Math.min(1, psfGrowthPct / 20));
        const rentYieldNorm = Math.max(0, Math.min(1, (localRentYield ?? 0) / 15));
        const volumeNorm    = Math.min(1, Math.log(count + 1) / Math.log(20));
        const rankScore     = lowConfidence ? 0
          : psfGrowthNorm * 0.4 + rentYieldNorm * 0.3 + volumeNorm * 0.3;

        // ── Confidence label for UI
        const locConfidenceLabel = confidenceLabelFromCount(count);

        // ── Formatted values for direct UI display
        const medianPsfFormatted  = currPsf > 0
          ? `₹${Math.round(currPsf).toLocaleString('en-IN')}/sqft` : 'No Data';
        const avgBuyPriceFormatted = locPrice > 0 ? formatINR(locPrice) : 'No Data';
        const avgRentFormatted     = locRent  > 0 ? formatINR(locRent)  : 'No Data';

        this.logger.debug(
          `[Locality:${r.locality}] count=${count} psfCount=${psfCnt} rentCount=${rentCnt} ` +
          `medianPsf=${currPsf} rentPsf=${currRentPsf} trend=${localTrend} ` +
          `lowConfidence=${lowConfidence} rankScore=${rankScore.toFixed(3)}`,
        );

        return {
          name:                  r.locality as string,
          medianPsf:             Math.round(currPsf),
          medianPsfFormatted,
          rentPsf:               Math.round(currRentPsf),
          avgBuyPrice:           Math.round(locPrice),
          avgBuyPriceFormatted,
          avgRent:               Math.round(locRent),
          avgRentFormatted,
          listingCount:          count,
          psfCount:              psfCnt,
          rentListingCount:      rentCnt,
          trend:                 localTrend,
          rentTrend,
          rentYield:             localRentYield !== null ? Math.round(localRentYield * 10) / 10 : null,
          circleRate:            Math.round(circleRate),
          pricePremium,                  // null = no circle rate or insufficient data
          rankScore:             Math.round(rankScore * 1000) / 1000,
          lowConfidence,                 // true = < 3 listings, don't show in rankings
          confidenceLabel:       locConfidenceLabel,
        };
      })
      // ── Filter for top rankings: exclude low-confidence localities
      // (they appear in the raw list but are sorted to the bottom)
      .filter((r: any) => !r.lowConfidence && (r.medianPsf > 0 || r.avgRent > 0 || r.rentPsf > 0))
      // Sort by smart rank score (descending)
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 10);

    // ── 6-month price trend ───────────────────────────────────────────────────
    const priceTrend = monthlyTrend.map((r: any) => ({
      month:        r.month as string,
      avgSalePsf:   Math.round(parseFloat(r.avgSalePsf) || 0),
      avgRentPsf:   Math.round(parseFloat(r.avgRentPsf) || 0),
      listingCount: parseInt(r.saleCount) || 0,
      rentCount:    parseInt(r.rentCount) || 0,
    }));

    // ── City-level rent PSF (weighted avg across all localities) ─────────────
    const [rentPsfRow]: any[] = await this.dataSource.query(`
      SELECT
        SUM(CASE WHEN rent_psf BETWEEN ${RENT_PSF_MIN} AND ${RENT_PSF_MAX} THEN rent_psf * w ELSE 0 END) /
          NULLIF(SUM(CASE WHEN rent_psf BETWEEN ${RENT_PSF_MIN} AND ${RENT_PSF_MAX} THEN w ELSE 0 END), 0)
          AS avgRentPsf
      FROM (
        SELECT
          ${RENT_PSF_SQL}                             AS rent_psf,
          1.0 / (DATEDIFF(NOW(), p.createdAt) + 1)   AS w
        FROM properties p
        WHERE ${BASE_WHERE} AND ${locWhere} AND p.createdAt >= ?
      ) r
    `, [...locParams, since90d]);
    // Only show city rent PSF when we have enough rent listings
    const rawCityRentPsf = parseFloat(rentPsfRow?.avgRentPsf) || 0;
    const cityAvgRentPsf = rentPsfCount >= MIN_RENT_LISTINGS ? Math.round(rawCityRentPsf) : 0;

    // ── Smart AI Insights ─────────────────────────────────────────────────────
    const smartInsights = this.generateSmartInsights({
      city: city || state || 'this city',
      medianPsf,
      medianRent,
      cityAvgRentPsf,
      trend,
      trendPct,
      rentYield,
      buySavingsPct,
      localities,
      confidenceScore,
      dataQuality,
    });

    // ── Build result ──────────────────────────────────────────────────────────
    const result = {
      city:               city  || null,
      state:              state || null,

      // ── Sale metrics (median P50 · outlier-filtered · >= 5 listings required)
      avgPricePerSqft:    Math.round(medianPsf),
      medianPricePerSqft: Math.round(medianPsf),
      avgPrice:           Math.round(medianPrice),
      medianPrice:        Math.round(medianPrice),
      minPrice:           Math.round(p10Price),
      maxPrice:           Math.round(p90Price),

      // ── Indian rupee formatted display strings
      avgPricePerSqftFormatted: medianPsf   > 0 ? `₹${Math.round(medianPsf).toLocaleString('en-IN')}/sqft` : 'No Data',
      avgPriceFormatted:        medianPrice > 0 ? formatINR(medianPrice) : 'No Data',
      minPriceFormatted:        p10Price    > 0 ? formatINR(p10Price)    : 'No Data',
      maxPriceFormatted:        p90Price    > 0 ? formatINR(p90Price)    : 'No Data',

      // ── Data validity flags
      insufficientData:   psfCount < MIN_PSF_LISTINGS,
      lowConfidence:      psfCount < MIN_PSF_LISTINGS,
      psfListingCount:    psfCount,
      rentListingCount:   rentPsfCount,

      listingCount:       psfCount,
      totalListingCount:  totalCount,
      trend,
      trendPct:           Math.abs(trendPct),

      // ── Rent metrics (null = no data — not fake defaults)
      avgMonthlyRent:     Math.round(medianRent),
      medianRent:         Math.round(medianRent),
      avgMonthlyRentFormatted: medianRent > 0 ? formatINR(medianRent) : 'No Data',
      avgRentPsf:         cityAvgRentPsf,
      rentYield,           // null when insufficient data (was: 3.2 default)
      buySavingsPct,       // null when insufficient data (was: 20 default)

      // ── Locality + trend data
      localities,
      priceTrend,

      // ── Data quality
      confidenceScore,
      dataQuality,
      confidenceLabel,     // 'High' | 'Medium' | 'Low'
      priceType:           'Indicative Listing Price',
      dataWindow:          '90d',

      // ── Smart insights
      smartInsights,
      lastUpdated:         new Date().toISOString(),
    };

    // ── Persist to snapshot cache ─────────────────────────────────────────────
    if (city || state) {
      try {
        const existing = city
          ? await this.snapshotRepo.findOne({ where: { city, propertyType: null as any, listingType: null as any } as any })
          : await this.snapshotRepo.findOne({ where: { state, city: null as any, propertyType: null as any, listingType: null as any } as any });

        const entity = existing || this.snapshotRepo.create({ city: city || null, state: state || null });
        entity.avgPsf            = medianPsf;
        entity.medianPsf         = medianPsf;
        entity.prevAvgPsf        = prevPsf;
        entity.trend             = trend as any;
        entity.trendPct          = Math.abs(trendPct);
        entity.avgPrice          = medianPrice;
        entity.medianPrice       = medianPrice;
        entity.minPrice          = p10Price;
        entity.maxPrice          = p90Price;
        entity.listingCount      = psfCount;
        entity.totalListingCount = totalCount;
        entity.avgMonthlyRent    = medianRent;
        entity.medianRent        = medianRent;
        entity.avgRentPsf        = cityAvgRentPsf;
        entity.rentYield         = rentYield    ?? 0;
        entity.buySavingsPct     = buySavingsPct ?? 0;
        entity.topLocalities     = localities;
        entity.byType            = {};
        entity.priceTrend        = priceTrend;
        entity.smartInsights     = smartInsights;
        entity.confidenceScore   = confidenceScore;
        entity.dataQuality       = dataQuality;
        entity.priceType         = 'Indicative Listing Price';
        entity.propertyType      = null;
        entity.listingType       = null;
        await this.snapshotRepo.save(entity);
      } catch (e) {
        this.logger.warn('Failed to save market snapshot', e);
      }
    }

    return result;
  }

  // ─── Bulk refresh one snapshot per city (all types combined) ────────────────
  async refreshAllMarketSnapshots() {
    this.logger.log('Refreshing market snapshots (one per city)…');
    // Remove legacy segmented rows (propertyType/listingType no longer used)
    await this.dataSource.query(
      `DELETE FROM market_snapshots WHERE propertyType IS NOT NULL OR listingType IS NOT NULL`,
    );
    const cities: any[] = await this.dataSource.query(`
      SELECT DISTINCT city, state
      FROM properties
      WHERE approvalStatus = 'approved' AND status = 'active' AND isDraft = 0
        AND city IS NOT NULL AND city != ''
      ORDER BY city
    `);

    let refreshed = 0;
    for (const row of cities) {
      try {
        await this.refreshMarketSnapshot(row.city, row.state);
        refreshed++;
      } catch (e) {
        this.logger.warn(`Snapshot refresh failed for ${row.city}`, e);
      }
    }
    this.logger.log(`Market snapshots refreshed: ${refreshed}/${cities.length}`);
    return { refreshed, total: cities.length };
  }

  // ─── Admin: update snapshot metadata (isFeatured, sortOrder) ─────────────────
  async updateSnapshotMeta(id: string, dto: { isFeatured?: boolean; sortOrder?: number }) {
    const snap = await this.snapshotRepo.findOneOrFail({ where: { id } });
    if (dto.isFeatured !== undefined) snap.isFeatured = dto.isFeatured;
    if (dto.sortOrder  !== undefined) snap.sortOrder  = dto.sortOrder;
    return this.snapshotRepo.save(snap);
  }

  // ─── Admin: list all snapshots ────────────────────────────────────────────────
  async listMarketSnapshots() {
    return this.snapshotRepo.find({
      order: { isFeatured: 'DESC', sortOrder: 'ASC', totalListingCount: 'DESC' },
    });
  }

  // ─── Home API: Market Insights ───────────────────────────────────────────────
  // Dynamically generates 5 data-driven insights based on real property & inquiry data

  async getMarketInsights(city?: string, state?: string) {
    const since30d  = new Date(Date.now() -  30 * 24 * 60 * 60 * 1000);
    const since90d  = new Date(Date.now() -  90 * 24 * 60 * 60 * 1000);
    const prev90d   = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const since7d   = new Date(Date.now() -   7 * 24 * 60 * 60 * 1000);

    const locParts:  string[] = [];
    const locParams: any[]    = [];
    if (city) {
      locParts.push('p.city = ?');
      locParams.push(city);
    } else if (state) {
      locParts.push('p.state = ?');
      locParams.push(state);
    }
    const locWhere = locParts.length ? locParts.join(' AND ') : '1=1';

    // ── 1. Price trend ────────────────────────────────────────────────────────
    const [[currentPriceStat], [prevPriceStat]] = await Promise.all([
      this.dataSource.query(`
        SELECT AVG(CASE WHEN area > 0 THEN price / area END) AS avgPsf,
               AVG(price) AS avgPrice, COUNT(*) AS cnt
        FROM properties p
        WHERE approvalStatus = 'approved' AND status = 'active' AND isDraft = 0
          AND ${locWhere} AND createdAt >= ?
      `, [...locParams, since90d]),

      this.dataSource.query(`
        SELECT AVG(CASE WHEN area > 0 THEN price / area END) AS avgPsf, AVG(price) AS avgPrice
        FROM properties p
        WHERE approvalStatus = 'approved' AND status = 'active' AND isDraft = 0
          AND ${locWhere} AND createdAt BETWEEN ? AND ?
      `, [...locParams, prev90d, since90d]),
    ]);

    const curPsf  = parseFloat(currentPriceStat?.avgPsf)  || 0;
    const prvPsf  = parseFloat(prevPriceStat?.avgPsf)     || 0;
    const trendPct = prvPsf > 0 ? Math.round(((curPsf - prvPsf) / prvPsf) * 1000) / 10 : 0;
    const trend    = trendPct >  1 ? 'up' : trendPct < -1 ? 'down' : 'stable';
    const listingCount = parseInt(currentPriceStat?.cnt) || 0;

    // ── 2. Budget sweet spot (price band with highest listing volume) ─────────
    const budgetBands: any[] = await this.dataSource.query(`
      SELECT
        CASE
          WHEN price < 2000000   THEN 'Under 20L'
          WHEN price < 5000000   THEN '20L - 50L'
          WHEN price < 10000000  THEN '50L - 1Cr'
          WHEN price < 20000000  THEN '1Cr - 2Cr'
          ELSE 'Above 2Cr'
        END AS band,
        COUNT(*) AS cnt
      FROM properties p
      WHERE approvalStatus = 'approved' AND status = 'active' AND isDraft = 0
        AND category = 'buy' AND ${locWhere} AND createdAt >= ?
      GROUP BY band
      ORDER BY cnt DESC
      LIMIT 1
    `, [...locParams, since90d]);

    const topBand    = budgetBands[0]?.band    || '50L - 1Cr';
    const topBandCnt = parseInt(budgetBands[0]?.cnt) || 0;

    // ── 3. Top growing locality (highest PSF growth 90d vs prev 90d) ─────────
    const [growingLocality]: any[] = await this.dataSource.query(`
      SELECT
        curr.locality,
        curr.avgPsf AS currentPsf,
        COALESCE(prev.avgPsf, 0) AS prevPsf,
        CASE WHEN COALESCE(prev.avgPsf,0) > 0
          THEN (curr.avgPsf - COALESCE(prev.avgPsf,0)) / COALESCE(prev.avgPsf,1) * 100
          ELSE 0 END AS growth
      FROM (
        SELECT locality, AVG(CASE WHEN area > 0 THEN price / area END) AS avgPsf, COUNT(*) AS cnt
        FROM properties p
        WHERE approvalStatus = 'approved' AND status = 'active' AND isDraft = 0
          AND locality IS NOT NULL AND locality != '' AND ${locWhere} AND createdAt >= ?
        GROUP BY locality HAVING cnt >= 3
      ) curr
      LEFT JOIN (
        SELECT locality, AVG(CASE WHEN area > 0 THEN price / area END) AS avgPsf
        FROM properties p
        WHERE approvalStatus = 'approved' AND status = 'active' AND isDraft = 0
          AND locality IS NOT NULL AND locality != '' AND ${locWhere}
          AND createdAt BETWEEN ? AND ?
        GROUP BY locality
      ) prev ON prev.locality = curr.locality
      ORDER BY growth DESC
      LIMIT 1
    `, [...locParams, since90d, ...locParams, prev90d, since90d]);

    // ── 4. Hottest property type by 7-day inquiry count ───────────────────────
    const locInqParts:  string[] = [];
    const locInqParams: any[]    = [];
    if (city) {
      locInqParts.push('p.city = ?');
      locInqParams.push(city);
    } else if (state) {
      locInqParts.push('p.state = ?');
      locInqParams.push(state);
    }
    const locInqWhere = locInqParts.length ? `AND ${locInqParts.join(' AND ')}` : '';

    const [hotType]: any[] = await this.dataSource.query(`
      SELECT p.type, COUNT(i.id) AS inquiryCount
      FROM inquiries i
      JOIN properties p ON p.id = i.propertyId
      WHERE i.createdAt >= ? ${locInqWhere}
      GROUP BY p.type
      ORDER BY inquiryCount DESC
      LIMIT 1
    `, [since7d, ...locInqParams]);

    // ── 5. New listings velocity (30d vs prior 30d) ───────────────────────────
    const [[recentListings], [prevListings]] = await Promise.all([
      this.dataSource.query(`
        SELECT COUNT(*) AS cnt FROM properties p
        WHERE approvalStatus = 'approved' AND status = 'active' AND isDraft = 0
          AND ${locWhere} AND createdAt >= ?
      `, [...locParams, since30d]),
      this.dataSource.query(`
        SELECT COUNT(*) AS cnt FROM properties p
        WHERE approvalStatus = 'approved' AND status = 'active' AND isDraft = 0
          AND ${locWhere} AND createdAt BETWEEN ? AND ?
      `, [...locParams, new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), since30d]),
    ]);
    const recentCnt = parseInt(recentListings?.cnt) || 0;
    const prevCnt   = parseInt(prevListings?.cnt) || 0;
    const newListingGrowth = prevCnt > 0 ? Math.round(((recentCnt - prevCnt) / prevCnt) * 100) : 0;

    // ── Confidence scores (based on data volume) ──────────────────────────────
    const confFromCount = (n: number) => Math.min(95, Math.max(55, 55 + Math.log10(n + 1) * 15));

    const locationLabel = city || state || 'India';

    // ── Build insight objects ─────────────────────────────────────────────────
    const insights = [
      // 1 — Market Timing
      {
        type:       'timing',
        tag:        'Timing Alert',
        title:
          trend === 'up'
            ? `${locationLabel}: Prices Rising — Buy Before Next Quarter`
            : trend === 'down'
            ? `${locationLabel}: Price Correction — Great Buying Window`
            : `${locationLabel}: Stable Market — Low-Risk Entry Point`,
        body:
          trend === 'up'
            ? `Prices in ${locationLabel} are up ${Math.abs(trendPct)}% vs 90 days ago. Acting now locks in a lower entry price before the next appreciation cycle.`
            : trend === 'down'
            ? `Prices have softened ${Math.abs(trendPct)}% over the last quarter. This is historically the best negotiation window for buyers.`
            : `Prices in ${locationLabel} are holding steady. A stable market means lower speculation risk — ideal for end-use buyers.`,
        cta:  'Browse Properties',
        href: `/properties?category=buy${city ? `&city=${encodeURIComponent(city)}` : ''}`,
        confidence: Math.round(confFromCount(listingCount)),
        dataPoints: { trendPct, trend, listingCount },
      },

      // 2 — Budget Sweet Spot
      {
        type:       'price',
        tag:        'Budget Insight',
        title:      `${topBand}: Highest Supply in ${locationLabel}`,
        body:       `${topBandCnt} active listings fall in the ${topBand} range — the most liquid segment of the market. You have the most negotiating power here, and re-sale is easiest.`,
        cta:  `See ${topBand} Properties`,
        href: `/properties?category=buy${city ? `&city=${encodeURIComponent(city)}` : ''}`,
        confidence: Math.round(confFromCount(topBandCnt)),
        dataPoints: { topBand, topBandCnt },
      },

      // 3 — Location Intel
      {
        type:       'location',
        tag:        'Location Intel',
        title:
          growingLocality
            ? `${growingLocality.locality}: Fastest Growing Locality (${Math.round(parseFloat(growingLocality.growth) || 0)}% PSF growth)`
            : `Locality Data Analysed for ${locationLabel}`,
        body:
          growingLocality
            ? `${growingLocality.locality} has seen the strongest price-per-sqft growth (${Math.round(parseFloat(growingLocality.growth) || 0)}%) over the last 90 days. Early movers historically capture the best appreciation.`
            : `We are aggregating locality data for ${locationLabel}. Check back soon for granular locality-level insights.`,
        cta:  'Explore Localities',
        href: `/properties?category=buy${city ? `&city=${encodeURIComponent(city)}` : ''}${growingLocality ? `&locality=${encodeURIComponent(growingLocality.locality)}` : ''}`,
        confidence: growingLocality ? Math.round(confFromCount(10)) : 55,
        dataPoints: growingLocality || {},
      },

      // 4 — Investment (hottest type)
      {
        type:       'investment',
        tag:        'Investment Tip',
        title:
          hotType
            ? `${(hotType.type as string).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}: Most Inquired Type This Week`
            : 'Apartments Lead Inquiry Volume',
        body:
          hotType
            ? `${(hotType.type as string).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} properties received ${hotType.inquiryCount} inquiries in the last 7 days — the highest of any segment. Strong demand signals healthy resale liquidity.`
            : 'Apartment inquiries dominate this week. High demand in this segment signals strong rental yields and capital appreciation potential.',
        cta:  'See Top Demand',
        href: `/properties${hotType ? `?type=${hotType.type}` : ''}${city ? `${hotType ? '&' : '?'}city=${encodeURIComponent(city)}` : ''}`,
        confidence: hotType ? Math.round(confFromCount(parseInt(hotType.inquiryCount) || 5)) : 60,
        dataPoints: hotType || {},
      },

      // 5 — New Listings Velocity
      {
        type:       'type',
        tag:        'Supply Signal',
        title:
          newListingGrowth > 10
            ? `Supply Surge: ${newListingGrowth}% More Listings This Month`
            : newListingGrowth < -10
            ? `Low Inventory Alert: Listings Down ${Math.abs(newListingGrowth)}%`
            : `Steady Supply: ${recentCnt} New Listings in ${locationLabel} This Month`,
        body:
          newListingGrowth > 10
            ? `New listing volume in ${locationLabel} is up ${newListingGrowth}% vs last month. More choice means more negotiating power for buyers — ideal time to shortlist.`
            : newListingGrowth < -10
            ? `Inventory in ${locationLabel} has dropped ${Math.abs(newListingGrowth)}% month-over-month. Low supply typically drives prices up — act before competition increases.`
            : `${recentCnt} properties were newly listed this month — a healthy, balanced market with steady options. No urgency, but good deals exist.`,
        cta:  'View New Listings',
        href: `/properties?sortBy=createdAt&sortOrder=DESC${city ? `&city=${encodeURIComponent(city)}` : ''}`,
        confidence: Math.round(confFromCount(recentCnt + prevCnt)),
        dataPoints: { recentCnt, prevCnt, newListingGrowth },
      },
    ];

    return {
      city:       city  || null,
      state:      state || null,
      insights,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Aggregation: called by CronService ──────────────────────────────────────

  async aggregateCategories(): Promise<void> {
    this.logger.log('Aggregating category analytics…');

    // 7-day window
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Get all property types with listing counts from main DB
    const listingCounts: { type: string; city: string; state: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT p.type, p.city, p.state, COUNT(*) AS cnt
        FROM properties p
        WHERE p.approvalStatus = 'approved' AND p.status = 'active'
        GROUP BY p.type, p.city, p.state
      `);

    // Get 7-day view counts from analytics_events
    const viewCounts: { entityId: string; city: string; state: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT ae.metadata->>'$.propertyType' AS entityId,
               ae.city, ae.state, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'property_view'
          AND ae.createdAt >= ?
          AND ae.metadata->>'$.propertyType' IS NOT NULL
        GROUP BY ae.metadata->>'$.propertyType', ae.city, ae.state
      `, [since7d]);

    // Get 7-day search counts
    const searchCounts: { entityId: string; city: string; state: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT ae.metadata->>'$.propertyType' AS entityId,
               ae.city, ae.state, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'search_query'
          AND ae.createdAt >= ?
          AND ae.metadata->>'$.propertyType' IS NOT NULL
        GROUP BY ae.metadata->>'$.propertyType', ae.city, ae.state
      `, [since7d]);

    // Get previous 7d (14d-7d) for trending calculation
    const prevViews: { entityId: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT ae.metadata->>'$.propertyType' AS entityId, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'property_view'
          AND ae.createdAt BETWEEN ? AND ?
          AND ae.metadata->>'$.propertyType' IS NOT NULL
        GROUP BY ae.metadata->>'$.propertyType'
      `, [since14d, since7d]);

    // Load alias map + type meta from DB (dynamic, admin-configurable)
    const [aliasMap, typeMeta] = await Promise.all([this.getAliasMap(), this.getTypeMeta()]);

    // Build prevViewMap with alias resolution (canonical type → count)
    const prevViewMap = new Map<string, number>();
    for (const r of prevViews) {
      const canonical = aliasMap.get(r.entityId) ?? r.entityId;
      prevViewMap.set(canonical, (prevViewMap.get(canonical) ?? 0) + parseInt(r.cnt));
    }

    // Build a map: canonicalType+city+state → metrics (aliases merged into canonical)
    type MetricsKey = string;
    const metricsMap = new Map<MetricsKey, {
      type: string; city: string; state: string;
      listings: number; views: number; searches: number; prevViews: number;
    }>();

    const key = (type: string, city: string, state: string) =>
      `${type}|${city || ''}|${state || ''}`;

    for (const r of listingCounts) {
      const canonical = aliasMap.get(r.type) ?? r.type;
      const k = key(canonical, r.city, r.state);
      const entry = metricsMap.get(k) || { type: canonical, city: r.city, state: r.state, listings: 0, views: 0, searches: 0, prevViews: 0 };
      entry.listings += parseInt(r.cnt);
      metricsMap.set(k, entry);
    }

    for (const r of viewCounts) {
      const canonical = aliasMap.get(r.entityId) ?? r.entityId;
      const k = key(canonical, r.city, r.state);
      const entry = metricsMap.get(k) || { type: canonical, city: r.city, state: r.state, listings: 0, views: 0, searches: 0, prevViews: 0 };
      entry.views += parseInt(r.cnt);
      metricsMap.set(k, entry);
    }

    for (const r of searchCounts) {
      const canonical = aliasMap.get(r.entityId) ?? r.entityId;
      const k = key(canonical, r.city, r.state);
      const entry = metricsMap.get(k) || { type: canonical, city: r.city, state: r.state, listings: 0, views: 0, searches: 0, prevViews: 0 };
      entry.searches += parseInt(r.cnt);
      metricsMap.set(k, entry);
    }

    // Also build global (no location) aggregates
    const globalMap = new Map<string, { listings: number; views: number; searches: number }>();
    for (const [, v] of metricsMap) {
      const g = globalMap.get(v.type) || { listings: 0, views: 0, searches: 0 };
      g.listings  += v.listings;
      g.views     += v.views;
      g.searches  += v.searches;
      globalMap.set(v.type, g);
    }

    // Score + rank per location scope
    // Group by (city, state) buckets and also create empty-location global bucket
    const buckets = new Map<string, { city: string; state: string; entries: typeof metricsMap extends Map<any, infer V> ? V[] : never[] }>();

    for (const [, v] of metricsMap) {
      const bk = `${v.city || ''}|${v.state || ''}`;
      const bucket = buckets.get(bk) || { city: v.city, state: v.state, entries: [] };
      bucket.entries.push(v as any);
      buckets.set(bk, bucket as any);
    }

    // Add global bucket
    const globalEntries = Array.from(globalMap.entries()).map(([type, g]) => ({
      type, city: '', state: '', ...g, prevViews: prevViewMap.get(type) || 0,
    }));
    buckets.set('|', { city: '', state: '', entries: globalEntries as any });

    const toUpsert: Partial<CategoryAnalytics>[] = [];

    for (const [, bucket] of buckets) {
      const scored = (bucket.entries as any[]).map(e => {
        const score =
          e.listings  * W.CAT_LISTINGS  +
          e.views     * W.CAT_VIEWS     +
          e.searches  * W.CAT_SEARCHES;

        const prevV = prevViewMap.get(e.type) || 0;
        const trendingScore = prevV > 0 ? (e.views - prevV) / prevV : 0;
        const isTrending = trendingScore >= TRENDING_THRESHOLD;

        const meta = typeMeta.get(e.type) ?? { label: e.type, icon: '🏠' };

        return { ...e, score, trendingScore, isTrending, ...meta };
      }).sort((a, b) => b.score - a.score);

      scored.forEach((e, idx) => {
        toUpsert.push({
          propertyType:  e.type,
          label:         e.label,
          icon:          e.icon,
          score:         e.score,
          rank:          idx + 1,
          totalListings: e.listings,
          totalViews:    e.views,
          totalSearches: e.searches,
          totalInquiries: 0,
          totalSaves:    0,
          trendingScore: e.trendingScore,
          isTrending:    e.isTrending,
          country:       '',
          state:         bucket.state || '',
          city:          bucket.city || '',
        });
      });
    }

    if (toUpsert.length > 0) {
      // Truncate + re-insert
      await this.catRepo.query('DELETE FROM category_analytics');
      await this.catRepo.save(toUpsert as CategoryAnalytics[]);
    }

    this.logger.log(`Category analytics refreshed: ${toUpsert.length} records`);
  }

  async aggregateLocations(): Promise<void> {
    this.logger.log('Aggregating location analytics…');
    const since7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // States
    const states: any[] = await this.dataSource.query(`
      SELECT s.id, s.name, s.imageUrl, s.propertyCount,
             co.name AS countryName
      FROM states s
      LEFT JOIN countries co ON co.id = s.countryId
      WHERE s.isActive = 1
    `);

    const stateSearches: { state: string; cnt: string }[] = await this.dataSource.query(`
      SELECT ae.state, COUNT(*) AS cnt
      FROM analytics_events ae
      WHERE ae.eventType IN ('search_query','state_view')
        AND ae.createdAt >= ? AND ae.state IS NOT NULL AND ae.state != ''
      GROUP BY ae.state
    `, [since7d]);

    const stateViews: { state: string; cnt: string }[] = await this.dataSource.query(`
      SELECT ae.state, COUNT(*) AS cnt
      FROM analytics_events ae
      WHERE ae.eventType = 'property_view'
        AND ae.createdAt >= ? AND ae.state IS NOT NULL AND ae.state != ''
      GROUP BY ae.state
    `, [since7d]);

    const prevStateViews: { state: string; cnt: string }[] = await this.dataSource.query(`
      SELECT ae.state, COUNT(*) AS cnt
      FROM analytics_events ae
      WHERE ae.eventType = 'property_view'
        AND ae.createdAt BETWEEN ? AND ?
        AND ae.state IS NOT NULL AND ae.state != ''
      GROUP BY ae.state
    `, [since14d, since7d]);

    const stateSearchMap  = new Map(stateSearches.map(r  => [r.state, parseInt(r.cnt)]));
    const stateViewMap    = new Map(stateViews.map(r      => [r.state, parseInt(r.cnt)]));
    const prevStateViewMap= new Map(prevStateViews.map(r  => [r.state, parseInt(r.cnt)]));

    const stateRows: Partial<TopLocationsCache>[] = states.map(s => {
      const searches = stateSearchMap.get(s.name) || 0;
      const views    = stateViewMap.get(s.name)   || 0;
      const prevV    = prevStateViewMap.get(s.name) || 0;
      const score    = (s.propertyCount || 0) * W.LOC_PROPS + searches * W.LOC_SEARCHES + views * W.LOC_VIEWS;
      const trending = prevV > 0 ? (views - prevV) / prevV >= TRENDING_THRESHOLD : false;
      return {
        entityType: 'state',
        entityId:   s.id,
        entityName: s.name,
        parentName: s.countryName || 'India',
        imageUrl:   s.imageUrl,
        score,
        propertyCount: s.propertyCount || 0,
        searchCount:   searches,
        viewCount:     views,
        isTrending:    trending,
      };
    }).sort((a, b) => (b.score! - a.score!));

    stateRows.forEach((r, i) => { r.rank = i + 1; });

    // Cities
    const cities: any[] = await this.dataSource.query(`
      SELECT c.id, c.name, c.imageUrl, c.propertyCount,
             s.name AS stateName
      FROM cities c
      LEFT JOIN states s ON s.id = c.state_id
      WHERE c.isActive = 1
    `);

    const cityViews: { city: string; cnt: string }[] = await this.dataSource.query(`
      SELECT ae.city, COUNT(*) AS cnt
      FROM analytics_events ae
      WHERE ae.eventType = 'property_view'
        AND ae.createdAt >= ? AND ae.city IS NOT NULL AND ae.city != ''
      GROUP BY ae.city
    `, [since7d]);

    const prevCityViews: { city: string; cnt: string }[] = await this.dataSource.query(`
      SELECT ae.city, COUNT(*) AS cnt
      FROM analytics_events ae
      WHERE ae.eventType = 'property_view'
        AND ae.createdAt BETWEEN ? AND ?
        AND ae.city IS NOT NULL AND ae.city != ''
      GROUP BY ae.city
    `, [since14d, since7d]);

    const cityViewMap     = new Map(cityViews.map(r     => [r.city, parseInt(r.cnt)]));
    const prevCityViewMap = new Map(prevCityViews.map(r  => [r.city, parseInt(r.cnt)]));

    const cityRows: Partial<TopLocationsCache>[] = cities.map(c => {
      const views  = cityViewMap.get(c.name) || 0;
      const prevV  = prevCityViewMap.get(c.name) || 0;
      const score  = (c.propertyCount || 0) * W.LOC_PROPS + views * W.LOC_VIEWS;
      const trending = prevV > 0 ? (views - prevV) / prevV >= TRENDING_THRESHOLD : false;
      return {
        entityType: 'city',
        entityId:   c.id,
        entityName: c.name,
        parentName: c.stateName || '',
        imageUrl:   c.imageUrl,
        score,
        propertyCount: c.propertyCount || 0,
        searchCount:   0,
        viewCount:     views,
        isTrending:    trending,
      };
    }).sort((a, b) => b.score! - a.score!);

    cityRows.forEach((r, i) => { r.rank = i + 1; });

    await this.topLocRepo.query('DELETE FROM top_locations_cache');
    if ([...stateRows, ...cityRows].length > 0) {
      await this.topLocRepo.save([...stateRows, ...cityRows] as TopLocationsCache[]);
    }

    this.logger.log(`Location cache refreshed: ${stateRows.length} states, ${cityRows.length} cities`);
  }

  // ─── Full 6-Factor Property Score ────────────────────────────────────────────
  //
  //  listingScore (0–1000) =
  //    normalized_views_7d    × w.LISTING_VIEWS_7D      (capped at LISTING_VIEWS_CAP)
  //  + inquiries_7d           × 10 × w.LISTING_INQUIRIES_7D
  //  + saves_7d               × 8  × w.LISTING_SAVES_7D
  //  + recency_bonus          × w.LISTING_RECENCY        (100→0 over 60 days)
  //  + agent_authority_boost  × w.LISTING_AGENT_BOOST    (0–100 from tick+sub)
  //  + listing_plan_boost     × w.LISTING_PLAN_BOOST     (FEATURED=100, PREMIUM=75, BASIC=40, FREE=0)
  //
  //  featuredScore (0–100) =
  //    listing_plan_norm × w.FEATURED_PLAN +
  //    boost_active      × w.FEATURED_BOOST_ACTIVE +
  //    performance_norm  × w.FEATURED_PERFORMANCE

  async aggregateProperties(): Promise<void> {
    this.logger.log('Aggregating top properties cache (6-factor)…');
    const w        = await this.loadWeights();
    const since7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now      = Date.now();

    // ── 7d engagement from analytics_events ──────────────────────────────────
    const [propViews, propInquiries, propSaves] = await Promise.all([
      this.dataSource.query<{ entityId: string; cnt: string }[]>(`
        SELECT ae.entityId, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'property_view' AND ae.entityType = 'property'
          AND ae.createdAt >= ?
        GROUP BY ae.entityId
      `, [since7d]),

      this.dataSource.query<{ entityId: string; cnt: string }[]>(`
        SELECT propertyId AS entityId, COUNT(*) AS cnt
        FROM inquiries WHERE createdAt >= ?
        GROUP BY propertyId
      `, [since7d]),

      this.dataSource.query<{ entityId: string; cnt: string }[]>(`
        SELECT ae.entityId, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'property_save' AND ae.entityType = 'property'
          AND ae.createdAt >= ?
        GROUP BY ae.entityId
      `, [since7d]),
    ]);

    const viewMap7d  = new Map(propViews.map(r    => [r.entityId, parseInt(r.cnt)]));
    const inqMap7d   = new Map(propInquiries.map(r => [r.entityId, parseInt(r.cnt)]));
    const savesMap7d = new Map(propSaves.map(r     => [r.entityId, parseInt(r.cnt)]));

    // ── Properties with agent authority info ──────────────────────────────────
    const allProps: any[] = await this.dataSource.query(`
      SELECT
        p.id, p.owner_id, p.city, p.state, p.createdAt, p.viewCount,
        p.isFeatured, p.isPremium, p.isHotDeal, p.isTrending, p.listingPlan,
        p.boostExpiresAt, p.possessionStatus,
        u.agentTick,
        -- Active premium/featured agent subscription?
        (
          SELECT COUNT(*) FROM agent_subscriptions asub
          JOIN subscription_plans sp ON sp.id = asub.planId
          WHERE asub.agentId = p.owner_id
            AND asub.status = 'active'
            AND asub.expiresAt > NOW()
            AND sp.type IN ('featured','premium')
        ) AS hasPremiumSub
      FROM properties p
      LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.approvalStatus = 'approved'
        AND p.status = 'active'
        AND p.isDraft = 0
    `);

    const toUpsert: Partial<TopPropertiesCache>[] = [];
    const propertyUpdates: {
      id: string;
      viewsLast7d: number; inquiriesLast7d: number; savesLast7d: number;
      listingScore: number; featuredScore: number; dealScore: number;
    }[] = [];

    for (const p of allProps) {
      const views7d    = viewMap7d.get(p.id)  || 0;
      const inq7d      = inqMap7d.get(p.id)   || 0;
      const saves7d    = savesMap7d.get(p.id) || 0;
      const daysOld    = (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);

      // Recency: 100 on day 0, decays linearly to 0 at 60 days
      const recency = Math.max(0, (60 - daysOld) / 60) * 100;

      // Agent authority boost (0–100)
      const tickBoost   = { gold: 80, silver: 60, bronze: 40, verified: 20, none: 0 }[p.agentTick as string] ?? 0;
      const subBoost    = parseInt(p.hasPremiumSub) > 0 ? 30 : 0;
      const agentBoost  = Math.min(100, tickBoost + subBoost);

      // Listing plan boost (0–100)
      const planBoost = { featured: 100, premium: 75, basic: 40, free: 0 }[p.listingPlan as string] ?? 0;

      // Active boost window (used for listing & featured score)
      const boostIsActive = p.boostExpiresAt && new Date(p.boostExpiresAt) > new Date() ? 1 : 0;

      // Normalized views contribution (cap at LISTING_VIEWS_CAP)
      const normViews = (Math.min(views7d + (p.viewCount || 0) * 0.1, w.LISTING_VIEWS_CAP) / w.LISTING_VIEWS_CAP) * 100;

      // ── Listing score (0–1000 range) ────────────────────────────────────
      const listingScore =
        normViews      * w.LISTING_VIEWS_7D     * 10 +
        inq7d          * w.LISTING_INQUIRIES_7D * 10 +
        saves7d        * w.LISTING_SAVES_7D     * 8  +
        recency        * w.LISTING_RECENCY           +
        agentBoost     * w.LISTING_AGENT_BOOST       +
        planBoost      * w.LISTING_PLAN_BOOST;

      // ── Featured score (0–100) ──────────────────────────────────────────
      const perfNorm    = Math.min(100, (views7d / 50 + inq7d / 5) * 10);
      const featuredScore =
        planBoost      * w.FEATURED_PLAN                    +
        boostIsActive  * 100 * w.FEATURED_BOOST_ACTIVE      +
        perfNorm       * w.FEATURED_PERFORMANCE;

      propertyUpdates.push({
        id: p.id,
        viewsLast7d:     views7d,
        inquiriesLast7d: inq7d,
        savesLast7d:     saves7d,
        listingScore:    Math.round(listingScore * 10) / 10,
        featuredScore:   Math.round(featuredScore * 10) / 10,
        dealScore:       0,  // computed separately in refreshPropertyHotScores
      });

      // ── Smart Featured score (6-factor weighted formula) ─────────────────
      // ViewScore(25%) + BoostScore(20%) + FreshnessScore(15%) +
      // TrendingScore(15%) + PremiumScore(15%) + EngagementScore(10%)
      const VIEW_CAP   = Math.max(w.LISTING_VIEWS_CAP, 1);
      const viewScore  = Math.min(views7d / VIEW_CAP, 1) * 100;

      const boostActive  = p.boostExpiresAt && new Date(p.boostExpiresAt) > new Date() ? 1 : 0;
      const boostScore   = (boostActive || p.isFeatured) ? 100 : 0;

      // Exponential decay: 100 on day 0 → ~22 at 60 days → ~5 at 90 days
      const freshnessScore = Math.max(0, Math.exp(-daysOld / 45) * 100);

      const hotDeal    = !!p.isHotDeal;
      const trending   = !!p.isTrending;
      const trendingScore = Math.min(100, (trending ? 60 : 0) + (hotDeal ? 40 : 0) + Math.min(inq7d / 5, 1) * 30);

      // premiumScore: take the best of listingPlan tier OR admin-set flags
      const planTierScore = ({ featured: 100, premium: 70, basic: 40, free: 0 } as Record<string, number>)[p.listingPlan as string] ?? 0;
      const premiumScore  = Math.max(
        planTierScore,
        p.isFeatured ? 100 : 0,   // admin-boosted → full featured score
        p.isPremium  ?  70 : 0,   // admin-marked premium → premium tier score
      );

      const engagementScore = Math.min(100, (inq7d * 8 + saves7d * 3) / 1.1);

      const smartScore =
        viewScore       * 0.25 +
        boostScore      * 0.20 +
        freshnessScore  * 0.15 +
        trendingScore   * 0.15 +
        premiumScore    * 0.15 +
        engagementScore * 0.10;

      const isMonetized = p.listingPlan !== 'free' || !!p.isFeatured || !!p.isPremium;

      // Tab buckets
      const tabs: string[] = [];
      if (p.isFeatured)                                  tabs.push('featured');
      if (p.isPremium)                                   tabs.push('premium');
      if (p.possessionStatus === 'under_construction')   tabs.push('new_projects');
      tabs.push('just_listed');
      tabs.push('most_viewed');

      for (const tab of tabs) {
        toUpsert.push({
          propertyId:     p.id,
          score:          listingScore,
          rank:           0,
          viewsCount:     views7d,
          inquiriesCount: inq7d,
          savesCount:     saves7d,
          tab,
          period:         '7d',
          country:        '',
          state:          p.state || '',
          city:           p.city  || '',
        });
      }

      // smart_featured: push with smartScore + monetized flag stored in viewsCount field
      toUpsert.push({
        propertyId:     p.id,
        score:          smartScore,
        rank:           0,
        viewsCount:     views7d,
        inquiriesCount: inq7d,
        savesCount:     isMonetized ? 1 : 0,   // savesCount repurposed as isMonetized flag
        tab:            'smart_featured',
        period:         '7d',
        country:        '',
        state:          p.state    || '',
        city:           p.city     || '',
      });
    }

    // ── Write listingScore / featuredScore back to properties ─────────────────
    for (let i = 0; i < propertyUpdates.length; i += 200) {
      const batch = propertyUpdates.slice(i, i + 200);
      await Promise.all(batch.map(u =>
        this.dataSource.query(
          `UPDATE properties SET
             viewsLast7d = ?, inquiriesLast7d = ?, savesLast7d = ?,
             listingScore = ?, featuredScore = ?
           WHERE id = ?`,
          [u.viewsLast7d, u.inquiriesLast7d, u.savesLast7d, u.listingScore, u.featuredScore, u.id],
        ),
      ));
    }

    // ── Rank within each (tab + city/state) bucket ───────────────────────────
    const grouped = new Map<string, Partial<TopPropertiesCache>[]>();
    for (const r of toUpsert) {
      const k = `${r.tab}|${r.city}|${r.state}`;
      const g = grouped.get(k) || [];
      g.push(r);
      grouped.set(k, g);
    }

    const ranked: Partial<TopPropertiesCache>[] = [];
    for (const [key, group] of grouped) {
      const tab = key.split('|')[0];

      if (tab === 'smart_featured') {
        // ── Smart Featured: enforce 40/60 organic/monetized mix + diversity ──
        group.sort((a, b) => (b.score as number) - (a.score as number));

        const MAX_PER_OWNER  = 2;
        const TARGET_TOTAL   = 20;
        const MAX_MONETIZED  = Math.ceil(TARGET_TOTAL * 0.60); // 60%
        const MIN_ORGANIC    = Math.floor(TARGET_TOTAL * 0.40); // 40%

        const ownerCount     = new Map<string, number>();
        const monetizedPick: Partial<TopPropertiesCache>[] = [];
        const organicPick:   Partial<TopPropertiesCache>[] = [];

        // We need owner info — embed it as ownerId via propertyId lookup map
        // (allProps already has id but not ownerId separately; we use propertyId as proxy)
        // Diversity by propertyId locality hash (approximate)
        const ownerMap = new Map<string, string>(
          allProps.map((ap: any) => [ap.id as string, (ap.owner_id || ap.id) as string]),
        );

        for (const entry of group) {
          const ownerId   = ownerMap.get(entry.propertyId!) || entry.propertyId!;
          const ownerCnt  = ownerCount.get(ownerId) || 0;
          if (ownerCnt >= MAX_PER_OWNER) continue;

          const isMonetized = (entry.savesCount as number) === 1;
          if (isMonetized && monetizedPick.length < MAX_MONETIZED) {
            monetizedPick.push(entry);
            ownerCount.set(ownerId, ownerCnt + 1);
          } else if (!isMonetized && organicPick.length < MIN_ORGANIC) {
            organicPick.push(entry);
            ownerCount.set(ownerId, ownerCnt + 1);
          }
          if (monetizedPick.length + organicPick.length >= TARGET_TOTAL) break;
        }

        // If organic slots not filled, backfill with monetized (and vice versa)
        if (monetizedPick.length + organicPick.length < TARGET_TOTAL) {
          for (const entry of group) {
            if (monetizedPick.includes(entry) || organicPick.includes(entry)) continue;
            const ownerId  = ownerMap.get(entry.propertyId!) || entry.propertyId!;
            const ownerCnt = ownerCount.get(ownerId) || 0;
            if (ownerCnt >= MAX_PER_OWNER) continue;
            organicPick.push(entry);
            ownerCount.set(ownerId, ownerCnt + 1);
            if (monetizedPick.length + organicPick.length >= TARGET_TOTAL) break;
          }
        }

        // Merge: monetized first (premium/boosted), then organic — re-sort by score
        const merged = [...monetizedPick, ...organicPick];
        merged.sort((a, b) => (b.score as number) - (a.score as number));
        // Reset savesCount to actual saves (not the flag)
        merged.forEach((r, i) => {
          const orig = group.find(g => g.propertyId === r.propertyId);
          r.savesCount = orig ? (orig.viewsCount ?? 0) : 0;   // not used further
          r.rank = i + 1;
          ranked.push(r);
        });
      } else {
        group.sort((a, b) => (b.score as number) - (a.score as number));
        group.slice(0, 20).forEach((r, i) => { r.rank = i + 1; ranked.push(r); });
      }
    }

    await this.topPropsRepo.query('DELETE FROM top_properties_cache');
    if (ranked.length > 0) {
      for (let i = 0; i < ranked.length; i += 500) {
        await this.topPropsRepo.save(ranked.slice(i, i + 500) as TopPropertiesCache[]);
      }
    }

    this.logger.log(`Properties cache refreshed: ${ranked.length} records (${allProps.length} properties scored)`);
  }

  // ─── Hot Deal / Trending refresh (runs every 30 min) ──────────────────────────
  //
  //  hot_score =
  //    views_24h        × w.HOT_VIEWS_24H       (× 10 = 100 pts if 10 views)
  //  + inquiries_24h    × w.HOT_INQUIRIES_24H   (× 15 = 100 pts if ~7 inqs)
  //  + saves_24h        × w.HOT_SAVES_24H       (× 8)
  //  + boost_active_100 × w.HOT_BOOST_ACTIVE
  //
  //  Tag as isHotDeal if hot_score ≥ HOT_THRESHOLD
  //  Tag as isTrending if this-week inqs / last-week inqs ≥ TRENDING_VELOCITY

  async refreshPropertyHotScores(): Promise<void> {
    this.logger.log('Refreshing property hot scores…');
    const w        = await this.loadWeights();
    const since24h = new Date(Date.now() -  1 * 24 * 60 * 60 * 1000);
    const since7d  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000);
    const prev7d   = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // 24h engagement — use property_views (authoritative dedup source) for views
    const [views24h, views7d, inq24h, saves24h] = await Promise.all([
      this.dataSource.query<{ entityId: string; cnt: string }[]>(`
        SELECT pv.property_id AS entityId, COUNT(*) AS cnt
        FROM property_views pv
        WHERE pv.viewed_at >= ?
        GROUP BY pv.property_id
      `, [since24h]),

      this.dataSource.query<{ entityId: string; cnt: string }[]>(`
        SELECT pv.property_id AS entityId, COUNT(*) AS cnt
        FROM property_views pv
        WHERE pv.viewed_at >= ?
        GROUP BY pv.property_id
      `, [since7d]),

      this.dataSource.query<{ propertyId: string; cnt: string }[]>(`
        SELECT propertyId, COUNT(*) AS cnt
        FROM inquiries WHERE createdAt >= ?
        GROUP BY propertyId
      `, [since24h]),

      this.dataSource.query<{ entityId: string; cnt: string }[]>(`
        SELECT ae.entityId, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'property_save' AND ae.entityType = 'property'
          AND ae.createdAt >= ?
        GROUP BY ae.entityId
      `, [since24h]),
    ]);

    // 7d vs prev-7d inquiries (for velocity/trending)
    const [inq7dCurr, inq7dPrev] = await Promise.all([
      this.dataSource.query<{ propertyId: string; cnt: string }[]>(`
        SELECT propertyId, COUNT(*) AS cnt FROM inquiries
        WHERE createdAt >= ? GROUP BY propertyId
      `, [since7d]),
      this.dataSource.query<{ propertyId: string; cnt: string }[]>(`
        SELECT propertyId, COUNT(*) AS cnt FROM inquiries
        WHERE createdAt BETWEEN ? AND ? GROUP BY propertyId
      `, [prev7d, since7d]),
    ]);

    const v24Map    = new Map(views24h.map(r  => [r.entityId,   parseInt(r.cnt)]));
    const v7Map     = new Map(views7d.map(r   => [r.entityId,   parseInt(r.cnt)]));
    const i24Map    = new Map(inq24h.map(r    => [r.propertyId, parseInt(r.cnt)]));
    const s24Map    = new Map(saves24h.map(r  => [r.entityId,   parseInt(r.cnt)]));
    const i7CurrMap = new Map(inq7dCurr.map(r => [r.propertyId, parseInt(r.cnt)]));
    const i7PrevMap = new Map(inq7dPrev.map(r => [r.propertyId, parseInt(r.cnt)]));

    // Properties with boost status
    const props: any[] = await this.dataSource.query(`
      SELECT id, boostExpiresAt, isFeatured, listingPlan, city, state,
             price, area, areaUnit, priceUnit, type, category
      FROM properties
      WHERE approvalStatus = 'approved' AND status = 'active' AND isDraft = 0
    `);

    // Deal score: compute price-per-sqft vs city+type median
    const medianPsfRows: any[] = await this.dataSource.query(`
      SELECT city, type, category,
             AVG(${BUY_PSF_SQL}) AS medianPsf
      FROM properties p
      WHERE approvalStatus = 'approved' AND status = 'active' AND isDraft = 0
        AND category = 'buy'
      GROUP BY city, type, category
    `);
    type MedianKey = string;
    const medianMap = new Map<MedianKey, number>(
      medianPsfRows.map((r: any) => [
        `${r.city}|${r.type}`,
        parseFloat(r.medianPsf) || 0,
      ]),
    );

    const hotTagTtl = 24 * 60 * 60 * 1000; // hot tag lasts 24h if earned
    const hotExpiry = new Date(Date.now() + hotTagTtl);
    const now       = new Date();

    const updates: any[] = [];

    for (const p of props) {
      const v24    = v24Map.get(p.id)    || 0;
      const v7     = v7Map.get(p.id)     || 0;
      const i24    = i24Map.get(p.id)    || 0;
      const s24    = s24Map.get(p.id)    || 0;
      const i7curr = i7CurrMap.get(p.id) || 0;
      const i7prev = i7PrevMap.get(p.id) || 0;
      const boostActive = p.boostExpiresAt && new Date(p.boostExpiresAt) > now ? 1 : 0;

      // Hot score
      const hotScore =
        v24  * w.HOT_VIEWS_24H     * 10 +
        i24  * w.HOT_INQUIRIES_24H * 15 +
        s24  * w.HOT_SAVES_24H     * 8  +
        boostActive * 100 * w.HOT_BOOST_ACTIVE;

      // Trending: this week's inquiries ≥ TRENDING_VELOCITY × last week's inquiries
      const velocity = i7prev > 0 ? i7curr / i7prev : (i7curr >= 3 ? w.TRENDING_VELOCITY + 0.1 : 0);
      const isTrending = velocity >= w.TRENDING_VELOCITY;
      const isHotDeal  = hotScore  >= w.HOT_THRESHOLD;

      // Deal score: how much cheaper than city+type median PSF (0–100, higher = better deal)
      let dealScore = 0;
      if (p.category === 'buy' && p.area > 0) {
        const median = medianMap.get(`${p.city}|${p.type}`) || 0;
        const psfRaw = parseFloat(p.price) / (parseFloat(p.area) || 1);
        if (median > 0 && psfRaw > 0) {
          const discount = (median - psfRaw) / median;
          dealScore = Math.max(0, Math.min(100, Math.round((discount + 0.3) * 100)));
        }
      }

      updates.push({
        id: p.id,
        viewsLast24h:     v24,
        viewsLast7d:      v7,
        inquiriesLast24h: i24,
        savesLast7d:      s24Map.get(p.id) || 0,
        dealScore,
        isHotDeal:        isHotDeal  ? 1 : 0,
        isTrending:       isTrending ? 1 : 0,
        hotTagExpiresAt:  (isHotDeal || isTrending) ? hotExpiry : null,
      });
    }

    // Batch update
    for (let i = 0; i < updates.length; i += 200) {
      const batch = updates.slice(i, i + 200);
      await Promise.all(batch.map((u: any) =>
        this.dataSource.query(
          `UPDATE properties SET
             viewsLast24h = ?,
             viewsLast7d = ?,
             inquiriesLast24h = ?,
             savesLast7d = ?,
             dealScore = ?,
             isHotDeal = ?,
             isTrending = ?,
             hotTagExpiresAt = ?
           WHERE id = ?`,
          [u.viewsLast24h, u.viewsLast7d, u.inquiriesLast24h, u.savesLast7d,
           u.dealScore, u.isHotDeal, u.isTrending, u.hotTagExpiresAt, u.id],
        ),
      ));
    }

    // Auto-expire stale hot tags
    await this.dataSource.query(
      `UPDATE properties SET isHotDeal = 0, isTrending = 0, hotTagExpiresAt = NULL
       WHERE hotTagExpiresAt IS NOT NULL AND hotTagExpiresAt <= NOW()`,
    );

    this.logger.log(`Hot scores refreshed: ${updates.length} properties`);
  }

  async aggregateAgents(): Promise<void> {
    this.logger.log('Aggregating top agents cache…');
    const w = await this.loadWeights();

    const since7d  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000);
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── 7-day inquiry counts per agent ──────────────────────────────────────────
    const agentInq7d: { agentId: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT i.agent_id AS agentId, COUNT(*) AS cnt
        FROM inquiries i
        WHERE i.createdAt >= ? AND i.agent_id IS NOT NULL
        GROUP BY i.agent_id
      `, [since7d]);

    // ── Total closed deals per agent (conversion rate numerator) ─────────────────
    const agentDeals: { agentId: string; closed: string; total: string }[] =
      await this.dataSource.query(`
        SELECT
          d.agentId,
          SUM(CASE WHEN d.stage = 'closed' THEN 1 ELSE 0 END) AS closed,
          COUNT(*) AS total
        FROM deals d
        WHERE d.agentId IS NOT NULL
        GROUP BY d.agentId
      `);

    // ── Profile views in last 7 days ─────────────────────────────────────────────
    const profileViews: { entityId: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT ae.entityId, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'agent_profile_view' AND ae.entityType = 'agent'
          AND ae.createdAt >= ?
        GROUP BY ae.entityId
      `, [since7d]);

    // ── Active listings in last 30 days per agent ─────────────────────────────────
    const recentListings: { ownerId: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT p.owner_id AS ownerId, COUNT(*) AS cnt
        FROM properties p
        WHERE p.approvalStatus = 'approved' AND p.status = 'active'
          AND p.createdAt >= ?
        GROUP BY p.owner_id
      `, [since30d]);

    // ── Premium subscription check ───────────────────────────────────────────────
    const premiumSubs: { agentId: string }[] =
      await this.dataSource.query(`
        SELECT DISTINCT ag.agentId
        FROM agent_subscriptions ag
        JOIN subscription_plans sp ON sp.id = ag.planId
        WHERE ag.status = 'active' AND ag.expiresAt > NOW()
          AND sp.type IN ('featured', 'premium')
      `);
    const premiumSet = new Set(premiumSubs.map(r => r.agentId));

    // ── Main agent rows ───────────────────────────────────────────────────────────
    const agents: any[] = await this.dataSource.query(`
      SELECT u.id, u.city, u.state, u.agentRating, u.totalDeals,
             u.agentExperience, u.agentTick,
             COUNT(p.id) AS listingsCount
      FROM users u
      LEFT JOIN properties p
        ON p.owner_id = u.id AND p.approvalStatus = 'approved' AND p.status = 'active'
      WHERE u.role = 'agent' AND u.isActive = 1
      GROUP BY u.id
    `);

    // ── Build lookup maps ─────────────────────────────────────────────────────────
    const inqMap      = new Map(agentInq7d.map(r => [r.agentId, parseInt(r.cnt)]));
    const dealMap     = new Map(agentDeals.map(r => [r.agentId, { closed: parseInt(r.closed), total: parseInt(r.total) }]));
    const viewMap     = new Map(profileViews.map(r => [r.entityId, parseInt(r.cnt)]));
    const recentMap   = new Map(recentListings.map(r => [r.ownerId, parseInt(r.cnt)]));

    const toUpsert: Partial<TopAgentsCache>[] = [];

    for (const a of agents) {
      const listings    = parseInt(a.listingsCount) || 0;
      const inqs7d      = inqMap.get(a.id) || 0;
      const dealData    = dealMap.get(a.id);
      const totalDeals  = dealData?.total || parseInt(a.totalDeals) || 0;
      const closedDeals = dealData?.closed || 0;
      const convRate    = totalDeals > 0 ? closedDeals / totalDeals : 0;   // 0–1
      const rating      = parseFloat(a.agentRating) || 0;                  // 0–5
      const hasPremium  = premiumSet.has(a.id) ? 1 : 0;
      const recentAct   = recentMap.has(a.id) ? 1 : 0;                     // listed in 30d

      // Authority tick bonus (used only for display; also incorporated into premium)
      // Not a separate weight factor — premium + tick together drive AGENT_PREMIUM weight

      // ── 6-factor formula (each factor normalised to 0–1 before weighting) ──────
      const norm_listings  = Math.min(listings / w.AGENT_LISTINGS_CAP, 1);
      const norm_inq       = Math.min(inqs7d   / w.AGENT_INQ_CAP,      1);
      const norm_rating    = rating / 5;
      // Tick bonus (0.0–0.4) folded into agent authority used for premium factor
      const tickBonus =
        a.agentTick === 'gold'     ? 0.40 :
        a.agentTick === 'silver'   ? 0.30 :
        a.agentTick === 'bronze'   ? 0.20 :
        a.agentTick === 'verified' ? 0.10 : 0;
      const premiumFactor  = Math.min(hasPremium * 0.60 + tickBonus, 1);

      const score =
        norm_listings  * w.AGENT_LISTINGS    * 100 +
        norm_inq       * w.AGENT_INQUIRIES_7D * 100 +
        convRate       * w.AGENT_CONVERSION   * 100 +
        norm_rating    * w.AGENT_RATING        * 100 +
        premiumFactor  * w.AGENT_PREMIUM       * 100 +
        recentAct      * w.AGENT_RECENCY       * 100;

      // Push to agent's own city+state bucket and global buckets
      const pviews = viewMap.get(a.id) || 0;
      const buckets = [
        { city: a.city || '', state: a.state || '' },
        { city: '',            state: a.state || '' },
        { city: '',            state: '' },
      ];

      for (const b of buckets) {
        toUpsert.push({
          agentId:        a.id,
          score,
          rank:           0,
          profileViews:   pviews,
          listingsCount:  listings,
          inquiriesCount: inqs7d,
          country:        '',
          state:          b.state,
          city:           b.city,
        });
      }
    }

    // ── Rank within each geo bucket (top 20 per bucket) ──────────────────────────
    const grouped = new Map<string, Partial<TopAgentsCache>[]>();
    for (const r of toUpsert) {
      const k = `${r.city}|${r.state}`;
      const g = grouped.get(k) || [];
      g.push(r);
      grouped.set(k, g);
    }

    const ranked: Partial<TopAgentsCache>[] = [];
    for (const [, group] of grouped) {
      group.sort((a, b) => (b.score as number) - (a.score as number));
      group.slice(0, 20).forEach((r, i) => { r.rank = i + 1; ranked.push(r); });
    }

    await this.topAgentsRepo.query('DELETE FROM top_agents_cache');
    if (ranked.length > 0) {
      await this.topAgentsRepo.save(ranked as TopAgentsCache[]);
    }

    this.logger.log(`Agents cache refreshed: ${ranked.length} records`);
  }

  // ─── Smart AI Insights Generator ─────────────────────────────────────────────
  // Rule-based NLP-style insights derived from computed market metrics.
  // Returns 3–5 human-readable insight strings for the city/market.
  private generateSmartInsights(params: {
    city: string;
    medianPsf: number;
    medianRent: number;
    cityAvgRentPsf: number;
    trend: string;
    trendPct: number;
    rentYield: number | null;
    buySavingsPct: number | null;
    localities: any[];
    confidenceScore: number;
    dataQuality: string;
  }): string[] {
    const {
      city, medianPsf, medianRent, cityAvgRentPsf,
      trend, trendPct, rentYield, buySavingsPct,
      localities, confidenceScore, dataQuality,
    } = params;

    const insights: string[] = [];
    const cityName = city.replace(/\b\w/g, c => c.toUpperCase());

    // ── Insight 1: Price trend ─────────────────────────────────────────────────
    if (medianPsf > 0) {
      if (trend === 'up' && trendPct >= 5) {
        insights.push(`📈 ${cityName} property prices have risen ${trendPct.toFixed(1)}% over the last 90 days — a strong bullish signal for investors.`);
      } else if (trend === 'up' && trendPct > 0) {
        insights.push(`📈 Prices in ${cityName} are trending upward by ${trendPct.toFixed(1)}%, indicating healthy demand and steady appreciation.`);
      } else if (trend === 'down' && trendPct >= 3) {
        insights.push(`📉 ${cityName} has seen a ${trendPct.toFixed(1)}% price correction — a potential entry opportunity for budget-conscious buyers.`);
      } else {
        insights.push(`📊 ${cityName} property prices are stable at ₹${medianPsf.toLocaleString('en-IN')}/sqft, reflecting a balanced demand-supply market.`);
      }
    }

    // ── Insight 2: Rental yield ────────────────────────────────────────────────
    if (rentYield > 0) {
      if (rentYield >= 4) {
        insights.push(`🏠 Rental yield in ${cityName} is ${rentYield.toFixed(1)}% — above the national average of 2–3%, making it an attractive rental market for investors.`);
      } else if (rentYield >= 2.5) {
        insights.push(`🏠 ${cityName} offers a rental yield of ${rentYield.toFixed(1)}%, in line with market norms. Good for long-term wealth building through buy-to-let.`);
      } else if (rentYield > 0) {
        insights.push(`🏠 Rental yields in ${cityName} stand at ${rentYield.toFixed(1)}% — relatively low, suggesting the market is more suitable for capital appreciation than rental income.`);
      }
    }

    // ── Insight 3: Rent PSF vs Sale PSF ratio ─────────────────────────────────
    if (cityAvgRentPsf > 0 && medianPsf > 0) {
      const ratio = cityAvgRentPsf / medianPsf;
      if (ratio >= 0.008) {
        insights.push(`💡 At ₹${cityAvgRentPsf}/sqft/month rent vs ₹${medianPsf.toLocaleString('en-IN')}/sqft buy price, ${cityName} shows strong rental demand relative to ownership costs.`);
      } else {
        insights.push(`💡 In ${cityName}, renting at ₹${cityAvgRentPsf}/sqft/month is significantly cheaper than buying at ₹${medianPsf.toLocaleString('en-IN')}/sqft — ideal for those prioritising flexibility.`);
      }
    }

    // ── Insight 4: Best locality highlight ────────────────────────────────────
    if (localities && localities.length > 0) {
      const best = localities[0];
      if (best?.name && best?.medianPsf > 0) {
        if (best.circleRate > 0 && best.pricePremium !== undefined) {
          const premiumSign = best.pricePremium >= 0 ? '+' : '';
          insights.push(`🏆 ${best.name} is the top-ranked locality in ${cityName} at ₹${best.medianPsf.toLocaleString('en-IN')}/sqft — ${premiumSign}${best.pricePremium.toFixed(0)}% vs government circle rate of ₹${best.circleRate.toLocaleString('en-IN')}/sqft.`);
        } else {
          insights.push(`🏆 ${best.name} leads ${cityName} localities with a median price of ₹${best.medianPsf.toLocaleString('en-IN')}/sqft${best.trend === 'up' ? ' and rising demand' : ''}.`);
        }
      }

      // Best rental locality (by rentYield)
      const topRental = localities.filter(l => l.rentYield > 0).sort((a, b) => b.rentYield - a.rentYield)[0];
      if (topRental && topRental.name !== best?.name && topRental.rentYield >= 3) {
        insights.push(`💰 ${topRental.name} offers the best rental yield at ${topRental.rentYield.toFixed(1)}% — a top pick for rental investors in ${cityName}.`);
      }
    }

    // ── Insight 5: Buy vs Rent recommendation ─────────────────────────────────
    if (buySavingsPct > 0) {
      if (buySavingsPct >= 15) {
        insights.push(`🔑 Over 10 years, buying in ${cityName} saves ~${buySavingsPct.toFixed(0)}% more than renting — strongly favour purchasing if you plan to stay long-term.`);
      } else if (buySavingsPct >= 5) {
        insights.push(`🔑 Buying in ${cityName} is estimated to be ${buySavingsPct.toFixed(0)}% more cost-effective than renting over a 10-year horizon.`);
      }
    }

    // ── Insight 6: Data quality notice ────────────────────────────────────────
    if (dataQuality === 'low' || confidenceScore < 30) {
      insights.push(`⚠️ Data in ${cityName} is limited (${confidenceScore ?? 0} confidence score). Figures are indicative — verify with local agents before making decisions.`);
    } else if (dataQuality === 'high' && confidenceScore >= 70) {
      insights.push(`✅ Analysis for ${cityName} is based on high-confidence data (score: ${confidenceScore}) from recent active listings — reliable for market benchmarking.`);
    }

    // Return top 5 insights
    return insights.slice(0, 5);
  }

  // ─── Admin: Circle Rate CRUD ──────────────────────────────────────────────────

  async listCircleRates(city?: string): Promise<LocalityCircleRate[]> {
    const qb = this.circleRateRepo.createQueryBuilder('lcr').orderBy('lcr.city').addOrderBy('lcr.locality');
    if (city) qb.where('LOWER(lcr.city) = LOWER(:city)', { city });
    return qb.getMany();
  }

  async upsertCircleRate(dto: {
    city: string;
    locality: string;
    circleRate: number;
    effectiveFrom?: string;
    notes?: string;
    source?: string;
  }): Promise<LocalityCircleRate> {
    const existing = await this.circleRateRepo.findOne({
      where: { city: dto.city, locality: dto.locality } as any,
    });
    const entity = existing || this.circleRateRepo.create({ city: dto.city, locality: dto.locality });
    entity.circleRate    = dto.circleRate;
    entity.effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    entity.notes         = dto.notes || null;
    entity.source        = dto.source || null;
    return this.circleRateRepo.save(entity);
  }

  async updateCircleRate(id: string, dto: Partial<{
    circleRate: number;
    effectiveFrom: string;
    notes: string;
    source: string;
  }>): Promise<LocalityCircleRate> {
    const entity = await this.circleRateRepo.findOneOrFail({ where: { id } as any });
    if (dto.circleRate !== undefined) entity.circleRate = dto.circleRate;
    if (dto.effectiveFrom !== undefined) entity.effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    if (dto.notes      !== undefined) entity.notes  = dto.notes;
    if (dto.source     !== undefined) entity.source = dto.source;
    return this.circleRateRepo.save(entity);
  }

  async deleteCircleRate(id: string): Promise<void> {
    await this.circleRateRepo.delete(id);
  }

  async aggregateProjects(): Promise<void> {
    this.logger.log('Aggregating top projects cache…');
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const views: { entityId: string; city: string; state: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT ae.entityId, ae.city, ae.state, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType IN ('project_view','property_view')
          AND ae.entityType = 'property'
          AND ae.createdAt >= ?
        GROUP BY ae.entityId, ae.city, ae.state
      `, [since7d]);

    const projects: any[] = await this.dataSource.query(`
      SELECT p.id, p.city, p.state, p.viewCount, p.createdAt
      FROM properties p
      WHERE p.approvalStatus = 'approved' AND p.status = 'active'
        AND p.possessionStatus = 'under_construction'
    `);

    const viewMap = new Map(views.map(r => [r.entityId, { cnt: parseInt(r.cnt), city: r.city, state: r.state }]));

    const toUpsert: Partial<TopProjectsCache>[] = [];

    for (const p of projects) {
      const v   = viewMap.get(p.id);
      const cnt = (v?.cnt || 0) + (p.viewCount || 0) * 0.1;
      const daysOld = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const recency = Math.max(0, (60 - daysOld) / 60) * 50;
      const score = cnt + recency;

      const buckets = [
        { city: p.city || '', state: p.state || '' },
        { city: '',            state: p.state || '' },
        { city: '',            state: '' },
      ];

      for (const b of buckets) {
        toUpsert.push({ propertyId: p.id, score, rank: 0, viewsCount: Math.floor(cnt), inquiriesCount: 0, country: '', state: b.state, city: b.city });
      }
    }

    const grouped = new Map<string, Partial<TopProjectsCache>[]>();
    for (const r of toUpsert) {
      const k = `${r.city}|${r.state}`;
      const g = grouped.get(k) || [];
      g.push(r);
      grouped.set(k, g);
    }

    const ranked: Partial<TopProjectsCache>[] = [];
    for (const [, group] of grouped) {
      group.sort((a, b) => (b.score as number) - (a.score as number));
      group.slice(0, 20).forEach((r, i) => { r.rank = i + 1; ranked.push(r); });
    }

    await this.topProjectsRepo.query('DELETE FROM top_projects_cache');
    if (ranked.length > 0) {
      await this.topProjectsRepo.save(ranked as TopProjectsCache[]);
    }

    this.logger.log(`Projects cache refreshed: ${ranked.length} records`);
  }
}

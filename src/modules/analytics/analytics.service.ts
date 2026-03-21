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
import { ScoringConfig } from './entities/scoring-config.entity';

// ─── Unit normalisation (all areas → Sq.Ft.) ─────────────────────────────────
// Matches the unit strings used in the post-property form.
const AREA_TO_SQFT_SQL = `
  CASE
    WHEN p.areaUnit IS NULL OR p.areaUnit = ''
      OR LOWER(p.areaUnit) LIKE '%sq%ft%'
      OR LOWER(p.areaUnit) LIKE '%sqft%'              THEN p.area
    WHEN LOWER(p.areaUnit) LIKE '%sq%yd%'
      OR LOWER(p.areaUnit) LIKE '%sqyd%'              THEN p.area * 9.0
    WHEN LOWER(p.areaUnit) LIKE '%sq%mt%'
      OR LOWER(p.areaUnit) LIKE '%sq%m%'
      OR LOWER(p.areaUnit) LIKE '%sqmt%'              THEN p.area * 10.764
    WHEN LOWER(p.areaUnit) LIKE '%acre%'              THEN p.area * 43560.0
    WHEN LOWER(p.areaUnit) LIKE '%bigha%'             THEN p.area * 27000.0
    WHEN LOWER(p.areaUnit) LIKE '%marla%'             THEN p.area * 272.25
    WHEN LOWER(p.areaUnit) LIKE '%kanal%'             THEN p.area * 5445.0
    ELSE p.area
  END
`;

// Normalised PSF expression (buy listings only, handles per-sqft priceUnit too)
const BUY_PSF_SQL = `
  CASE
    WHEN p.category = 'buy' AND p.priceUnit = 'per sqft' AND p.price > 0
      THEN p.price
    WHEN p.category = 'buy'
      AND (p.priceUnit = 'total' OR p.priceUnit IS NULL)
      AND p.area > 0 AND p.price > 0
      AND (${AREA_TO_SQFT_SQL}) > 0
      THEN p.price / (${AREA_TO_SQFT_SQL})
    ELSE NULL
  END
`;

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

    @InjectRepository(ScoringConfig)
    private readonly scoringConfigRepo: Repository<ScoringConfig>,

    private readonly dataSource: DataSource,
  ) {}

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
    } catch (err) {
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
      .groupBy('p.type');

    if (filters.city)        liveQb.andWhere('p.city = :city',   { city:  filters.city  });
    else if (filters.state)  liveQb.andWhere('p.state = :state', { state: filters.state });

    const liveCounts: { propertyType: string; cnt: string }[] = await liveQb.getRawMany();
    const liveCountMap = new Map(liveCounts.map(r => [r.propertyType, parseInt(r.cnt)]));

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

  /** Live fallback: count properties by type from main DB */
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
      .groupBy('p.type')
      .orderBy('totalListings', 'DESC')
      .limit(limit);

    if (filters.city)    qb.andWhere('p.city = :city', { city: filters.city });
    else if (filters.state) qb.andWhere('p.state = :state', { state: filters.state });

    const rows: { propertyType: string; totalListings: string }[] = await qb.getRawMany();

    return rows.map((r, idx) => {
      const meta = PROPERTY_TYPE_META[r.propertyType] || { label: r.propertyType, icon: '🏠' };
      return {
        propertyType:  r.propertyType,
        label:         meta.label,
        icon:          meta.icon,
        totalListings: parseInt(r.totalListings),
        totalViews:    0,
        totalSearches: 0,
        score:         parseInt(r.totalListings),
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
        .map(r => ({ ...r.property, _score: Number(r.score), _rank: r.rank }));
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
      case 'premium':      qb.andWhere('p.isPremium = 1');                          break;
      case 'most_viewed':  qb.orderBy('p.viewCount', 'DESC');                       break;
      case 'just_listed':  qb.orderBy('p.createdAt', 'DESC');                       break;
      case 'new_projects': qb.andWhere("p.possessionStatus = 'under_construction'").orderBy('p.createdAt', 'DESC'); break;
      default:             qb.andWhere('p.isFeatured = 1');                         break;
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
    if (filters.category && filters.category !== 'all') {
      whereParts.push('p.category = ?');
      params.push(filters.category);
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
        p.furnishingStatus, p.possessionStatus,
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

      return {
        id:               r.id,
        title:            r.title,
        slug:             r.slug,
        price:            parseFloat(r.price) || 0,
        priceUnit:        r.priceUnit,
        area:             r.area ? parseFloat(r.area) : null,
        areaUnit:         r.areaUnit,
        bedrooms:         r.bedrooms ? parseInt(r.bedrooms) : null,
        bathrooms:        r.bathrooms ? parseInt(r.bathrooms) : null,
        city:             r.city,
        locality:         r.locality,
        state:            r.state,
        category:         r.category,
        type:             r.type,
        viewCount:        parseInt(r.viewCount) || 0,
        weeklyInquiries:  parseInt(r.weeklyInquiries) || 0,
        trendScore:       Math.round(score * 10) / 10,
        demandLevel,
        rank:             i + 1,
        images:           imgMap.get(r.id) || [],
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
    // 1. Get all snapshots (pre-calculated cities)
    const snapshots = await this.snapshotRepo.find({
      where: { city: undefined }, // all
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
        where: { city } as any,
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
    return {
      city:            s.city,
      state:           s.state,
      avgPricePerSqft: Math.round(Number(s.avgPsf)),
      avgPrice:        Math.round(Number(s.avgPrice)),
      minPrice:        Math.round(Number(s.minPrice)),
      maxPrice:        Math.round(Number(s.maxPrice)),
      listingCount:    s.listingCount,
      trend:           s.trend as 'up' | 'down' | 'stable',
      trendPct:        Math.round(Number(s.trendPct) * 10) / 10,
      avgMonthlyRent:  Math.round(Number(s.avgMonthlyRent)),
      rentYield:       Math.round(Number(s.rentYield) * 10) / 10,
      buySavingsPct:   Math.round(Number(s.buySavingsPct) * 10) / 10,
      localities:      s.topLocalities || [],
      dataWindow:      '90d',
      lastUpdated:     s.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  // ─── Core computation: unit-normalised market snapshot ───────────────────────
  // Normalises all area units to Sq.Ft. before computing PSF.
  // Uses only 'buy' category listings for PSF; 'rent' listings for rental stats.

  async refreshMarketSnapshot(city?: string, state?: string) {
    const since90d = new Date(Date.now() -  90 * 24 * 60 * 60 * 1000);
    const prev90d  = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const locParts: string[] = [];
    const locParams: any[]   = [];
    if (city) {
      locParts.push('LOWER(p.city) = LOWER(?)');
      locParams.push(city);
    } else if (state) {
      locParts.push('LOWER(p.state) = LOWER(?)');
      locParams.push(state);
    }
    const locWhere = locParts.length ? locParts.join(' AND ') : '1=1';

    // ── Current 90d: buy stats with unit-normalised PSF ───────────────────────
    const [overall]: any[] = await this.dataSource.query(`
      SELECT
        AVG(${BUY_PSF_SQL})                                        AS avgPsf,
        AVG(CASE WHEN p.category = 'buy' THEN p.price END)        AS avgPrice,
        COUNT(CASE WHEN p.category = 'buy' THEN 1 END)            AS buyListingCount,
        COUNT(*)                                                   AS totalListingCount,
        MIN(CASE WHEN p.category = 'buy' THEN p.price END)        AS minPrice,
        MAX(CASE WHEN p.category = 'buy' THEN p.price END)        AS maxPrice,
        AVG(CASE WHEN p.category = 'rent'
              AND (p.priceUnit = 'per month' OR p.priceUnit IS NULL OR p.priceUnit = 'total')
              THEN p.price END)                                    AS avgMonthlyRent
      FROM properties p
      WHERE p.approvalStatus = 'approved'
        AND p.status = 'active'
        AND p.isDraft = 0
        AND ${locWhere}
        AND p.createdAt >= ?
    `, [...locParams, since90d]);

    // ── Previous 90d for trend ────────────────────────────────────────────────
    const [prev]: any[] = await this.dataSource.query(`
      SELECT AVG(${BUY_PSF_SQL}) AS avgPsf
      FROM properties p
      WHERE p.approvalStatus = 'approved'
        AND p.status = 'active'
        AND p.isDraft = 0
        AND ${locWhere}
        AND p.createdAt BETWEEN ? AND ?
    `, [...locParams, prev90d, since90d]);

    // ── Current by-locality stats ────────────────────────────────────────────
    const localityCurrent: any[] = await this.dataSource.query(`
      SELECT
        p.locality,
        COUNT(CASE WHEN p.category = 'buy' THEN 1 END)             AS buyCount,
        COUNT(*)                                                    AS listingCount,
        AVG(${BUY_PSF_SQL})                                        AS avgPsf,
        AVG(CASE WHEN p.category = 'buy' THEN p.price END)        AS avgBuyPrice,
        AVG(CASE WHEN p.category = 'rent'
              AND (p.priceUnit = 'per month' OR p.priceUnit IS NULL OR p.priceUnit = 'total')
              THEN p.price END)                                     AS avgRent
      FROM properties p
      WHERE p.approvalStatus = 'approved'
        AND p.status = 'active'
        AND p.isDraft = 0
        AND p.locality IS NOT NULL AND p.locality != ''
        AND ${locWhere}
        AND p.createdAt >= ?
      GROUP BY p.locality
      HAVING buyCount >= 1 AND AVG(${BUY_PSF_SQL}) IS NOT NULL
      ORDER BY avgPsf DESC
      LIMIT 10
    `, [...locParams, since90d]);

    // ── Previous by-locality PSF (for trend arrows) ───────────────────────────
    const localityPrev: any[] = await this.dataSource.query(`
      SELECT p.locality, AVG(${BUY_PSF_SQL}) AS avgPsf
      FROM properties p
      WHERE p.approvalStatus = 'approved'
        AND p.status = 'active'
        AND p.isDraft = 0
        AND p.locality IS NOT NULL AND p.locality != ''
        AND ${locWhere}
        AND p.createdAt BETWEEN ? AND ?
      GROUP BY p.locality
    `, [...locParams, prev90d, since90d]);

    const prevPsfMap = new Map<string, number>(
      localityPrev.map((r: any) => [r.locality as string, parseFloat(r.avgPsf) || 0]),
    );

    // ── Overall trend ─────────────────────────────────────────────────────────
    const currentPsf = parseFloat(overall?.avgPsf) || 0;
    const prevPsf    = parseFloat(prev?.avgPsf) || 0;
    let trendPct = 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (prevPsf > 0 && currentPsf > 0) {
      trendPct = Math.round(((currentPsf - prevPsf) / prevPsf) * 1000) / 10;
      if (trendPct >  1.5) trend = 'up';
      if (trendPct < -1.5) trend = 'down';
    }

    // ── Rent yield (gross, annualised) ────────────────────────────────────────
    const avgRent     = parseFloat(overall?.avgMonthlyRent) || 0;
    const avgBuyPrice = parseFloat(overall?.avgPrice) || 0;
    const rentYield   = avgRent > 0 && avgBuyPrice > 0
      ? Math.min(15, Math.max(1, Math.round((avgRent * 12 / avgBuyPrice) * 1000) / 10))
      : 3.2;

    // ── Buy-vs-rent 10-year estimate ──────────────────────────────────────────
    // Model: property appreciates 7% p.a.; rent escalates 5% p.a.
    let buySavingsPct = 20;
    if (avgRent > 0 && avgBuyPrice > 0) {
      const totalRent10yr    = avgRent * 12 * ((Math.pow(1.05, 10) - 1) / 0.05);
      const propertyVal10yr  = avgBuyPrice * Math.pow(1.07, 10);
      const ownershipCost    = avgBuyPrice * 0.12; // stamp duty, registration, maintenance est.
      const netGain          = propertyVal10yr - avgBuyPrice - ownershipCost;
      const savings          = (netGain / totalRent10yr) * 100;
      buySavingsPct          = Math.max(5, Math.min(45, Math.round(savings * 10) / 10));
    }

    // ── Localities ────────────────────────────────────────────────────────────
    const localities = localityCurrent.map((r: any) => {
      const currPsf = parseFloat(r.avgPsf) || 0;
      const prevP   = prevPsfMap.get(r.locality as string) || 0;
      let localTrend: 'up' | 'down' | 'stable' = 'stable';
      if (prevP > 0 && currPsf > 0) {
        const chg = (currPsf - prevP) / prevP;
        if (chg >  0.015) localTrend = 'up';
        if (chg < -0.015) localTrend = 'down';
      }
      return {
        name:         r.locality as string,
        avgPsf:       Math.round(currPsf),
        avgBuyPrice:  Math.round(parseFloat(r.avgBuyPrice) || 0),
        avgRent:      Math.round(parseFloat(r.avgRent) || 0),
        listingCount: parseInt(r.listingCount),
        trend:        localTrend,
      };
    }).filter((r: any) => r.avgPsf > 0);

    const result = {
      city:            city  || null,
      state:           state || null,
      avgPricePerSqft: Math.round(currentPsf),
      avgPrice:        Math.round(avgBuyPrice),
      minPrice:        Math.round(parseFloat(overall?.minPrice) || 0),
      maxPrice:        Math.round(parseFloat(overall?.maxPrice) || 0),
      listingCount:    parseInt(overall?.buyListingCount) || 0,
      trend,
      trendPct:        Math.abs(trendPct),
      avgMonthlyRent:  Math.round(avgRent),
      rentYield,
      buySavingsPct,
      localities,
      dataWindow:      '90d',
      lastUpdated:     new Date().toISOString(),
    };

    // ── Persist to snapshot cache ─────────────────────────────────────────────
    if (city || state) {
      try {
        const existing = city
          ? await this.snapshotRepo.findOne({ where: { city } as any })
          : await this.snapshotRepo.findOne({ where: { state, city: null as any } as any });

        const entity = existing || this.snapshotRepo.create({ city: city || null, state: state || null });
        entity.avgPsf           = currentPsf;
        entity.prevAvgPsf       = prevPsf;
        entity.trend            = trend;
        entity.trendPct         = Math.abs(trendPct);
        entity.avgPrice         = avgBuyPrice;
        entity.minPrice         = parseFloat(overall?.minPrice) || 0;
        entity.maxPrice         = parseFloat(overall?.maxPrice) || 0;
        entity.listingCount     = parseInt(overall?.buyListingCount) || 0;
        entity.totalListingCount = parseInt(overall?.totalListingCount) || 0;
        entity.avgMonthlyRent   = avgRent;
        entity.rentYield        = rentYield;
        entity.buySavingsPct    = buySavingsPct;
        entity.topLocalities    = localities;
        await this.snapshotRepo.save(entity);
      } catch (e) {
        this.logger.warn('Failed to save market snapshot', e);
      }
    }

    return result;
  }

  // ─── Bulk refresh all cities that have listings ───────────────────────────────
  async refreshAllMarketSnapshots() {
    this.logger.log('Refreshing all market snapshots…');
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

    const prevViewMap = new Map(prevViews.map(r => [r.entityId, parseInt(r.cnt)]));

    // Build a map: propertyType+city+state → metrics
    type MetricsKey = string;
    const metricsMap = new Map<MetricsKey, {
      type: string; city: string; state: string;
      listings: number; views: number; searches: number; prevViews: number;
    }>();

    const key = (type: string, city: string, state: string) =>
      `${type}|${city || ''}|${state || ''}`;

    for (const r of listingCounts) {
      const k = key(r.type, r.city, r.state);
      const entry = metricsMap.get(k) || { type: r.type, city: r.city, state: r.state, listings: 0, views: 0, searches: 0, prevViews: 0 };
      entry.listings = parseInt(r.cnt);
      metricsMap.set(k, entry);
    }

    for (const r of viewCounts) {
      const k = key(r.entityId, r.city, r.state);
      const entry = metricsMap.get(k) || { type: r.entityId, city: r.city, state: r.state, listings: 0, views: 0, searches: 0, prevViews: 0 };
      entry.views += parseInt(r.cnt);
      metricsMap.set(k, entry);
    }

    for (const r of searchCounts) {
      const k = key(r.entityId, r.city, r.state);
      const entry = metricsMap.get(k) || { type: r.entityId, city: r.city, state: r.state, listings: 0, views: 0, searches: 0, prevViews: 0 };
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

        const meta = PROPERTY_TYPE_META[e.type] || { label: e.type, icon: '🏠' };

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
        p.id, p.city, p.state, p.createdAt, p.viewCount,
        p.isFeatured, p.isPremium, p.listingPlan,
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

      // Active boost window
      const boostActive = p.boostExpiresAt && new Date(p.boostExpiresAt) > new Date() ? 1 : 0;

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
        planBoost  * w.FEATURED_PLAN         +
        boostActive * 100 * w.FEATURED_BOOST_ACTIVE +
        perfNorm   * w.FEATURED_PERFORMANCE;

      propertyUpdates.push({
        id: p.id,
        viewsLast7d:     views7d,
        inquiriesLast7d: inq7d,
        savesLast7d:     saves7d,
        listingScore:    Math.round(listingScore * 10) / 10,
        featuredScore:   Math.round(featuredScore * 10) / 10,
        dealScore:       0,  // computed separately in refreshPropertyHotScores
      });

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
    for (const [, group] of grouped) {
      group.sort((a, b) => (b.score as number) - (a.score as number));
      group.slice(0, 20).forEach((r, i) => { r.rank = i + 1; ranked.push(r); });
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

    // 24h engagement
    const [views24h, inq24h, saves24h] = await Promise.all([
      this.dataSource.query<{ entityId: string; cnt: string }[]>(`
        SELECT ae.entityId, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'property_view' AND ae.entityType = 'property'
          AND ae.createdAt >= ?
        GROUP BY ae.entityId
      `, [since24h]),

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
             inquiriesLast24h = ?,
             savesLast7d = ?,
             dealScore = ?,
             isHotDeal = ?,
             isTrending = ?,
             hotTagExpiresAt = ?
           WHERE id = ?`,
          [u.viewsLast24h, u.inquiriesLast24h, u.savesLast7d,
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

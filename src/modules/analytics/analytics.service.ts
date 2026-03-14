import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { TopPropertiesCache } from './entities/top-properties-cache.entity';
import { TopAgentsCache } from './entities/top-agents-cache.entity';
import { TopProjectsCache } from './entities/top-projects-cache.entity';
import { TopLocationsCache } from './entities/top-locations-cache.entity';
import { CategoryAnalytics } from './entities/category-analytics.entity';

// ─── Scoring Weights ──────────────────────────────────────────────────────────
const W = {
  // Property score weights
  PROP_VIEWS:     0.25,
  PROP_INQUIRIES: 0.40,
  PROP_SAVES:     0.20,
  PROP_RECENCY:   0.15,

  // Agent score weights
  AGENT_RATING:    0.30,
  AGENT_LISTINGS:  0.25,
  AGENT_VIEWS:     0.20,
  AGENT_DEALS:     0.25,

  // Location score weights
  LOC_PROPS:     0.30,
  LOC_SEARCHES:  0.25,
  LOC_VIEWS:     0.25,
  LOC_INQUIRIES: 0.20,

  // Category score weights
  CAT_LISTINGS:  0.25,
  CAT_VIEWS:     0.30,
  CAT_SEARCHES:  0.20,
  CAT_INQUIRIES: 0.15,
  CAT_SAVES:     0.10,
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

    private readonly dataSource: DataSource,
  ) {}

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

    // Build location-aware WHERE
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

    // If cache is empty, fall back to live query
    if (rows.length === 0) {
      return this.getLiveCategoryData(filters, limit);
    }

    return rows.map(r => ({
      propertyType:  r.propertyType,
      label:         r.label,
      icon:          r.icon,
      totalListings: r.totalListings,
      totalViews:    r.totalViews,
      totalSearches: r.totalSearches,
      score:         Number(r.score),
      rank:          r.rank,
      isTrending:    r.isTrending,
      trendingScore: Number(r.trendingScore),
    }));
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

  async aggregateProperties(): Promise<void> {
    this.logger.log('Aggregating top properties cache…');
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Pull engagement metrics from analytics_events
    const propViews: { entityId: string; city: string; state: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT ae.entityId, ae.city, ae.state, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'property_view' AND ae.entityType = 'property'
          AND ae.createdAt >= ?
        GROUP BY ae.entityId, ae.city, ae.state
      `, [since7d]);

    const propInquiries: { entityId: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT ae.entityId, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'property_inquiry' AND ae.entityType = 'property'
          AND ae.createdAt >= ?
        GROUP BY ae.entityId
      `, [since7d]);

    const propSaves: { entityId: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT ae.entityId, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'property_save' AND ae.entityType = 'property'
          AND ae.createdAt >= ?
        GROUP BY ae.entityId
      `, [since7d]);

    const viewMap    = new Map(propViews.map(r    => [r.entityId, { cnt: parseInt(r.cnt), city: r.city, state: r.state }]));
    const inqMap     = new Map(propInquiries.map(r => [r.entityId, parseInt(r.cnt)]));
    const savesMap   = new Map(propSaves.map(r    => [r.entityId, parseInt(r.cnt)]));

    // Get properties from main DB grouped by tab bucket
    const allProps: any[] = await this.dataSource.query(`
      SELECT p.id, p.isFeatured, p.isPremium, p.possessionStatus,
             p.city, p.state, p.createdAt, p.viewCount
      FROM properties p
      WHERE p.approvalStatus = 'approved' AND p.status = 'active'
    `);

    const now = Date.now();
    const toUpsert: Partial<TopPropertiesCache>[] = [];

    for (const p of allProps) {
      const views     = (viewMap.get(p.id)?.cnt || 0) + (p.viewCount || 0) * 0.1;
      const inquiries = inqMap.get(p.id) || 0;
      const saves     = savesMap.get(p.id) || 0;
      const daysOld   = (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const recency   = Math.max(0, (30 - daysOld) / 30) * 100;

      const score =
        views     * W.PROP_VIEWS     +
        inquiries * W.PROP_INQUIRIES +
        saves     * W.PROP_SAVES     +
        recency   * W.PROP_RECENCY;

      const tabs: string[] = [];
      if (p.isFeatured)                             tabs.push('featured');
      if (p.isPremium)                              tabs.push('premium');
      if (p.possessionStatus === 'under_construction') tabs.push('new_projects');
      tabs.push('just_listed');    // all recent properties qualify
      tabs.push('most_viewed');    // all qualify; sorted by score

      for (const tab of tabs) {
        toUpsert.push({
          propertyId:     p.id,
          score,
          rank:           0,
          viewsCount:     Math.floor(views),
          inquiriesCount: inquiries,
          savesCount:     saves,
          tab,
          period:         '7d',
          country:        '',
          state:          p.state || '',
          city:           p.city  || '',
        });
      }
    }

    // Rank within each (tab + city/state) bucket
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
      // Insert in batches of 500
      for (let i = 0; i < ranked.length; i += 500) {
        await this.topPropsRepo.save(ranked.slice(i, i + 500) as TopPropertiesCache[]);
      }
    }

    this.logger.log(`Properties cache refreshed: ${ranked.length} records`);
  }

  async aggregateAgents(): Promise<void> {
    this.logger.log('Aggregating top agents cache…');
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const profileViews: { entityId: string; city: string; state: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT ae.entityId, ae.city, ae.state, COUNT(*) AS cnt
        FROM analytics_events ae
        WHERE ae.eventType = 'agent_profile_view' AND ae.entityType = 'agent'
          AND ae.createdAt >= ?
        GROUP BY ae.entityId, ae.city, ae.state
      `, [since7d]);

    const agentInquiries: { entityId: string; cnt: string }[] =
      await this.dataSource.query(`
        SELECT i.agent_id AS entityId, COUNT(*) AS cnt
        FROM inquiries i
        WHERE i.createdAt >= ?
        GROUP BY i.agent_id
      `, [since7d]);

    const agents: any[] = await this.dataSource.query(`
      SELECT u.id, u.city, u.state, u.agentRating, u.totalDeals,
             u.agentExperience,
             COUNT(p.id) AS listingsCount
      FROM users u
      LEFT JOIN properties p ON p.owner_id = u.id AND p.approvalStatus = 'approved' AND p.status = 'active'
      WHERE u.role = 'agent' AND u.isActive = 1
      GROUP BY u.id
    `);

    const viewMap = new Map(profileViews.map(r => [
      r.entityId,
      { cnt: parseInt(r.cnt), city: r.city, state: r.state },
    ]));
    const inqMap = new Map(agentInquiries.map(r => [r.entityId, parseInt(r.cnt)]));

    const toUpsert: Partial<TopAgentsCache>[] = [];

    for (const a of agents) {
      const views    = viewMap.get(a.id)?.cnt || 0;
      const inqs     = inqMap.get(a.id) || 0;
      const listings = parseInt(a.listingsCount) || 0;
      const rating   = parseFloat(a.agentRating) || 0;
      const deals    = parseInt(a.totalDeals) || 0;

      const score =
        (rating * 20)  * W.AGENT_RATING   +
        (listings * 5) * W.AGENT_LISTINGS +
        views          * W.AGENT_VIEWS    +
        (deals * 3)    * W.AGENT_DEALS;

      // Record for the agent's own city+state bucket + global
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
          profileViews:   views,
          listingsCount:  listings,
          inquiriesCount: inqs,
          country:        '',
          state:          b.state,
          city:           b.city,
        });
      }
    }

    // Rank per bucket
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

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchLog } from './entities/search-log.entity';
import {
  UserBehavior,
  BehaviorEventType,
  BEHAVIOR_SCORES,
  HOT_LEAD_THRESHOLD,
} from './entities/user-behavior.entity';
import { Lead, LeadSource, LeadStatus, LeadTemperature } from '../leads/entities/lead.entity';
import { City } from '../locations/entities/city.entity';

// ─── Types for centralized smart search ──────────────────────────────────────

export interface ParsedSearchQuery {
  /** Detected BHK / bedroom count */
  bedrooms?: number;
  /** Detected city name */
  city?: string;
  /** Detected locality */
  locality?: string;
  /** Max price (INR) */
  maxPrice?: number;
  /** Min price (INR) */
  minPrice?: number;
  /** Detected property type (enum value from PropertyType) */
  type?: string;
  /** High-level type group: residential or commercial */
  typeGroup?: 'residential' | 'commercial';
  /** Detected category (buy/rent/pg/commercial) */
  category?: string;
  /** Whether query has a "near/nearby" intent */
  nearbySearch: boolean;
}

export interface SmartSearchResult {
  /** Structured URL params for GET /properties */
  filters: Record<string, string>;
  /** Ready-to-use redirect URL */
  redirectUrl: string;
  /** Parsed query summary chips for UI display */
  chips: { key: string; label: string; value: string }[];
  /** Whether nearby/geo search was requested */
  nearbySearch: boolean;
  /** The full parsed query details */
  parsed: ParsedSearchQuery;
}

// ─── Type group sets ─────────────────────────────────────────────────────────
const RESIDENTIAL_TYPES = new Set([
  'apartment', 'villa', 'house', 'builder_floor', 'penthouse',
  'studio', 'plot', 'farm_house', 'co_living', 'pg',
]);
const COMMERCIAL_TYPES = new Set([
  'commercial_office', 'commercial_shop', 'commercial_warehouse',
  'factory', 'showroom', 'industrial_shed', 'land',
]);

// ─── Type display labels ──────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  apartment: 'Flat/Apartment', villa: 'Villa', house: 'House',
  builder_floor: 'Builder Floor', penthouse: 'Penthouse', studio: 'Studio',
  plot: 'Plot', farm_house: 'Farmhouse', co_living: 'Co-Living', pg: 'PG',
  commercial_office: 'Office Space', commercial_shop: 'Shop',
  commercial_warehouse: 'Warehouse', factory: 'Factory/Industrial',
  showroom: 'Showroom', industrial_shed: 'Industrial Shed', land: 'Land',
};

export class LogSearchDto {
  userId?: string;
  searchQuery: string;
  parsedFilters?: Record<string, any>;
  latitude?: number;
  longitude?: number;
  resultCount?: number;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class TrackBehaviorDto {
  userId?: string;
  propertyId: string;
  eventType: BehaviorEventType;
  duration?: number;
  sessionId?: string;
  ipAddress?: string;
  /** Optional contact info for auto lead creation on CONTACT/INQUIRY events */
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

@Injectable()
export class SmartSearchService {
  private readonly logger = new Logger(SmartSearchService.name);

  constructor(
    @InjectRepository(SearchLog)
    private searchLogRepo: Repository<SearchLog>,
    @InjectRepository(UserBehavior)
    private behaviorRepo: Repository<UserBehavior>,
    @InjectRepository(Lead)
    private leadRepo: Repository<Lead>,
    @InjectRepository(City)
    private cityRepo: Repository<City>,
  ) {}

  // ─── Log a search ────────────────────────────────────────────────────────────

  async logSearch(dto: LogSearchDto): Promise<void> {
    try {
      await this.searchLogRepo.save(this.searchLogRepo.create(dto));
    } catch (err) {
      this.logger.warn(`Failed to log search: ${err.message}`);
    }
  }

  // ─── Track user behavior event ───────────────────────────────────────────────

  async trackBehavior(dto: TrackBehaviorDto): Promise<{ cumulativeScore: number; isHotLead: boolean }> {
    const score = BEHAVIOR_SCORES[dto.eventType] ?? 0;

    // Compute cumulative score for this identity × property
    const identity = dto.userId ?? dto.sessionId ?? dto.ipAddress ?? 'unknown';
    const prevEvents = await this.behaviorRepo
      .createQueryBuilder('ub')
      .select('SUM(ub.score)', 'total')
      .where(dto.userId
        ? 'ub.userId = :id AND ub.propertyId = :pid'
        : 'ub.sessionId = :id AND ub.propertyId = :pid',
        { id: dto.userId ?? dto.sessionId, pid: dto.propertyId })
      .getRawOne();

    const prevScore = Number(prevEvents?.total ?? 0);
    const cumulativeScore = prevScore + score;

    await this.behaviorRepo.save(
      this.behaviorRepo.create({
        userId: dto.userId,
        propertyId: dto.propertyId,
        eventType: dto.eventType,
        duration: dto.duration,
        score,
        cumulativeScore,
        sessionId: dto.sessionId,
        ipAddress: dto.ipAddress,
      }),
    );

    const isHotLead = cumulativeScore >= HOT_LEAD_THRESHOLD;

    // Auto-create / upgrade lead when threshold crossed for the first time
    if (isHotLead && score > 0) {
      await this.upsertBehaviorLead(dto, cumulativeScore);
    }

    return { cumulativeScore, isHotLead };
  }

  // ─── Auto lead upsert from behavior ─────────────────────────────────────────

  private async upsertBehaviorLead(dto: TrackBehaviorDto, score: number): Promise<void> {
    try {
      const temperature = score >= HOT_LEAD_THRESHOLD ? LeadTemperature.HOT
        : score >= 5 ? LeadTemperature.WARM
        : LeadTemperature.COLD;

      // Check if lead already exists for this user × property
      const existing = dto.userId
        ? await this.leadRepo.findOne({ where: { contactUserId: dto.userId, propertyId: dto.propertyId } })
        : null;

      if (existing) {
        // Upgrade temperature if it improved
        const tempOrder = { [LeadTemperature.COLD]: 0, [LeadTemperature.WARM]: 1, [LeadTemperature.HOT]: 2 };
        if (tempOrder[temperature] > tempOrder[existing.temperature]) {
          existing.temperature = temperature;
          existing.leadScore = score;
          await this.leadRepo.save(existing);
        }
        return;
      }

      // Only auto-create lead with contact info OR for HOT leads based on behavior
      const source = dto.eventType === BehaviorEventType.CONTACT
        ? LeadSource.CALL
        : dto.eventType === BehaviorEventType.INQUIRY
          ? LeadSource.ENQUIRY
          : LeadSource.PROPERTY_PAGE;

      if (dto.contactPhone || temperature === LeadTemperature.HOT) {
        await this.leadRepo.save(
          this.leadRepo.create({
            propertyId: dto.propertyId,
            contactUserId: dto.userId,
            contactName: dto.contactName ?? 'Visitor',
            contactPhone: dto.contactPhone ?? '',
            contactEmail: dto.contactEmail,
            source,
            temperature,
            leadScore: score,
            status: LeadStatus.NEW,
            sessionId: dto.sessionId,
          }),
        );
      }
    } catch (err) {
      this.logger.warn(`Auto-lead upsert failed: ${err.message}`);
    }
  }

  // ─── Centralized smart search parser ─────────────────────────────────────────

  /**
   * Parse a natural language query into structured filters + redirect URL.
   * This is the core of the Global Smart Search system.
   * No DB access needed — pure text analysis.
   */
  async parseQuery(rawQuery: string, categoryOverride?: string): Promise<SmartSearchResult> {
    const parsed: ParsedSearchQuery = { nearbySearch: false };
    // Normalise SEO slug-style input: "flat-in-noida" → "flat in noida"
    // All type-map entries already support both hyphen and space, so this is safe.
    let text = rawQuery.replace(/-/g, ' ').toLowerCase().trim();

    // ── Helper: convert amount + unit to INR ─────────────────────────────────
    const toINR = (num: string, unit: string): number => {
      const amt = parseFloat(num);
      const u = (unit || '').toLowerCase().trim();
      if (u.startsWith('cr')) return amt * 10_000_000;
      if (u === 'k' || u === 'thousand') return amt * 1_000;
      return amt * 100_000; // lakh / lac / l / default
    };

    // 1. BHK / bedrooms  (also strips "1 rk" — handled in type map below)
    const bedroomMatch = text.match(/\b(\d+)\s*[-]?\s*(?:bhk|bedroom[s]?|bed)\b/i);
    if (bedroomMatch) {
      parsed.bedrooms = parseInt(bedroomMatch[1]);
      text = text.replace(bedroomMatch[0], '').trim();
    }

    // 2. Budget — range first (more specific), then upper/lower bounds
    //    Handles: "50L to 1Cr", "50 lakh – 80 lakh", "under 50 lakh", "above 1 cr"
    const budgetRange = text.match(
      /\b(\d+(?:\.\d+)?)\s*(lakh|lac|l|crore|cr|k|thousand)?\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*(lakh|lac|l|crore|cr|k|thousand)\b/i,
    );
    if (budgetRange && !parsed.maxPrice) {
      parsed.minPrice = toINR(budgetRange[1], budgetRange[2] || '');
      parsed.maxPrice = toINR(budgetRange[3], budgetRange[4]);
      text = text.replace(budgetRange[0], '').trim();
    }

    if (!parsed.maxPrice) {
      const budgetUnder = text.match(
        /\b(?:under|below|upto|up\s+to|within|less\s+than|max(?:imum)?)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakh|lac|l|crore|cr|k|thousand)?\b/i,
      );
      if (budgetUnder) {
        parsed.maxPrice = toINR(budgetUnder[1], budgetUnder[2] || '');
        text = text.replace(budgetUnder[0], '').trim();
      }
    }

    if (!parsed.minPrice) {
      const budgetAbove = text.match(
        /\b(?:above|over|more\s+than|min(?:imum)?|starting\s+(?:from|at)?|from)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakh|lac|l|crore|cr|k|thousand)?\b/i,
      );
      if (budgetAbove) {
        parsed.minPrice = toINR(budgetAbove[1], budgetAbove[2] || '');
        text = text.replace(budgetAbove[0], '').trim();
      }
    }

    // 3. Property type — STRICT matching, multi-word phrases FIRST
    const typeMap: [string, string][] = [
      // Multi-word first (order matters — more specific before generic)
      ['service[\\s\\-]apartment',   'apartment'],
      ['commercial[\\s\\-]warehouse','commercial_warehouse'],
      ['commercial[\\s\\-]office',   'commercial_office'],
      ['commercial[\\s\\-]shop',     'commercial_shop'],
      ['industrial[\\s\\-]shed',     'industrial_shed'],
      ['builder[\\s\\-]floor',       'builder_floor'],
      ['independent[\\s\\-]floor',   'builder_floor'],
      ['office[\\s\\-]space',        'commercial_office'],
      ['farm[\\s\\-]house',          'farm_house'],
      ['paying[\\s\\-]guest',        'pg'],
      ['co[\\s\\-]?living',          'co_living'],
      // Single-word
      ['apartment',     'apartment'],
      ['flat(?:s)?',    'apartment'],          // flat / flats → apartment
      ['unit',          'apartment'],          // unit → apartment
      ['villa(?:s)?',   'villa'],
      ['bungalow',      'villa'],
      ['penthouse',     'penthouse'],
      ['studio',        'studio'],
      ['1\\s*rk',       'studio'],             // 1 RK → studio
      ['farmhouse',     'farm_house'],
      ['warehouse',     'commercial_warehouse'],
      ['showroom',      'showroom'],
      ['factory',       'factory'],
      ['plot(?:s)?',    'plot'],
      ['land',          'plot'],               // land → plot (same category)
      ['independent',   'house'],
      ['house(?:s)?',   'house'],
      ['home',          'house'],
      ['pg',            'pg'],
      ['hostel',        'pg'],
      ['office',        'commercial_office'],
      ['shop(?:s)?',    'commercial_shop'],
      ['industrial',    'factory'],
    ];
    for (const [key, val] of typeMap) {
      const re = new RegExp(`\\b${key}\\b`, 'i');
      if (re.test(text)) {
        parsed.type = val;
        parsed.typeGroup = RESIDENTIAL_TYPES.has(val) ? 'residential'
          : COMMERCIAL_TYPES.has(val) ? 'commercial'
          : undefined;
        text = text.replace(re, '').trim();
        break;
      }
    }

    // 4. Nearby intent
    parsed.nearbySearch = /\b(?:near\s+me|nearby|close\s+to)\b/i.test(text);

    // 5. Category from context — evaluated BEFORE location stripping so keywords are present
    if (!categoryOverride) {
      if (/\b(?:for\s+rent|on\s+rent|to\s+rent|rent(?:al)?|lease|on\s+lease)\b/i.test(rawQuery)) {
        parsed.category = 'rent';
      } else if (/\b(?:for\s+sale|to\s+buy|buy|purchase)\b/i.test(rawQuery)) {
        parsed.category = 'buy';
      } else if (/\bpg\b|\bhostel\b|\bpaying\s+guest\b/i.test(rawQuery)) {
        parsed.category = 'pg';
      } else if (/\bnew\s+project(?:s)?\b/i.test(rawQuery)) {
        parsed.category = 'new_projects';
      } else if (/\bbuilder\s+project(?:s)?\b/i.test(rawQuery)) {
        parsed.category = 'builder_project';
      } else if (/\binvestment\b/i.test(rawQuery)) {
        parsed.category = 'investment';
      } else if (/\bcommercial\b/i.test(rawQuery)) {
        parsed.category = 'commercial';
      } else if (/\bindustrial\b/i.test(rawQuery)) {
        parsed.category = 'industrial';
      }
      // Infer category from type when not explicitly mentioned
      if (!parsed.category && parsed.type) {
        if (COMMERCIAL_TYPES.has(parsed.type)) parsed.category = 'commercial';
        if (parsed.type === 'factory' || parsed.type === 'industrial_shed') parsed.category = 'industrial';
        if (parsed.type === 'pg' || parsed.type === 'co_living') parsed.category = 'pg';
      }
    } else {
      parsed.category = categoryOverride;
    }

    // 6. Location extraction — "in X", "at X"  (stripped after category detection)
    const locMatch = text.match(
      /\b(?:in|at)\s+([a-z0-9][a-z0-9\s\-]{1,30}?)(?:\s+(?:under|below|upto|above|for|with|near)|$)/i,
    );
    if (locMatch) {
      const loc = locMatch[1].trim().replace(/\s+/g, ' ');
      // Locality signals: sector, phase, block, nagar, vihar, colony, etc.
      if (/\b(?:sector|phase|block|nagar|vihar|enclave|colony|road|marg|street|expressway|layout|extension|hills|gardens?|park)\b/i.test(loc)) {
        parsed.locality = loc;
      } else {
        parsed.city = loc;
      }
      text = text.replace(locMatch[0], '').trim();
    }

    // 7. Normalise city against DB — fixes casing + catches partial matches
    //    e.g. "south delhi" → "South Delhi", "bengaluru" → "Bangalore"
    if (parsed.city) {
      try {
        // Exact case-insensitive match first (fastest, handles 99% of cases)
        let match = await this.cityRepo
          .createQueryBuilder('c')
          .select(['c.id', 'c.name'])
          .where('LOWER(c.name) = LOWER(:city)', { city: parsed.city })
          .andWhere('c.isActive = true')
          .getOne();

        // Fallback: partial LIKE match (handles "greater noida" prefix etc.)
        if (!match) {
          match = await this.cityRepo
            .createQueryBuilder('c')
            .select(['c.id', 'c.name'])
            .where('LOWER(c.name) LIKE :city', { city: `%${parsed.city.toLowerCase()}%` })
            .andWhere('c.isActive = true')
            .orderBy('LENGTH(c.name)', 'ASC') // prefer shortest match
            .getOne();
        }

        if (match) parsed.city = match.name; // use DB-canonical casing
      } catch {
        // DB lookup failed — keep raw parsed city, no hard failure
      }
    }

    // 8. Build URL filters
    const filters: Record<string, string> = {};
    if (parsed.bedrooms)  filters.bedrooms  = String(parsed.bedrooms);
    if (parsed.type)      filters.type      = parsed.type;
    if (parsed.city)      filters.city      = parsed.city;
    if (parsed.locality)  filters.locality  = parsed.locality;
    if (parsed.maxPrice)  filters.maxPrice  = String(parsed.maxPrice);
    if (parsed.minPrice)  filters.minPrice  = String(parsed.minPrice);
    if (parsed.category)  filters.category  = parsed.category;

    const qs = new URLSearchParams(filters).toString();
    const redirectUrl = `/properties${qs ? `?${qs}` : ''}`;

    // 8. Build user-friendly chips
    const chips: { key: string; label: string; value: string }[] = [];
    if (parsed.bedrooms)  chips.push({ key: 'bedrooms', label: `${parsed.bedrooms} BHK`, value: String(parsed.bedrooms) });
    if (parsed.type)      chips.push({ key: 'type', label: TYPE_LABELS[parsed.type] || parsed.type, value: parsed.type });
    if (parsed.city)      chips.push({ key: 'city', label: parsed.city, value: parsed.city });
    if (parsed.locality)  chips.push({ key: 'locality', label: parsed.locality, value: parsed.locality });
    if (parsed.category)  chips.push({ key: 'category', label: parsed.category, value: parsed.category });
    if (parsed.maxPrice) {
      const label = parsed.maxPrice >= 10_000_000
        ? `Under ₹${(parsed.maxPrice / 10_000_000).toFixed(1)}Cr`
        : `Under ₹${(parsed.maxPrice / 100_000).toFixed(0)}L`;
      chips.push({ key: 'maxPrice', label, value: String(parsed.maxPrice) });
    }
    if (parsed.minPrice) {
      const label = parsed.minPrice >= 10_000_000
        ? `Above ₹${(parsed.minPrice / 10_000_000).toFixed(1)}Cr`
        : `Above ₹${(parsed.minPrice / 100_000).toFixed(0)}L`;
      chips.push({ key: 'minPrice', label, value: String(parsed.minPrice) });
    }

    return { filters, redirectUrl, chips, nearbySearch: parsed.nearbySearch, parsed };
  }

  // ─── Trending searches ────────────────────────────────────────────────────────

  async getTrendingSearches(limit = 8): Promise<{ query: string; count: number }[]> {
    const rows = await this.searchLogRepo
      .createQueryBuilder('sl')
      .select('sl.searchQuery', 'query')
      .addSelect('COUNT(*)', 'cnt')
      .where('sl.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
      .andWhere('LENGTH(sl.searchQuery) > 2')
      .groupBy('sl.searchQuery')
      .orderBy('cnt', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map(r => ({ query: r.query, count: Number(r.cnt) }));
  }

  // ─── User search history ─────────────────────────────────────────────────────

  async getUserSearchHistory(userId: string, limit = 5): Promise<SearchLog[]> {
    return this.searchLogRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

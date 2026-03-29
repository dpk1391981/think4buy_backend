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
import { PropType } from '../property-config/entities/prop-type.entity';
import { SearchKeywordMapping } from '../property-config/entities/search-keyword-mapping.entity';

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
  /** Furnishing status extracted from query */
  furnishingStatus?: 'furnished' | 'semi_furnished' | 'unfurnished';
  /** Possession status extracted from query */
  possessionStatus?: 'ready_to_move' | 'under_construction';
  /** Minimum area (sq ft) */
  minArea?: number;
  /** Maximum area (sq ft) */
  maxArea?: number;
  /** Lifestyle/amenity keywords extracted (near metro, parking, etc.) */
  lifestyleTags?: string[];
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
  /** Suggested city correction when user city was unrecognised */
  didYouMean?: string;
}

// ─── Type group sets ─────────────────────────────────────────────────────────
const RESIDENTIAL_TYPES = new Set([
  'apartment', 'flat', 'villa', 'house', 'builder_floor', 'penthouse',
  'studio', 'plot', 'farm_house', 'co_living', 'pg',
]);
const COMMERCIAL_TYPES = new Set([
  'commercial_office', 'commercial_shop', 'commercial_warehouse',
  'factory', 'showroom', 'industrial_shed', 'land',
]);

// ─── Type display labels ──────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  apartment: 'Flat/Apartment', flat: 'Flat/Apartment', villa: 'Villa', house: 'House',
  builder_floor: 'Builder Floor', penthouse: 'Penthouse', studio: 'Studio',
  plot: 'Plot', farm_house: 'Farmhouse', co_living: 'Co-Living', pg: 'PG',
  commercial_office: 'Office Space', commercial_shop: 'Shop',
  commercial_warehouse: 'Warehouse', factory: 'Factory/Industrial',
  showroom: 'Showroom', industrial_shed: 'Industrial Shed', land: 'Land',
};

// ─── Lifestyle/amenity keyword patterns ──────────────────────────────────────
// Each entry: [regex, canonical tag label]
const LIFESTYLE_PATTERNS: [RegExp, string][] = [
  [/\bnear\s+metro\b|\bmetro[\s-]?nearby\b|\bmetro[\s-]?station\b/i, 'Near Metro'],
  [/\bwith\s+parking\b|\bparking\s*(?:available|space|slot)?\b/i, 'Parking'],
  [/\bswimming\s*pool\b|\bpool\b/i, 'Swimming Pool'],
  [/\bgym\b|\bfitness\s*(?:center|centre)?\b/i, 'Gym'],
  [/\bgated\s*(?:society|community|complex|colony)?\b/i, 'Gated Society'],
  [/\bpower\s*backup\b|\b24[\s\-]?(?:hr|hour|x7)\s*power\b/i, 'Power Backup'],
  [/\blift\b|\belevator\b/i, 'Lift'],
  [/\bpark[\s-]?facing\b|\bpark[\s-]?view\b/i, 'Park Facing'],
  [/\b24[\s\-x\/]*7\s*(?:security|guard)\b|\bsecurity\s*guard\b/i, '24×7 Security'],
  [/\bbalcony\b/i, 'Balcony'],
  [/\bmodular\s*kitchen\b/i, 'Modular Kitchen'],
  [/\bclub[\s-]?house\b|\bclubhouse\b/i, 'Clubhouse'],
  [/\bwifi\b|\binternet\s*(?:included|connection)?\b/i, 'WiFi'],
  [/\bwater\s*(?:supply|24[\s\-x\/]*7)\b|\b24[\s\-x\/]*7\s*water\b/i, '24×7 Water'],
  [/\bair[\s-]?conditioned\b|\bac\s*(?:rooms?)?\b/i, 'Air Conditioned'],
  [/\bpet[\s-]?friendly\b|\bpets?\s*allowed\b/i, 'Pet Friendly'],
  [/\bchildren\s*play\b|\bplay[\s-]?area\b|\bkids?\s*play\b/i, 'Play Area'],
  [/\bschool\s*nearby\b|\bnear\s*school\b/i, 'Near School'],
  [/\bhospital\s*nearby\b|\bnear\s*hospital\b/i, 'Near Hospital'],
  [/\bshopping\s*(?:mall|complex|centre)?\s*nearby\b|\bnear\s*mall\b/i, 'Near Mall'],
  [/\bcorner\s*(?:unit|flat|plot)?\b/i, 'Corner Unit'],
  [/\bsea[\s-]?facing\b|\bocean[\s-]?view\b/i, 'Sea Facing'],
  [/\bvaastu\b|\bvastu\b/i, 'Vastu Compliant'],
];

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

  /** In-memory cache for keyword mappings — refreshed every 5 minutes */
  private kwCache: SearchKeywordMapping[] | null = null;
  private kwCacheAt = 0;
  private readonly KW_CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    @InjectRepository(SearchLog)
    private searchLogRepo: Repository<SearchLog>,
    @InjectRepository(UserBehavior)
    private behaviorRepo: Repository<UserBehavior>,
    @InjectRepository(Lead)
    private leadRepo: Repository<Lead>,
    @InjectRepository(City)
    private cityRepo: Repository<City>,
    @InjectRepository(PropType)
    private propTypeRepo: Repository<PropType>,
    @InjectRepository(SearchKeywordMapping)
    private kwRepo: Repository<SearchKeywordMapping>,
  ) {}

  /** Load active keyword mappings from DB (cached). */
  private async getKeywordMappings(): Promise<SearchKeywordMapping[]> {
    const now = Date.now();
    if (this.kwCache && now - this.kwCacheAt < this.KW_CACHE_TTL_MS) {
      return this.kwCache;
    }
    try {
      this.kwCache = await this.kwRepo.find({
        where: { isActive: true },
        order: { sortOrder: 'ASC' },
      });
      this.kwCacheAt = now;
    } catch {
      // DB unavailable — return stale cache or empty
      this.kwCache = this.kwCache ?? [];
    }
    return this.kwCache;
  }

  /** Invalidate keyword cache (call after admin save). */
  invalidateKeywordCache() {
    this.kwCache = null;
  }

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

  // ─── Levenshtein distance (for "did you mean" city suggestions) ───────────────

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    // Use two rows instead of full matrix for memory efficiency
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    let curr = new Array(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        curr[j] = a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }

  // ─── Resolve type aliases (same logic as PropertiesService) ─────────────────

  private async resolveTypeAliases(slug: string): Promise<string[]> {
    try {
      const typeRecord = await this.propTypeRepo.findOne({ where: { slug, status: true } });
      const canonicalSlug = typeRecord?.aliasOf ?? slug;
      const aliasGroup = await this.propTypeRepo.find({
        where: [
          { slug: canonicalSlug, status: true },
          { aliasOf: canonicalSlug, status: true },
        ],
        select: ['slug'],
      });
      return [...new Set([slug, ...aliasGroup.map(t => t.slug)])];
    } catch {
      return [slug];
    }
  }

  // ─── Centralized smart search parser ─────────────────────────────────────────

  /**
   * Parse a natural language query into structured filters + redirect URL.
   * This is the core of the Global Smart Search system.
   * @param geoCoords  Optional GPS coords from the client — injected into the URL when
   *                   the query contains "near me" / "nearby" intent.
   */
  async parseQuery(
    rawQuery: string,
    categoryOverride?: string,
    geoCoords?: { lat: number; lng: number; radius?: number },
  ): Promise<SmartSearchResult> {
    const parsed: ParsedSearchQuery = { nearbySearch: false };
    let matchedTypeLabel: string | undefined;
    // Normalise SEO slug-style input: "flat-in-noida" → "flat in noida"
    let text = rawQuery.replace(/-/g, ' ').toLowerCase().trim();

    // ── Helper: convert amount + unit to INR ─────────────────────────────────
    const toINR = (num: string, unit: string): number => {
      const amt = parseFloat(num);
      const u = (unit || '').toLowerCase().trim();
      if (u.startsWith('cr')) return amt * 10_000_000;
      if (u === 'k' || u === 'thousand') return amt * 1_000;
      return amt * 100_000; // lakh / lac / l / default
    };

    // ── Helper: convert area to sq ft ────────────────────────────────────────
    const toSqFt = (num: string, unit: string): number => {
      const val = parseFloat(num);
      const u = (unit || '').toLowerCase().trim();
      if (u.startsWith('sqm') || u.startsWith('sq m')) return Math.round(val * 10.764);
      return val; // sq ft / sqft / sft / default
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

    // 2.5. Area extraction — "1000 sqft", "800 to 1200 sq ft", "1000 sq.ft"
    const areaRange = text.match(
      /\b(\d+(?:\.\d+)?)\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|sft|sq\.?\s*m(?:eter|etre)?s?|sqm)\b/i,
    );
    if (areaRange) {
      parsed.minArea = toSqFt(areaRange[1], areaRange[3]);
      parsed.maxArea = toSqFt(areaRange[2], areaRange[3]);
      text = text.replace(areaRange[0], '').trim();
    } else {
      const areaSingle = text.match(
        /\b(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|sft|sq\.?\s*m(?:eter|etre)?s?|sqm)\b/i,
      );
      if (areaSingle) {
        // Treat single area as minimum (user wants "at least X sqft")
        parsed.minArea = toSqFt(areaSingle[1], areaSingle[2]);
        text = text.replace(areaSingle[0], '').trim();
      }
    }

    // 3. Property type — load mappings from DB (cached), multi-word phrases FIRST by sortOrder
    const kwMappings = await this.getKeywordMappings();
    for (const kw of kwMappings) {
      if (!kw.mapsToType) continue; // category-only mappings handled in step 5
      try {
        const re = new RegExp(`\\b${kw.keyword}\\b`, 'i');
        if (re.test(text)) {
          parsed.type = kw.mapsToType;
          matchedTypeLabel = kw.label;
          parsed.typeGroup = RESIDENTIAL_TYPES.has(kw.mapsToType) ? 'residential'
            : COMMERCIAL_TYPES.has(kw.mapsToType) ? 'commercial'
            : undefined;
          // Apply explicit category override from the mapping
          if (kw.mapsToCategory && !parsed.category) {
            parsed.category = kw.mapsToCategory;
          }
          text = text.replace(re, '').trim();
          break;
        }
      } catch {
        // Skip malformed regex
      }
    }

    // 3.5. Furnishing status
    if (/\bsemi[\s\-]?furnished\b|\bsemi[\s\-]?furnish(?:ed)?\b/i.test(text)) {
      parsed.furnishingStatus = 'semi_furnished';
      text = text.replace(/\bsemi[\s\-]?furnished?\b/i, '').trim();
    } else if (/\bunfurnished\b|\bun[\s\-]?furnished\b|\bbare[\s\-]?shell\b/i.test(text)) {
      parsed.furnishingStatus = 'unfurnished';
      text = text.replace(/\bunfurnished\b|\bun[\s\-]?furnished\b|\bbare[\s\-]?shell\b/i, '').trim();
    } else if (/\bfurnished\b/i.test(text)) {
      parsed.furnishingStatus = 'furnished';
      text = text.replace(/\bfurnished\b/i, '').trim();
    }

    // 3.6. Possession status
    if (/\bready[\s\-]?to[\s\-]?move\b|\brtm\b|\bpossession[\s\-]?ready\b/i.test(text)) {
      parsed.possessionStatus = 'ready_to_move';
      text = text.replace(/\bready[\s\-]?to[\s\-]?move\b|\brtm\b|\bpossession[\s\-]?ready\b/i, '').trim();
    } else if (/\bunder[\s\-]?construction\b|\bnew[\s\-]?launch\b|\bpre[\s\-]?launch\b|\buc\b/i.test(text)) {
      parsed.possessionStatus = 'under_construction';
      text = text.replace(/\bunder[\s\-]?construction\b|\bnew[\s\-]?launch\b|\bpre[\s\-]?launch\b|\buc\b/i, '').trim();
    }

    // 4. Nearby intent — strip phrase so it doesn't pollute location extraction
    if (/\b(?:near\s+me|nearby|close\s+to)\b/i.test(text)) {
      parsed.nearbySearch = true;
      text = text.replace(/\b(?:near\s+me|nearby|close\s+to)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
    } else {
      parsed.nearbySearch = false;
    }

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

    // 5.5. Lifestyle / amenity keyword extraction
    //      Extract BEFORE location so "near metro in Noida" works correctly
    const extractedTags: string[] = [];
    for (const [pattern, tag] of LIFESTYLE_PATTERNS) {
      if (pattern.test(text)) {
        extractedTags.push(tag);
        text = text.replace(pattern, '').trim();
      }
    }
    if (extractedTags.length > 0) {
      parsed.lifestyleTags = extractedTags;
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

    // 6.5. Fallback city detection — if no city/locality parsed yet and text remains,
    //      try to match the leftover text directly against the cities DB.
    //      This handles bare city-name queries like "noida" (without "in/at" prefix).
    if (!parsed.city && !parsed.locality) {
      const remainder = text.trim();
      if (remainder.length > 1) {
        try {
          let fallbackMatch = await this.cityRepo
            .createQueryBuilder('c')
            .select(['c.id', 'c.name'])
            .where('LOWER(c.name) = LOWER(:city)', { city: remainder })
            .andWhere('c.isActive = true')
            .getOne();

          if (!fallbackMatch) {
            fallbackMatch = await this.cityRepo
              .createQueryBuilder('c')
              .select(['c.id', 'c.name'])
              .where('LOWER(c.name) LIKE :city', { city: `%${remainder.toLowerCase()}%` })
              .andWhere('c.isActive = true')
              .orderBy('LENGTH(c.name)', 'ASC')
              .getOne();
          }

          if (fallbackMatch) {
            parsed.city = fallbackMatch.name;
            text = ''; // consumed
          }
        } catch {
          // ignore — DB lookup failure
        }
      }
    }

    // 7. Normalise city against DB — fixes casing + catches partial matches
    //    e.g. "south delhi" → "South Delhi", "bengaluru" → "Bangalore"
    let didYouMean: string | undefined;
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

        if (match) {
          parsed.city = match.name; // use DB-canonical casing
        } else {
          // No match at all — compute "did you mean" via Levenshtein
          const allCities = await this.cityRepo.find({
            where: { isActive: true },
            select: ['name'],
          });
          const inputLower = parsed.city.toLowerCase();
          let bestName = '';
          let bestDist = Infinity;
          for (const c of allCities) {
            const d = this.levenshtein(inputLower, c.name.toLowerCase());
            if (d < bestDist) {
              bestDist = d;
              bestName = c.name;
            }
          }
          // Only suggest if distance is within 40% of query length (or at most 3 chars)
          const threshold = Math.max(3, Math.floor(parsed.city.length * 0.4));
          if (bestName && bestDist <= threshold) {
            didYouMean = bestName;
          }
        }
      } catch {
        // DB lookup failed — keep raw parsed city, no hard failure
      }
    }

    // 8. Build URL filters
    const filters: Record<string, string> = {};
    if (parsed.bedrooms)          filters.bedrooms          = String(parsed.bedrooms);
    if (parsed.type)              filters.type              = parsed.type;
    if (parsed.maxPrice)          filters.maxPrice          = String(parsed.maxPrice);
    if (parsed.minPrice)          filters.minPrice          = String(parsed.minPrice);
    if (parsed.minArea)           filters.minArea           = String(parsed.minArea);
    if (parsed.maxArea)           filters.maxArea           = String(parsed.maxArea);
    if (parsed.category)          filters.category          = parsed.category;
    if (parsed.furnishingStatus)  filters.furnishingStatus  = parsed.furnishingStatus;
    if (parsed.possessionStatus)  filters.possessionStatus  = parsed.possessionStatus;
    // Lifestyle tags → keyword param (full-text search on property fields)
    if (parsed.lifestyleTags?.length) {
      filters.keyword = parsed.lifestyleTags.join(' ');
    }
    // Geo: when nearbySearch AND coords provided, use radius search instead of city/locality
    if (parsed.nearbySearch && geoCoords?.lat !== undefined && geoCoords?.lng !== undefined) {
      filters.lat    = String(geoCoords.lat);
      filters.lng    = String(geoCoords.lng);
      filters.radius = String(geoCoords.radius ?? 5);
    } else {
      // Standard city/locality only when not a geo search
      if (parsed.city)     filters.city     = parsed.city;
      if (parsed.locality) filters.locality = parsed.locality;
    }

    const qs = new URLSearchParams(filters).toString();
    const redirectUrl = `/properties${qs ? `?${qs}` : ''}`;

    // 9. Build user-friendly chips
    const chips: { key: string; label: string; value: string }[] = [];
    if (parsed.bedrooms)   chips.push({ key: 'bedrooms',  label: `${parsed.bedrooms} BHK`, value: String(parsed.bedrooms) });
    if (parsed.type)       chips.push({ key: 'type',      label: matchedTypeLabel || TYPE_LABELS[parsed.type] || parsed.type, value: parsed.type });
    if (parsed.nearbySearch && geoCoords?.lat !== undefined) {
      chips.push({ key: 'nearMe', label: 'Near Me', value: `${geoCoords.lat},${geoCoords.lng}` });
    } else {
      if (parsed.city)     chips.push({ key: 'city',     label: parsed.city,     value: parsed.city });
      if (parsed.locality) chips.push({ key: 'locality', label: parsed.locality, value: parsed.locality });
    }
    if (parsed.category)  chips.push({ key: 'category',  label: parsed.category, value: parsed.category });
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
    if (parsed.minArea && parsed.maxArea) {
      chips.push({ key: 'area', label: `${parsed.minArea}–${parsed.maxArea} sqft`, value: `${parsed.minArea}-${parsed.maxArea}` });
    } else if (parsed.minArea) {
      chips.push({ key: 'minArea', label: `${parsed.minArea}+ sqft`, value: String(parsed.minArea) });
    }
    if (parsed.furnishingStatus) {
      const furnishLabels: Record<string, string> = {
        furnished: 'Furnished', semi_furnished: 'Semi-Furnished', unfurnished: 'Unfurnished',
      };
      chips.push({ key: 'furnishingStatus', label: furnishLabels[parsed.furnishingStatus], value: parsed.furnishingStatus });
    }
    if (parsed.possessionStatus) {
      const possessionLabels: Record<string, string> = {
        ready_to_move: 'Ready to Move', under_construction: 'Under Construction',
      };
      chips.push({ key: 'possessionStatus', label: possessionLabels[parsed.possessionStatus], value: parsed.possessionStatus });
    }
    if (parsed.lifestyleTags?.length) {
      for (const tag of parsed.lifestyleTags) {
        chips.push({ key: 'lifestyle', label: tag, value: tag });
      }
    }

    return { filters, redirectUrl, chips, nearbySearch: parsed.nearbySearch, parsed, didYouMean };
  }

  // ─── Trending searches ────────────────────────────────────────────────────────

  async getTrendingSearches(limit = 8, category?: string): Promise<{ query: string; count: number }[]> {
    const qb = this.searchLogRepo
      .createQueryBuilder('sl')
      .select('sl.searchQuery', 'query')
      .addSelect('COUNT(*)', 'cnt')
      .where('sl.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
      .andWhere('LENGTH(sl.searchQuery) > 2');

    // Filter by category stored in parsedFilters JSON when provided
    if (category) {
      qb.andWhere(
        `JSON_UNQUOTE(JSON_EXTRACT(sl.parsedFilters, '$.category')) = :category`,
        { category },
      );
    }

    const rows = await qb
      .groupBy('sl.searchQuery')
      .orderBy('cnt', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map(r => ({ query: r.query, count: Number(r.cnt) }));
  }

  // ─── User search history ─────────────────────────────────────────────────────

  async getUserSearchHistory(userId: string, limit = 5, category?: string): Promise<SearchLog[]> {
    const qb = this.searchLogRepo
      .createQueryBuilder('sl')
      .where('sl.userId = :userId', { userId })
      .orderBy('sl.createdAt', 'DESC')
      .take(limit);

    if (category) {
      qb.andWhere(
        `JSON_UNQUOTE(JSON_EXTRACT(sl.parsedFilters, '$.category')) = :category`,
        { category },
      );
    }

    return qb.getMany();
  }
}

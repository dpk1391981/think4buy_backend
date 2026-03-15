import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';
import {
  Property,
  PropertyStatus,
  PropertyCategory,
  ApprovalStatus,
  PropertyType,
  ListingUserType,
} from './entities/property.entity';
import { PropertyImage } from './entities/property-image.entity';
import { Amenity } from './entities/amenity.entity';
import { PropertyView } from './entities/property-view.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { FilterPropertyDto } from './dto/filter-property.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { WalletService } from '../wallet/wallet.service';
import { TransactionReason } from '../wallet/entities/wallet-transaction.entity';

/** Parsed result from smart keyword NLP */
interface ParsedKeyword {
  bedrooms?: number;
  city?: string;
  locality?: string;
  maxPrice?: number;
  minPrice?: number;
  type?: string;
  category?: string;
  features?: string[];
  remainder?: string;
}

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    @InjectRepository(Property)
    private propertyRepo: Repository<Property>,
    @InjectRepository(PropertyImage)
    private imageRepo: Repository<PropertyImage>,
    @InjectRepository(Amenity)
    private amenityRepo: Repository<Amenity>,
    @InjectRepository(PropertyView)
    private viewRepo: Repository<PropertyView>,
    private walletService: WalletService,
  ) {}

  /** Runs every hour — expires paid boosts whose boostExpiresAt has passed */
  @Cron(CronExpression.EVERY_HOUR)
  async expireBoosts() {
    const result = await this.propertyRepo
      .createQueryBuilder()
      .update(Property)
      .set({ isFeatured: false })
      .where('isFeatured = :f', { f: true })
      .andWhere('boostExpiresAt IS NOT NULL')
      .andWhere('boostExpiresAt <= :now', { now: new Date() })
      .execute();
    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} property boost(s)`);
    }
  }

  /** Runs every 6 hours — auto-expires listings whose listingExpiresAt has passed */
  @Cron('0 */6 * * *')
  async expireListings() {
    const result = await this.propertyRepo
      .createQueryBuilder()
      .update(Property)
      .set({ status: PropertyStatus.INACTIVE })
      .where('status = :active', { active: PropertyStatus.ACTIVE })
      .andWhere('listingExpiresAt IS NOT NULL')
      .andWhere('listingExpiresAt <= :now', { now: new Date() })
      .execute();
    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} listing(s) past their listingExpiresAt`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Smart NLP keyword parser
  // ─────────────────────────────────────────────────────────────────────────────
  private parseKeyword(keyword: string): ParsedKeyword {
    const result: ParsedKeyword = {};
    let text = keyword.toLowerCase().trim();

    // Extract BHK / bedrooms: "2 bhk", "3 bedroom"
    const bedroomMatch = text.match(/(\d+)\s*(?:bhk|bedroom|bed)/i);
    if (bedroomMatch) {
      result.bedrooms = parseInt(bedroomMatch[1]);
      text = text.replace(bedroomMatch[0], '').trim();
    }

    // Extract budget "under X lakh/cr", "below X lakh", "upto X lakh", "less than X"
    const budgetUnderMatch = text.match(
      /(?:under|below|upto|up to|less than)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakh|lac|l|cr|crore|k)?/i,
    );
    if (budgetUnderMatch) {
      const amount = parseFloat(budgetUnderMatch[1]);
      const unit = (budgetUnderMatch[2] || '').toLowerCase();
      if (unit.startsWith('cr')) result.maxPrice = amount * 10000000;
      else if (unit === 'k') result.maxPrice = amount * 1000;
      else result.maxPrice = amount * 100000; // lakh default
      text = text.replace(budgetUnderMatch[0], '').trim();
    }

    // Extract "X lakh to Y lakh" range
    const budgetRangeMatch = text.match(
      /(\d+(?:\.\d+)?)\s*(lakh|lac|l|cr|crore)?\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(lakh|lac|l|cr|crore)/i,
    );
    if (budgetRangeMatch && !result.maxPrice) {
      const minAmt = parseFloat(budgetRangeMatch[1]);
      const minUnit = (budgetRangeMatch[2] || '').toLowerCase();
      const maxAmt = parseFloat(budgetRangeMatch[3]);
      const maxUnit = (budgetRangeMatch[4] || '').toLowerCase();
      result.minPrice = minUnit.startsWith('cr') ? minAmt * 10000000 : minAmt * 100000;
      result.maxPrice = maxUnit.startsWith('cr') ? maxAmt * 10000000 : maxAmt * 100000;
      text = text.replace(budgetRangeMatch[0], '').trim();
    }

    // Extract property type
    const typeMap: Record<string, string> = {
      apartment: 'apartment', flat: 'apartment', 'builder floor': 'builder_floor',
      villa: 'villa', bungalow: 'villa', house: 'house', independent: 'house',
      plot: 'plot', land: 'land', penthouse: 'penthouse', studio: 'studio',
      'office space': 'commercial_office', office: 'commercial_office',
      shop: 'commercial_shop', showroom: 'showroom', warehouse: 'commercial_warehouse',
      'farm house': 'farm_house', farmhouse: 'farm_house',
      pg: 'pg', 'paying guest': 'pg', hostel: 'pg',
      'co-living': 'co_living', coliving: 'co_living',
    };
    for (const [key, val] of Object.entries(typeMap)) {
      if (text.includes(key)) {
        result.type = val;
        text = text.replace(new RegExp(key, 'gi'), '').trim();
        break;
      }
    }

    // Extract category from context
    if (text.includes(' for rent') || text.includes(' on rent')) result.category = 'rent';
    else if (text.includes(' for sale') || text.includes(' buy ') || text.includes(' purchase ')) result.category = 'buy';
    else if (text.includes(' pg') || text.includes(' hostel')) result.category = 'pg';
    else if (text.includes(' commercial')) result.category = 'commercial';

    // Extract location after "in", "at", "near"
    const locationMatch = text.match(/\b(?:in|at|near)\s+([a-z\s\-]+?)(?:\s+(?:under|below|upto|for|with|$))/i);
    if (locationMatch) {
      const loc = locationMatch[1].trim();
      // Heuristic: if it looks like a locality/sector, set as locality; otherwise city
      if (/sector|phase|block|nagar|vihar|enclave|colony|road|marg|street/i.test(loc)) {
        result.locality = loc;
      } else {
        result.city = loc;
      }
      text = text.replace(locationMatch[0], '').trim();
    }

    // Special feature keywords
    const featureMap: Record<string, string> = {
      pool: 'Swimming Pool', 'swimming pool': 'Swimming Pool',
      gym: 'Gym', 'fitness': 'Gym',
      parking: 'Parking', garden: 'Garden',
      security: 'Security', club: 'Clubhouse',
      lift: 'Lift', elevator: 'Lift',
      metro: 'metro_nearby', furnished: 'furnished',
    };
    result.features = [];
    for (const [key, val] of Object.entries(featureMap)) {
      if (text.includes(key)) {
        result.features.push(val);
        text = text.replace(new RegExp(key, 'gi'), '').trim();
      }
    }

    result.remainder = text.replace(/\s+/g, ' ').trim();
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Search Suggestions (for autocomplete)
  // ─────────────────────────────────────────────────────────────────────────────
  async getSearchSuggestions(q: string): Promise<{
    type: string;
    label: string;
    subLabel?: string;
    value: string;
    extra?: string;
    count?: number;
  }[]> {
    if (!q || q.trim().length < 2) return [];
    const term = `%${q.trim()}%`;
    const results: any[] = [];

    // 1. Cities
    const cities = await this.propertyRepo
      .createQueryBuilder('p')
      .select('p.city', 'city')
      .addSelect('p.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .where('p.status = :status', { status: PropertyStatus.ACTIVE })
      .andWhere('p.approvalStatus = :approvalStatus', { approvalStatus: ApprovalStatus.APPROVED })
      .andWhere('p.city LIKE :term', { term })
      .groupBy('p.city')
      .addGroupBy('p.state')
      .orderBy('count', 'DESC')
      .limit(4)
      .getRawMany();

    for (const c of cities) {
      results.push({
        type: 'city',
        label: c.city,
        subLabel: c.state,
        value: c.city,
        count: parseInt(c.count),
      });
    }

    // 2. Localities
    const localities = await this.propertyRepo
      .createQueryBuilder('p')
      .select('p.locality', 'locality')
      .addSelect('p.city', 'city')
      .addSelect('COUNT(*)', 'count')
      .where('p.status = :status', { status: PropertyStatus.ACTIVE })
      .andWhere('p.approvalStatus = :approvalStatus', { approvalStatus: ApprovalStatus.APPROVED })
      .andWhere('p.locality LIKE :term', { term })
      .andWhere('p.locality IS NOT NULL')
      .andWhere("p.locality != ''")
      .groupBy('p.locality')
      .addGroupBy('p.city')
      .orderBy('count', 'DESC')
      .limit(4)
      .getRawMany();

    for (const l of localities) {
      results.push({
        type: 'locality',
        label: l.locality,
        subLabel: l.city,
        value: `${l.locality}|${l.city}`,
        count: parseInt(l.count),
      });
    }

    // 3. Builders / Developers
    const builders = await this.propertyRepo
      .createQueryBuilder('p')
      .select('p.builderName', 'builderName')
      .addSelect('COUNT(*)', 'count')
      .where('p.status = :status', { status: PropertyStatus.ACTIVE })
      .andWhere('p.approvalStatus = :approvalStatus', { approvalStatus: ApprovalStatus.APPROVED })
      .andWhere('p.builderName LIKE :term', { term })
      .andWhere('p.builderName IS NOT NULL')
      .andWhere("p.builderName != ''")
      .groupBy('p.builderName')
      .orderBy('count', 'DESC')
      .limit(3)
      .getRawMany();

    for (const b of builders) {
      results.push({
        type: 'builder',
        label: b.builderName,
        subLabel: 'Builder / Developer',
        value: b.builderName,
        extra: 'builder',
        count: parseInt(b.count),
      });
    }

    // 4. Projects / Society names
    const projects = await this.propertyRepo
      .createQueryBuilder('p')
      .select('p.society', 'society')
      .addSelect('p.city', 'city')
      .addSelect('COUNT(*)', 'count')
      .where('p.status = :status', { status: PropertyStatus.ACTIVE })
      .andWhere('p.approvalStatus = :approvalStatus', { approvalStatus: ApprovalStatus.APPROVED })
      .andWhere('p.society LIKE :term', { term })
      .andWhere('p.society IS NOT NULL')
      .andWhere("p.society != ''")
      .groupBy('p.society')
      .addGroupBy('p.city')
      .orderBy('count', 'DESC')
      .limit(3)
      .getRawMany();

    for (const pr of projects) {
      results.push({
        type: 'project',
        label: pr.society,
        subLabel: pr.city,
        value: pr.society,
        extra: 'project',
        count: parseInt(pr.count),
      });
    }

    return results.slice(0, 10);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────────────────────────────────────
  async create(dto: CreatePropertyDto, owner: User): Promise<Property> {
    // Security: Only Owner and Agent roles may create property listings
    if (owner.role === UserRole.BUYER) {
      throw new ForbiddenException(
        'Buyers cannot post properties. Please upgrade your role to Owner or Agent first.',
      );
    }

    // Quota check is skipped for drafts — only enforce on publish
    if (owner.role === UserRole.AGENT && !dto.isDraft) {
      // Quota is consumed on admin approval, not on submission.
      // Check current approved count against quota to prevent excess submissions.
      if (owner.agentUsedQuota >= owner.agentFreeQuota) {
        throw new BadRequestException(
          `Listing quota exhausted (${owner.agentUsedQuota}/${owner.agentFreeQuota} approved listings used). Please upgrade your subscription.`,
        );
      }
    }

    if (!dto.title || !dto.title.trim()) {
      const bedroomPrefix = dto.bedrooms ? `${dto.bedrooms} BHK ` : '';
      const typeMap: Record<string, string> = {
        apartment: 'Apartment', villa: 'Villa', house: 'Independent House',
        plot: 'Plot', studio: 'Studio', penthouse: 'Penthouse',
        commercial_office: 'Office Space', commercial_shop: 'Shop',
        commercial_warehouse: 'Warehouse', factory: 'Factory',
        land: 'Land', builder_floor: 'Builder Floor',
        farm_house: 'Farm House', showroom: 'Showroom',
        industrial_shed: 'Industrial Shed', pg: 'PG', co_living: 'Co-Living Space',
      };
      const categoryMap: Record<string, string> = {
        buy: 'for Sale', rent: 'for Rent', pg: 'for PG',
        commercial: '', industrial: 'for Rent', builder_project: 'Project',
        investment: 'for Investment',
      };
      const typeLabel = typeMap[dto.type] || dto.type;
      const catLabel = categoryMap[dto.category] || '';
      const location = dto.locality || dto.city || '';
      dto.title = `${bedroomPrefix}${typeLabel} ${catLabel} in ${location}`.trim();
    }

    const baseSlug = slugify(`${dto.title}-${dto.city}-${dto.locality}`, {
      lower: true,
      strict: true,
    });
    const slug = `${baseSlug}-${uuidv4().slice(0, 8)}`;

    let amenities: Amenity[] = [];
    if (dto.amenityIds?.length) {
      amenities = await this.amenityRepo.findByIds(dto.amenityIds);
    }

    const isAgentListing = owner.role === UserRole.AGENT;
    const isDraft = !!dto.isDraft;
    const property = this.propertyRepo.create({
      ...dto,
      slug,
      owner,
      ownerId: owner.id,
      amenities,
      isDraft,
      approvalStatus: ApprovalStatus.PENDING,
      status: isDraft ? PropertyStatus.INACTIVE : PropertyStatus.ACTIVE,
      listedBy: isAgentListing ? ListingUserType.AGENT : ListingUserType.OWNER,
      agentId: isAgentListing ? (dto.agentProfileId ?? null) : null,
      agencyId: isAgentListing ? (dto.agencyId ?? null) : null,
      metaTitle: `${dto.title} | ${dto.city}`,
      metaDescription: dto.description?.substring(0, 160),
    });

    return this.propertyRepo.save(property);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Publish Draft
  // ─────────────────────────────────────────────────────────────────────────────
  async publishDraft(id: string, user: User): Promise<Property> {
    const property = await this.findById(id);
    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only publish your own properties');
    }
    if (!property.isDraft) {
      throw new BadRequestException('Property is already published');
    }

    // Enforce agent quota on publish
    if (user.role === UserRole.AGENT) {
      if (user.agentUsedQuota >= user.agentFreeQuota) {
        throw new BadRequestException(
          `Listing quota exhausted (${user.agentUsedQuota}/${user.agentFreeQuota} approved listings used). Please upgrade your subscription.`,
        );
      }
    }

    property.isDraft = false;
    property.approvalStatus = ApprovalStatus.PENDING;
    property.status = PropertyStatus.INACTIVE;
    property.rejectionReason = null;
    return this.propertyRepo.save(property);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Find All (search + filter)
  // ─────────────────────────────────────────────────────────────────────────────
  async findAll(filters: FilterPropertyDto) {
    const {
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const qb = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.images', 'images')
      .leftJoinAndSelect('property.amenities', 'amenities')
      .leftJoinAndSelect('property.owner', 'owner')
      .where('property.status = :status', { status: PropertyStatus.ACTIVE })
      .andWhere('property.approvalStatus = :approvalStatus', {
        approvalStatus: ApprovalStatus.APPROVED,
      })
      .andWhere('property.isDraft = :isDraft', { isDraft: false })
      // Exclude agent listings whose agency is pending approval (not yet approved)
      .andWhere(
        `(property.agencyId IS NULL OR EXISTS (
          SELECT 1 FROM agencies ag
          WHERE ag.id = property.agencyId AND ag.status = 'approved'
        ))`,
      );

    this.applyFilters(qb, filters);

    // Sorting
    const allowedSort = ['createdAt', 'price', 'area', 'viewCount'];
    if (sortBy === 'relevance') {
      // Weighted relevance score:
      //   isFeatured    → +100
      //   listingPlan   → FEATURED=80, PREMIUM=60, BASIC=40, FREE=0
      //   isVerified    → +20
      //   viewCount     → up to +15 (capped at 500 views → 15 pts)
      //   recency       → up to +10 (within last 30 days)
      qb.addSelect(
        `(
          (CASE WHEN property.isFeatured = 1 THEN 100 ELSE 0 END) +
          (CASE property.listingPlan
            WHEN 'featured' THEN 80
            WHEN 'premium'  THEN 60
            WHEN 'basic'    THEN 40
            ELSE 0
          END) +
          (CASE WHEN property.isVerified = 1 THEN 20 ELSE 0 END) +
          LEAST(CAST(property.viewCount AS UNSIGNED) / 500.0 * 15, 15) +
          GREATEST(10 - DATEDIFF(NOW(), property.updatedAt), 0)
        )`,
        'relevanceScore',
      ).orderBy('relevanceScore', 'DESC')
       .addOrderBy('property.updatedAt', 'DESC');
    } else {
      const safeSort = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
      qb.orderBy(`property.${safeSort}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');
      // Always secondary-sort featured first
      if (safeSort !== 'createdAt') {
        qb.addOrderBy('property.isFeatured', 'DESC');
      }
    }

    const total = await qb.getCount();
    const raw = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    const now = new Date();
    const items = raw.map((p) => ({
      ...p,
      isBoosted: p.isFeatured && p.boostExpiresAt != null && new Date(p.boostExpiresAt) > now,
      boostExpiry: p.boostExpiresAt ?? null,
    }));

    return {
      data: items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Map properties (lightweight, no pagination, only lat/lng needed)
  // ─────────────────────────────────────────────────────────────────────────────
  async findForMap(filters: FilterPropertyDto): Promise<
    Pick<Property, 'id' | 'title' | 'slug' | 'price' | 'latitude' | 'longitude' | 'type' | 'category' | 'city' | 'bedrooms'>[]
  > {
    const qb = this.propertyRepo
      .createQueryBuilder('property')
      .select([
        'property.id', 'property.title', 'property.slug', 'property.price',
        'property.latitude', 'property.longitude', 'property.type',
        'property.category', 'property.city', 'property.bedrooms',
      ])
      .where('property.status = :status', { status: PropertyStatus.ACTIVE })
      .andWhere('property.approvalStatus = :approvalStatus', { approvalStatus: ApprovalStatus.APPROVED })
      .andWhere('property.latitude IS NOT NULL')
      .andWhere('property.longitude IS NOT NULL');

    this.applyFilters(qb, filters);
    return qb.limit(200).getMany();
  }

  async findFeatured(limit = 8): Promise<Property[]> {
    const now = new Date();
    return this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.images', 'images')
      .where('property.isFeatured = :f', { f: true })
      .andWhere('property.status = :status', { status: PropertyStatus.ACTIVE })
      .andWhere('property.approvalStatus = :approval', { approval: ApprovalStatus.APPROVED })
      .andWhere('(property.boostExpiresAt IS NULL OR property.boostExpiresAt > :now)', { now })
      .orderBy('property.boostExpiresAt', 'DESC')
      .addOrderBy('property.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async findBySlug(slug: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { slug },
      relations: ['images', 'amenities', 'owner'],
    });
    if (!property) throw new NotFoundException('Property not found');
    // View count is now managed exclusively by trackView() to ensure uniqueness.
    return property;
  }

  // ── Bot detection ────────────────────────────────────────────────────────────

  private static readonly BOT_PATTERNS = [
    'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
    'yandexbot', 'sogou', 'exabot', 'facebot', 'ia_archiver',
    'ahrefsbot', 'semrushbot', 'dotbot', 'rogerbot', 'uptimerobot',
    'pingdom', 'gtmetrix', 'lighthouse', 'headlesschrome', 'phantomjs',
    'scrapy', 'python-requests', 'curl/', 'wget/', 'libwww-perl',
  ];

  private isBot(userAgent: string): boolean {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return PropertiesService.BOT_PATTERNS.some(p => ua.includes(p));
  }

  // ── Track unique property view ────────────────────────────────────────────────

  /**
   * Records a property view only if no view from the same identity exists
   * within the last 24 hours. Logged-in users are keyed by userId;
   * guests are keyed by IP address.
   */
  async trackView(
    propertyId: string,
    opts: {
      userId?: string;
      ipAddress: string;
      userAgent?: string;
      sessionId?: string;
      source?: string;
      referrer?: string;
      deviceType?: string;
    },
  ): Promise<void> {
    // 1. Ignore bots
    if (opts.userAgent && this.isBot(opts.userAgent)) return;

    // 2. Ensure property exists
    const exists = await this.propertyRepo.findOne({
      where: { id: propertyId },
      select: ['id'],
    });
    if (!exists) return;

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 3. Dedup check
    const qb = this.viewRepo
      .createQueryBuilder('v')
      .where('v.propertyId = :propertyId', { propertyId })
      .andWhere('v.viewedAt > :cutoff', { cutoff });

    if (opts.userId) {
      qb.andWhere('v.userId = :userId', { userId: opts.userId });
    } else {
      qb.andWhere('v.ipAddress = :ip', { ip: opts.ipAddress });
    }

    const duplicate = await qb.getExists();
    if (duplicate) return;

    // 4. Insert view row
    const view = this.viewRepo.create({
      propertyId,
      userId:     opts.userId ?? null,
      ipAddress:  opts.ipAddress,
      userAgent:  opts.userAgent?.slice(0, 512),
      sessionId:  opts.sessionId?.slice(0, 100),
      source:     opts.source?.slice(0, 50),
      referrer:   opts.referrer?.slice(0, 512),
      deviceType: opts.deviceType?.slice(0, 20),
    });
    await this.viewRepo.save(view);

    // 5. Increment the cached counter on the property
    await this.propertyRepo.increment({ id: propertyId }, 'viewCount', 1);
  }

  async findById(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: ['images', 'amenities', 'owner'],
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async update(id: string, dto: Partial<CreatePropertyDto>, user: User): Promise<Property> {
    const property = await this.findById(id);
    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only edit your own properties');
    }
    if (dto.amenityIds) {
      property.amenities = await this.amenityRepo.findByIds(dto.amenityIds);
    }
    const wasDraft = property.isDraft;
    Object.assign(property, dto);
    // Non-admin edits of live (non-draft) properties reset approval for re-review
    if (user.role !== UserRole.ADMIN && !wasDraft) {
      property.approvalStatus = ApprovalStatus.PENDING;
      property.status = PropertyStatus.INACTIVE;
      property.rejectionReason = null;
    }
    // Keep draft status unless explicitly publishing
    if (wasDraft && dto.isDraft !== false) {
      property.isDraft = true;
    }
    return this.propertyRepo.save(property);
  }

  async remove(id: string, user: User): Promise<void> {
    const property = await this.findById(id);
    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own properties');
    }
    await this.propertyRepo.remove(property);
  }

  async addImages(propertyId: string, urls: string[], user: User) {
    const property = await this.findById(propertyId);
    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    const images = urls.map((url, index) =>
      this.imageRepo.create({
        url,
        propertyId,
        isPrimary: index === 0 && property.images.length === 0,
        sortOrder: property.images.length + index,
        alt: property.title,
      }),
    );
    return this.imageRepo.save(images);
  }

  async deleteImage(propertyId: string, imageId: string, user: User) {
    const property = await this.findById(propertyId);
    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    const image = await this.imageRepo.findOne({ where: { id: imageId, propertyId } });
    if (!image) throw new NotFoundException('Image not found');
    await this.imageRepo.remove(image);
    return { success: true };
  }

  async getStats() {
    const [total, forSale, forRent, forPG, citiesRow] = await Promise.all([
      this.propertyRepo.count({ where: { status: PropertyStatus.ACTIVE } }),
      this.propertyRepo.count({ where: { status: PropertyStatus.ACTIVE, category: PropertyCategory.BUY } }),
      this.propertyRepo.count({ where: { status: PropertyStatus.ACTIVE, category: PropertyCategory.RENT } }),
      this.propertyRepo.count({ where: { status: PropertyStatus.ACTIVE, category: PropertyCategory.PG } }),
      this.propertyRepo
        .createQueryBuilder('p')
        .select('COUNT(DISTINCT p.city)', 'cnt')
        .where('p.status = :status', { status: PropertyStatus.ACTIVE })
        .andWhere('p.city IS NOT NULL')
        .andWhere("p.city != ''")
        .getRawOne<{ cnt: string }>(),
    ]);
    const totalCities = parseInt(citiesRow?.cnt || '0', 10);
    return { total, forSale, forRent, forPG, totalCities };
  }

  async getCitiesWithCount() {
    return this.propertyRepo
      .createQueryBuilder('property')
      .select('property.city', 'city')
      .addSelect('COUNT(*)', 'count')
      .where('property.status = :status', { status: PropertyStatus.ACTIVE })
      .groupBy('property.city')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();
  }

  async getSimilarProperties(property: Property, limit = 4): Promise<Property[]> {
    const baseQb = () =>
      this.propertyRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.images', 'images')
        .where('p.id != :id', { id: property.id })
        .andWhere('p.status = :status', { status: PropertyStatus.ACTIVE })
        .andWhere('p.approvalStatus = :approval', { approval: ApprovalStatus.APPROVED })
        .andWhere('p.isDraft = :isDraft', { isDraft: false });

    // Primary: same city + category + price range ±25%
    if (property.price) {
      const minPrice = Number(property.price) * 0.75;
      const maxPrice = Number(property.price) * 1.25;
      const results = await baseQb()
        .andWhere('p.city = :city', { city: property.city })
        .andWhere('p.category = :category', { category: property.category })
        .andWhere('p.price BETWEEN :minPrice AND :maxPrice', { minPrice, maxPrice })
        .orderBy('p.isFeatured', 'DESC')
        .addOrderBy('p.updatedAt', 'DESC')
        .take(limit)
        .getMany();
      if (results.length >= limit) return results;

      // Fallback 1: same city + category (no price filter), pad up to limit
      const ids = results.map(r => r.id);
      const fallback1 = await baseQb()
        .andWhere('p.city = :city', { city: property.city })
        .andWhere('p.category = :category', { category: property.category })
        .andWhere(ids.length ? 'p.id NOT IN (:...ids)' : '1=1', ids.length ? { ids } : {})
        .orderBy('p.isFeatured', 'DESC')
        .addOrderBy('p.updatedAt', 'DESC')
        .take(limit - results.length)
        .getMany();
      return [...results, ...fallback1];
    }

    // Fallback: no price — match city + category
    return baseQb()
      .andWhere('p.city = :city', { city: property.city })
      .andWhere('p.category = :category', { category: property.category })
      .orderBy('p.isFeatured', 'DESC')
      .addOrderBy('p.updatedAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async getAmenities(): Promise<Amenity[]> {
    return this.amenityRepo.find();
  }

  async findMyListings(
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      status?: PropertyStatus;
      approvalStatus?: ApprovalStatus;
    },
  ) {
    const { page = 1, limit = 12, status, approvalStatus } = filters;

    // Look up the agent profile for this user (if any) to include assigned properties
    const agentRows = await this.propertyRepo.manager.query(
      `SELECT id FROM agent_profiles WHERE userId = ? LIMIT 1`,
      [userId],
    );
    const agentProfileId: string | null = agentRows[0]?.id ?? null;

    const qb = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.images', 'images')
      .orderBy('property.createdAt', 'DESC');

    if (agentProfileId) {
      qb.where(
        `(property.ownerId = :userId OR property.id IN (
          SELECT pam.propertyId FROM property_agent_map pam
          WHERE pam.agentId = :agentProfileId AND pam.isActive = 1
        ))`,
        { userId, agentProfileId },
      );
    } else {
      qb.where('property.ownerId = :userId', { userId });
    }

    if (status) qb.andWhere('property.status = :status', { status });
    if (approvalStatus) qb.andWhere('property.approvalStatus = :approvalStatus', { approvalStatus });

    const total = await qb.getCount();
    const raw = await qb.skip((+page - 1) * +limit).take(+limit).getMany();
    const now = new Date();
    const items = raw.map((p) => ({
      ...p,
      isBoosted: p.isFeatured && p.boostExpiresAt != null && new Date(p.boostExpiresAt) > now,
      boostExpiry: p.boostExpiresAt ?? null,
    }));

    return { items, total, page: +page, limit: +limit };
  }

  async boostProperty(propertyId: string, boostPlanId: string, user: User): Promise<Property> {
    const property = await this.findById(propertyId);
    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only boost your own properties');
    }
    const boostPlan = await this.walletService.getBoostPlanById(boostPlanId);
    await this.walletService.debit(
      user.id,
      boostPlan.tokenCost,
      TransactionReason.BOOST_PROPERTY,
      `Boosted property "${property.title}" for ${boostPlan.durationDays} days`,
      property.id,
      'property',
    );
    const now = new Date();
    const currentExpiry =
      property.boostExpiresAt && property.boostExpiresAt > now ? property.boostExpiresAt : now;
    const boostExpiresAt = new Date(currentExpiry);
    boostExpiresAt.setDate(boostExpiresAt.getDate() + boostPlan.durationDays);
    property.boostExpiresAt = boostExpiresAt;
    property.isFeatured = true;
    return this.propertyRepo.save(property);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Apply Filters (core query builder logic)
  // ─────────────────────────────────────────────────────────────────────────────
  private applyFilters(qb: SelectQueryBuilder<Property>, filters: FilterPropertyDto) {
    // ── Smart keyword (NLP) ────────────────────────────────────────────────────
    if (filters.keyword) {
      const parsed = this.parseKeyword(filters.keyword);

      if (parsed.bedrooms && !filters.bedrooms) {
        qb.andWhere('property.bedrooms = :kwBedrooms', { kwBedrooms: parsed.bedrooms });
      }
      if (parsed.city && !filters.city) {
        qb.andWhere('LOWER(property.city) LIKE LOWER(:kwCity)', {
          kwCity: `%${parsed.city}%`,
        });
      }
      if (parsed.locality && !filters.locality) {
        qb.andWhere('LOWER(property.locality) LIKE LOWER(:kwLocality)', {
          kwLocality: `%${parsed.locality}%`,
        });
      }
      if (parsed.maxPrice && !filters.maxPrice) {
        qb.andWhere('property.price <= :kwMaxPrice', { kwMaxPrice: parsed.maxPrice });
      }
      if (parsed.minPrice && !filters.minPrice) {
        qb.andWhere('property.price >= :kwMinPrice', { kwMinPrice: parsed.minPrice });
      }
      if (parsed.type && !filters.type) {
        qb.andWhere('property.type = :kwType', { kwType: parsed.type });
      }
      if (parsed.category && !filters.category) {
        qb.andWhere('property.category = :kwCategory', { kwCategory: parsed.category });
      }
      // Remainder text as full-text search
      if (parsed.remainder && parsed.remainder.length > 1) {
        qb.andWhere(
          '(property.title LIKE :kwRem OR property.society LIKE :kwRem OR property.locality LIKE :kwRem)',
          { kwRem: `%${parsed.remainder}%` },
        );
      }
    }

    // ── Standard filters ───────────────────────────────────────────────────────
    if (filters.category) {
      qb.andWhere('property.category = :category', { category: filters.category });
    }
    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      qb.andWhere('property.type IN (:...types)', { types });
    }

    // Location hierarchy: stateId > state string > city > cityId > locality > pincode
    if (filters.stateId) {
      qb.andWhere('property.stateId = :stateId', { stateId: filters.stateId });
    } else if (filters.state) {
      qb.andWhere('LOWER(property.state) = LOWER(:state)', { state: filters.state });
    }
    if (filters.cityId) {
      qb.andWhere('property.cityId = :cityId', { cityId: filters.cityId });
    } else if (filters.city) {
      qb.andWhere('LOWER(property.city) = LOWER(:city)', { city: filters.city });
    }
    if (filters.locality) {
      qb.andWhere('LOWER(property.locality) LIKE LOWER(:locality)', {
        locality: `%${filters.locality}%`,
      });
    }
    if (filters.pincode) {
      qb.andWhere('property.pincode = :pincode', { pincode: filters.pincode });
    }

    // Price
    if (filters.minPrice) {
      qb.andWhere('property.price >= :minPrice', { minPrice: filters.minPrice });
    }
    if (filters.maxPrice) {
      qb.andWhere('property.price <= :maxPrice', { maxPrice: filters.maxPrice });
    }

    // Area
    if (filters.minArea) {
      qb.andWhere('property.area >= :minArea', { minArea: filters.minArea });
    }
    if (filters.maxArea) {
      qb.andWhere('property.area <= :maxArea', { maxArea: filters.maxArea });
    }

    // Bedrooms
    if (filters.bedrooms) {
      const bedsRaw = filters.bedrooms.split(',').map((b) => b.trim());
      const hasPlus = bedsRaw.some((b) => b.includes('+'));
      const beds = bedsRaw.map((b) => parseInt(b)).filter((b) => !isNaN(b));
      if (hasPlus) {
        const maxBed = Math.max(...beds);
        qb.andWhere('property.bedrooms >= :minBed', { minBed: maxBed });
      } else if (beds.length === 1) {
        qb.andWhere('property.bedrooms = :bedrooms', { bedrooms: beds[0] });
      } else if (beds.length > 1) {
        qb.andWhere('property.bedrooms IN (:...beds)', { beds });
      }
    }

    // Status filters
    if (filters.furnishingStatus) {
      qb.andWhere('property.furnishingStatus = :furnishingStatus', {
        furnishingStatus: filters.furnishingStatus,
      });
    }
    if (filters.possessionStatus) {
      qb.andWhere('property.possessionStatus = :possessionStatus', {
        possessionStatus: filters.possessionStatus,
      });
    }
    if (filters.isFeatured !== undefined) {
      qb.andWhere('property.isFeatured = :isFeatured', { isFeatured: filters.isFeatured });
      if (filters.isFeatured) {
        // Only show active boosts (not expired) — NULL boostExpiresAt = manually featured by admin
        qb.andWhere('(property.boostExpiresAt IS NULL OR property.boostExpiresAt > :boostNow)', {
          boostNow: new Date(),
        });
      }
    }
    if (filters.isVerified !== undefined) {
      qb.andWhere('property.isVerified = :isVerified', { isVerified: filters.isVerified });
    }
    if (filters.isNewProject !== undefined) {
      qb.andWhere('property.isNewProject = :isNewProject', { isNewProject: filters.isNewProject });
    }

    // Posted by (listedBy)
    if (filters.listedBy) {
      qb.andWhere('property.listedBy = :listedBy', { listedBy: filters.listedBy });
    }

    // Builder name
    if (filters.builderName) {
      qb.andWhere('LOWER(property.builderName) LIKE LOWER(:builderName)', {
        builderName: `%${filters.builderName}%`,
      });
    }

    // Full-text search
    if (filters.search) {
      qb.andWhere(
        '(property.title LIKE :search OR property.locality LIKE :search OR property.society LIKE :search OR property.city LIKE :search OR property.builderName LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Owner / agent filter
    if (filters.agentId) {
      qb.andWhere('property.ownerId = :agentId', { agentId: filters.agentId });
    }

    // Amenities filter — property must have each of the specified amenities
    // Uses multiple INNER JOINs (one per required amenity) for AND semantics
    if (filters.amenityIds) {
      const ids = filters.amenityIds.split(',').map((id) => id.trim()).filter(Boolean);
      for (let i = 0; i < ids.length; i++) {
        // Each innerJoin ensures the property has THIS specific amenity
        qb.innerJoin(
          'property.amenities',
          `reqAmenity${i}`,
          `reqAmenity${i}.id = :reqAmenityId${i}`,
          { [`reqAmenityId${i}`]: ids[i] },
        );
      }
    }

    // Geo bounding box (for map search)
    if (filters.minLat !== undefined && filters.maxLat !== undefined) {
      qb.andWhere('property.latitude BETWEEN :minLat AND :maxLat', {
        minLat: filters.minLat,
        maxLat: filters.maxLat,
      });
    }
    if (filters.minLng !== undefined && filters.maxLng !== undefined) {
      qb.andWhere('property.longitude BETWEEN :minLng AND :maxLng', {
        minLng: filters.minLng,
        maxLng: filters.maxLng,
      });
    }
  }
}

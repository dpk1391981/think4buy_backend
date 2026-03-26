import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual, MoreThan } from 'typeorm';
import { Agency, AgencyStatus } from './entities/agency.entity';
import { AgentProfile } from './entities/agent-profile.entity';
import { PropertyAgentMap } from './entities/property-agent-map.entity';
import { AgentLocationMap } from './entities/agent-location-map.entity';
import { PremiumSlot } from './entities/premium-slot.entity';
import {
  CreateAgencyDto,
  UpdateAgencyDto,
  CreateAgentProfileDto,
  UpdateAgentProfileDto,
  AssignPropertyToAgentDto,
  AssignAgentLocationDto,
} from './dto/agency.dto';

@Injectable()
export class AgencyService {
  constructor(
    @InjectRepository(Agency)
    private agencyRepo: Repository<Agency>,
    @InjectRepository(AgentProfile)
    private agentProfileRepo: Repository<AgentProfile>,
    @InjectRepository(PropertyAgentMap)
    private propertyAgentMapRepo: Repository<PropertyAgentMap>,
    @InjectRepository(AgentLocationMap)
    private agentLocationMapRepo: Repository<AgentLocationMap>,
    @InjectRepository(PremiumSlot)
    private premiumSlotRepo: Repository<PremiumSlot>,
  ) {}

  // ─── Agency CRUD ─────────────────────────────────────────────────────────────

  async createAgency(dto: CreateAgencyDto): Promise<Agency> {
    const agency = this.agencyRepo.create(dto);
    return this.agencyRepo.save(agency);
  }

  async updateAgency(id: string, dto: UpdateAgencyDto): Promise<Agency> {
    const agency = await this.agencyRepo.findOne({ where: { id } });
    if (!agency) throw new NotFoundException('Agency not found');
    Object.assign(agency, dto);
    return this.agencyRepo.save(agency);
  }

  async deleteAgency(id: string): Promise<{ message: string }> {
    const agency = await this.agencyRepo.findOne({ where: { id } });
    if (!agency) throw new NotFoundException('Agency not found');
    await this.agencyRepo.remove(agency);
    return { message: 'Agency deleted successfully' };
  }

  async getAgencies(
    page = 1,
    limit = 20,
    search?: string,
    cityId?: string,
  ) {
    const qb = this.agencyRepo
      .createQueryBuilder('agency')
      .loadRelationCountAndMap('agency.agentCount', 'agency.agents', 'agents', (qb) =>
        qb.where('agents.isActive = :active', { active: true }),
      )
      .orderBy('agency.createdAt', 'DESC');

    if (search) {
      qb.andWhere(
        '(agency.name LIKE :search OR agency.contactEmail LIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (cityId) {
      qb.andWhere('agency.cityId = :cityId', { cityId });
    }

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAgencyById(id: string): Promise<Agency> {
    const agency = await this.agencyRepo.findOne({
      where: { id },
      relations: ['agents'],
    });
    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  // ─── Agent Profile CRUD ───────────────────────────────────────────────────────

  async createAgentProfile(dto: CreateAgentProfileDto): Promise<AgentProfile> {
    const existing = await this.agentProfileRepo.findOne({
      where: { userId: dto.userId },
    });
    if (existing) throw new ConflictException('Agent profile already exists for this user');

    if (dto.agencyId) {
      const agency = await this.agencyRepo.findOne({ where: { id: dto.agencyId } });
      if (!agency) throw new NotFoundException('Agency not found');
    }

    const profile = this.agentProfileRepo.create(dto);
    const saved = await this.agentProfileRepo.save(profile);

    if (dto.agencyId) {
      await this.agencyRepo.increment({ id: dto.agencyId }, 'totalAgents', 1);
    }

    return saved;
  }

  async updateAgentProfile(id: string, dto: UpdateAgentProfileDto): Promise<AgentProfile> {
    const profile = await this.agentProfileRepo.findOne({ where: { id } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    const oldAgencyId = profile.agencyId;

    if (dto.agencyId !== undefined && dto.agencyId !== oldAgencyId) {
      if (dto.agencyId) {
        const agency = await this.agencyRepo.findOne({ where: { id: dto.agencyId } });
        if (!agency) throw new NotFoundException('Agency not found');
        await this.agencyRepo.increment({ id: dto.agencyId }, 'totalAgents', 1);
      }
      if (oldAgencyId) {
        await this.agencyRepo.decrement({ id: oldAgencyId }, 'totalAgents', 1);
      }
    }

    Object.assign(profile, dto);
    return this.agentProfileRepo.save(profile);
  }

  async getAgentProfileByUserId(userId: string): Promise<AgentProfile> {
    const profile = await this.agentProfileRepo.findOne({
      where: { userId },
      relations: ['agency'],
    });
    if (!profile) throw new NotFoundException('Agent profile not found');
    return profile;
  }

  async getAgentProfileById(id: string): Promise<AgentProfile> {
    const profile = await this.agentProfileRepo.findOne({
      where: { id },
      relations: ['agency', 'locationMaps'],
    });
    if (!profile) throw new NotFoundException('Agent profile not found');
    return profile;
  }

  async getAgentsByAgency(agencyId: string, page = 1, limit = 20) {
    const agency = await this.agencyRepo.findOne({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException('Agency not found');

    const qb = this.agentProfileRepo
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.agency', 'agency')
      .where('profile.agencyId = :agencyId', { agencyId })
      .orderBy('profile.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // join the user table to get name + email
    const dataSource = this.agentProfileRepo.manager.connection;
    const [items, total] = await qb.getManyAndCount();

    // attach user info via raw query for each profile
    const userIds = items.map((p) => p.userId);
    let usersMap: Record<string, { id: string; name: string; email: string }> = {};
    if (userIds.length > 0) {
      const users: any[] = await dataSource.query(
        `SELECT id, name, email FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
        userIds,
      );
      usersMap = Object.fromEntries(users.map((u) => [u.id, u]));
    }

    const enriched = items.map((p) => ({ ...p, user: usersMap[p.userId] ?? null }));
    return { items: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async searchAgentProfiles(
    search?: string,
    page = 1,
    limit = 20,
    unassigned?: boolean,
  ) {
    const db = this.agentProfileRepo.manager.connection;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (search) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ? OR ap.licenseNumber LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (unassigned) {
      conditions.push('ap.agencyId IS NULL');
    }

    const where = conditions.join(' AND ');
    const joins = `
      FROM agent_profiles ap
      LEFT JOIN users u ON u.id = ap.userId
      LEFT JOIN agencies ag ON ag.id = ap.agencyId
      WHERE ${where}
    `;

    const [{ cnt }] = await db.query(`SELECT COUNT(*) AS cnt ${joins}`, params);
    const total = Number(cnt);

    const rows: any[] = await db.query(
      `SELECT ap.id, ap.userId, ap.agencyId, ap.licenseNumber,
              ap.experienceYears, ap.rating, ap.totalDeals, ap.totalListings,
              ap.tick, ap.isActive, ap.bio, ap.createdAt,
              u.name AS userName, u.email AS userEmail,
              ag.name AS agencyName
       ${joins}
       ORDER BY ap.createdAt DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );

    const items = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      agencyId: r.agencyId,
      licenseNumber: r.licenseNumber,
      experienceYears: r.experienceYears,
      rating: r.rating,
      totalDeals: r.totalDeals,
      totalListings: r.totalListings,
      tick: r.tick,
      isActive: !!r.isActive,
      bio: r.bio,
      agencyName: r.agencyName ?? null,
      user: { id: r.userId, name: r.userName, email: r.userEmail },
    }));

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async assignAgentToAgency(
    agentProfileId: string,
    agencyId: string | null,
  ): Promise<AgentProfile> {
    const profile = await this.agentProfileRepo.findOne({ where: { id: agentProfileId } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    const oldAgencyId = profile.agencyId;

    // If assigning to a new agency, validate it exists
    if (agencyId) {
      const agency = await this.agencyRepo.findOne({ where: { id: agencyId } });
      if (!agency) throw new NotFoundException('Agency not found');
    }

    // Decrement old agency counter
    if (oldAgencyId && oldAgencyId !== agencyId) {
      await this.agencyRepo.decrement({ id: oldAgencyId }, 'totalAgents', 1);
    }

    profile.agencyId = agencyId ?? null;
    const saved = await this.agentProfileRepo.save(profile);

    // Increment new agency counter
    if (agencyId && (!oldAgencyId || oldAgencyId !== agencyId)) {
      await this.agencyRepo.increment({ id: agencyId }, 'totalAgents', 1);
    }

    return saved;
  }

  // ─── Property-Agent Mapping ───────────────────────────────────────────────────

  async assignPropertyToAgent(dto: AssignPropertyToAgentDto): Promise<PropertyAgentMap> {
    const agentProfile = await this.agentProfileRepo.findOne({
      where: { id: dto.agentId },
    });
    if (!agentProfile) throw new NotFoundException('Agent profile not found');

    // Deactivate existing mapping for this property
    await this.propertyAgentMapRepo.update(
      { propertyId: dto.propertyId, isActive: true },
      { isActive: false },
    );

    const map = this.propertyAgentMapRepo.create({
      propertyId: dto.propertyId,
      agentId: dto.agentId,
      assignedByAdmin: dto.assignedByAdmin ?? false,
      isActive: true,
    });

    const saved = await this.propertyAgentMapRepo.save(map);
    await this.agentProfileRepo.increment({ id: dto.agentId }, 'totalListings', 1);

    return saved;
  }

  async reassignProperty(propertyId: string, newAgentId: string): Promise<PropertyAgentMap> {
    const newAgent = await this.agentProfileRepo.findOne({ where: { id: newAgentId } });
    if (!newAgent) throw new NotFoundException('New agent profile not found');

    // Deactivate current assignment
    const current = await this.propertyAgentMapRepo.findOne({
      where: { propertyId, isActive: true },
    });
    if (current) {
      current.isActive = false;
      await this.propertyAgentMapRepo.save(current);
      await this.agentProfileRepo.decrement({ id: current.agentId }, 'totalListings', 1);
    }

    const map = this.propertyAgentMapRepo.create({
      propertyId,
      agentId: newAgentId,
      assignedByAdmin: true,
      isActive: true,
    });

    const saved = await this.propertyAgentMapRepo.save(map);
    await this.agentProfileRepo.increment({ id: newAgentId }, 'totalListings', 1);

    return saved;
  }

  async getPropertyAgent(propertyId: string): Promise<PropertyAgentMap | null> {
    return this.propertyAgentMapRepo.findOne({
      where: { propertyId, isActive: true },
      relations: ['agent', 'agent.agency'],
    });
  }

  async getAgentProperties(agentId: string, page = 1, limit = 20) {
    const db = this.propertyAgentMapRepo.manager.connection;

    const [{ cnt }] = await db.query(
      `SELECT COUNT(*) as cnt FROM property_agent_map WHERE agentId = ? AND isActive = 1`,
      [agentId],
    );
    const total = Number(cnt);

    const rows = await db.query(
      `SELECT p.id, p.title, p.slug, p.price, p.type AS propertyType,
              p.category, p.city, p.approvalStatus, p.status,
              p.isBoosted, p.boostExpiry, p.createdAt,
              pam.assignedByAdmin, pam.createdAt AS assignedAt
       FROM property_agent_map pam
       INNER JOIN properties p ON p.id = pam.propertyId
       WHERE pam.agentId = ? AND pam.isActive = 1
       ORDER BY pam.createdAt DESC
       LIMIT ? OFFSET ?`,
      [agentId, limit, (page - 1) * limit],
    );

    return { items: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Agent Location Mapping ───────────────────────────────────────────────────

  private toSlug(s: string): string {
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async addAgentLocation(agentId: string, dto: AssignAgentLocationDto): Promise<AgentLocationMap> {
    const profile = await this.agentProfileRepo.findOne({ where: { id: agentId } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    const coverageType = dto.coverageType ?? 'city';
    const localitySlug = dto.localityName ? this.toSlug(dto.localityName) : null;
    const citySlug     = dto.cityName     ? this.toSlug(dto.cityName)     : null;
    const stateSlug    = dto.stateName    ? this.toSlug(dto.stateName)    : null;

    // Prevent exact duplicate
    const existing = await this.agentLocationMapRepo.findOne({
      where: {
        agentId,
        coverageType,
        cityId:  dto.cityId     || null,
        stateId: dto.stateId    || null,
        localityId: dto.localityId || null,
      },
    });
    if (existing) throw new ConflictException('Coverage area already mapped to this agent');

    const loc = this.agentLocationMapRepo.create({
      agentId,
      coverageType,
      countryId:    dto.countryId    || null,
      stateId:      dto.stateId      || null,
      stateName:    dto.stateName    || null,
      stateSlug,
      cityId:       dto.cityId       || null,
      cityName:     dto.cityName     || null,
      citySlug,
      localityId:   dto.localityId   || null,
      localityName: dto.localityName || null,
      localitySlug,
      isActive: true,
    });
    return this.agentLocationMapRepo.save(loc);
  }

  async removeAgentLocation(locationMapId: string): Promise<{ message: string }> {
    const loc = await this.agentLocationMapRepo.findOne({ where: { id: locationMapId } });
    if (!loc) throw new NotFoundException('Location mapping not found');
    await this.agentLocationMapRepo.remove(loc);
    return { message: 'Coverage area removed' };
  }

  async getAgentLocations(agentId: string): Promise<AgentLocationMap[]> {
    return this.agentLocationMapRepo.find({ where: { agentId }, order: { createdAt: 'DESC' } });
  }

  // ─── Top Agent Coverage Search (Gold / Silver / Bronze / Verified) ──────────

  /**
   * Returns top-badge agents (gold/silver/bronze) whose coverage areas match the query.
   * Matching priority: locality slug > city slug > state slug.
   * Used to render "Top Agents" banner above search results.
   */
  async getDiamondAgentsByCoverage(
    locality?: string,
    city?: string,
    state?: string,
    limit = 6,
  ): Promise<any[]> {
    const localitySlug = this.toSlug(locality || '');
    const citySlug     = this.toSlug(city     || '');
    const stateSlug    = this.toSlug(state    || '');

    if (!localitySlug && !citySlug && !stateSlug) return [];

    const db = this.agentLocationMapRepo.manager.connection;

    const areaConditions: string[] = [];
    const params: any[]            = [];

    if (localitySlug) {
      areaConditions.push('alm.localitySlug = ?');
      params.push(localitySlug);
    }
    if (citySlug) {
      // city-level coverage also covers any locality in that city
      areaConditions.push("(alm.citySlug = ? AND alm.coverageType IN ('city', 'locality'))");
      params.push(citySlug);
    }
    if (stateSlug) {
      areaConditions.push("(alm.stateSlug = ? AND alm.coverageType = 'state')");
      params.push(stateSlug);
    }

    const rows: any[] = await db.query(
      `SELECT DISTINCT
         u.id           AS id,
         ap.id          AS agentProfileId,
         u.name         AS name,
         u.phone        AS phone,
         u.avatar       AS avatar,
         u.company      AS company,
         u.city         AS city,
         u.state        AS state,
         ap.tick        AS agentTick,
         ap.rating      AS agentRating,
         ap.totalDeals  AS totalDeals,
         ap.experienceYears AS agentExperience,
         ap.licenseNumber   AS agentLicense,
         ap.authorityScore  AS authorityScore,
         GROUP_CONCAT(
           DISTINCT COALESCE(alm.localityName, alm.cityName, alm.stateName)
           ORDER BY alm.coverageType
           SEPARATOR ', '
         ) AS coverageAreas
       FROM agent_location_map alm
       INNER JOIN agent_profiles ap ON ap.id = alm.agentId
       INNER JOIN users u            ON u.id  = ap.userId
       WHERE alm.isActive = 1
         AND ap.tick IN ('gold', 'silver', 'bronze')
         AND ap.isActive = 1
         AND (${areaConditions.join(' OR ')})
       GROUP BY u.id, ap.id
       ORDER BY ap.authorityScore DESC, ap.totalDeals DESC
       LIMIT ?`,
      [...params, limit],
    );

    return rows.map((r) => ({
      id:              r.id,
      agentProfileId:  r.agentProfileId,
      name:            r.name,
      phone:           r.phone,
      avatar:          r.avatar,
      company:         r.company,
      city:            r.city,
      state:           r.state,
      agentTick:       r.agentTick,
      agentRating:     Number(r.agentRating ?? 0),
      totalDeals:      r.totalDeals ?? 0,
      agentExperience: r.agentExperience ?? 0,
      agentLicense:    r.agentLicense ?? null,
      authorityScore:  Number(r.authorityScore ?? 0),
      coverageAreas:   r.coverageAreas ?? '',
      isDiamondAgent:  true,
    }));
  }

  // ─── Admin: Coverage Area Management ─────────────────────────────────────────

  async listAdminCoverage(
    agentProfileId?: string,
    tick?: string,
    city?: string,
    page = 1,
    limit = 20,
  ) {
    const db = this.agentLocationMapRepo.manager.connection;

    const conditions = ['1=1'];
    const params: any[] = [];

    if (agentProfileId) {
      conditions.push('alm.agentId = ?');
      params.push(agentProfileId);
    }
    if (tick) {
      conditions.push('ap.tick = ?');
      params.push(tick);
    }
    if (city) {
      conditions.push('(alm.citySlug = ? OR alm.cityName LIKE ?)');
      params.push(this.toSlug(city), `%${city}%`);
    }

    const where = conditions.join(' AND ');

    const [{ cnt }] = await db.query(
      `SELECT COUNT(*) AS cnt
       FROM agent_location_map alm
       INNER JOIN agent_profiles ap ON ap.id = alm.agentId
       INNER JOIN users u ON u.id = ap.userId
       WHERE ${where}`,
      params,
    );

    const rows: any[] = await db.query(
      `SELECT alm.id, alm.agentId, alm.coverageType,
              alm.stateName, alm.cityName, alm.localityName,
              alm.stateSlug, alm.citySlug, alm.localitySlug,
              alm.isActive, alm.approvedAt, alm.approvedBy, alm.createdAt,
              ap.tick, ap.authorityScore,
              u.name AS agentName, u.avatar AS agentAvatar
       FROM agent_location_map alm
       INNER JOIN agent_profiles ap ON ap.id = alm.agentId
       INNER JOIN users u ON u.id = ap.userId
       WHERE ${where}
       ORDER BY alm.createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );

    return {
      items: rows,
      total: Number(cnt),
      page,
      limit,
      totalPages: Math.ceil(Number(cnt) / limit),
    };
  }

  async approveCoverage(locationMapId: string, adminUserId: string): Promise<AgentLocationMap> {
    const loc = await this.agentLocationMapRepo.findOne({ where: { id: locationMapId } });
    if (!loc) throw new NotFoundException('Coverage mapping not found');
    loc.isActive   = true;
    loc.approvedBy = adminUserId;
    loc.approvedAt = new Date();
    return this.agentLocationMapRepo.save(loc);
  }

  async deactivateCoverage(locationMapId: string): Promise<AgentLocationMap> {
    const loc = await this.agentLocationMapRepo.findOne({ where: { id: locationMapId } });
    if (!loc) throw new NotFoundException('Coverage mapping not found');
    loc.isActive = false;
    return this.agentLocationMapRepo.save(loc);
  }

  // ─── Public / Search APIs ─────────────────────────────────────────────────────

  async getAgentsByCity(cityId: string, page = 1, limit = 20) {
    const qb = this.agentLocationMapRepo
      .createQueryBuilder('loc')
      .innerJoinAndSelect('loc.agent', 'agent')
      .where('loc.cityId = :cityId', { cityId })
      .andWhere('agent.isActive = :active', { active: true })
      .orderBy('agent.rating', 'DESC')
      .addOrderBy('agent.totalDeals', 'DESC');

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPropertiesByAgent(agentId: string, page = 1, limit = 20) {
    return this.getAgentProperties(agentId, page, limit);
  }

  async getAgencyAgents(agencyId: string, page = 1, limit = 20) {
    return this.getAgentsByAgency(agencyId, page, limit);
  }

  // ─── Agent Dashboard ──────────────────────────────────────────────────────────

  async getAgentDashboard(userId: string) {
    const profile = await this.agentProfileRepo.findOne({
      where: { userId },
      relations: ['agency', 'locationMaps'],
    });

    const propertyMaps = await this.propertyAgentMapRepo.find({
      where: { agentId: profile?.id, isActive: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const adminAssigned = await this.propertyAgentMapRepo.count({
      where: { agentId: profile?.id, assignedByAdmin: true, isActive: true },
    });

    return {
      profile,
      agency: profile?.agency ?? null,
      totalListings: profile?.totalListings ?? 0,
      totalDeals: profile?.totalDeals ?? 0,
      rating: profile?.rating ?? 0,
      adminAssignedCount: adminAssigned,
      recentPropertyMaps: propertyMaps,
      locations: profile?.locationMaps ?? [],
    };
  }

  // ─── Seed / Migration Helpers ─────────────────────────────────────────────────

  async getOrCreateDefaultAgency(): Promise<Agency> {
    let agency = await this.agencyRepo.findOne({
      where: { name: 'Default Agency' },
    });
    if (!agency) {
      agency = await this.agencyRepo.save(
        this.agencyRepo.create({
          name: 'Default Agency',
          description: 'Default agency for unassigned agents',
          isActive: true,
          isVerified: true,
        }),
      );
    }
    return agency;
  }

  async getOrCreateAgentProfile(userId: string, agencyId?: string): Promise<AgentProfile> {
    let profile = await this.agentProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = await this.agentProfileRepo.save(
        this.agentProfileRepo.create({
          userId,
          agencyId: agencyId ?? null,
          isActive: true,
        }),
      );
      if (agencyId) {
        await this.agencyRepo.increment({ id: agencyId }, 'totalAgents', 1);
      }
    }
    return profile;
  }

  // ─── Agent Self-Registration: Find existing agency or create pending one ─────

  async agentRegisterOrJoinAgency(
    userId: string,
    data: {
      agencyName: string;
      contactPhone?: string;
      address?: string;
      city?: string;
      cityId?: string;
    },
  ): Promise<{ agency: Agency; agentProfile: AgentProfile; isNew: boolean }> {
    // Find existing approved agency by name (case-insensitive)
    const existing = await this.agencyRepo
      .createQueryBuilder('a')
      .where('LOWER(a.name) = LOWER(:name)', { name: data.agencyName.trim() })
      .andWhere('a.status = :status', { status: AgencyStatus.APPROVED })
      .getOne();

    let agency: Agency;
    let isNew = false;

    if (existing) {
      agency = existing;
    } else {
      // Create new agency with pending status
      agency = await this.agencyRepo.save(
        this.agencyRepo.create({
          name: data.agencyName.trim(),
          contactPhone: data.contactPhone ?? null,
          address: data.address ?? null,
          cityId: data.cityId ?? null,
          status: AgencyStatus.PENDING,
          isActive: false,
          isVerified: false,
          createdByUserId: userId,
        }),
      );
      isNew = true;
    }

    // Ensure agent profile exists and link to agency
    const agentProfile = await this.getOrCreateAgentProfile(userId, agency.id);
    if (agentProfile.agencyId !== agency.id) {
      agentProfile.agencyId = agency.id;
      await this.agentProfileRepo.save(agentProfile);
    }

    return { agency, agentProfile, isNew };
  }

  // ─── Admin: Agency Approval ───────────────────────────────────────────────────

  async getPendingAgencies(page = 1, limit = 20) {
    const [items, total] = await this.agencyRepo.findAndCount({
      where: { status: AgencyStatus.PENDING },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async approveAgency(id: string): Promise<Agency> {
    const agency = await this.agencyRepo.findOne({ where: { id } });
    if (!agency) throw new NotFoundException('Agency not found');
    agency.status = AgencyStatus.APPROVED;
    agency.isActive = true;
    agency.rejectionReason = null;
    return this.agencyRepo.save(agency);
  }

  async rejectAgency(id: string, reason: string): Promise<Agency> {
    const agency = await this.agencyRepo.findOne({ where: { id } });
    if (!agency) throw new NotFoundException('Agency not found');
    agency.status = AgencyStatus.REJECTED;
    agency.isActive = false;
    agency.rejectionReason = reason ?? 'Rejected by admin';
    return this.agencyRepo.save(agency);
  }

  // ─── Premium Slot System ─────────────────────────────────────────────────────

  /** Return active, non-expired premium slots with full agent data (for sponsored banner) */
  async getPremiumAgentsByCity(city: string): Promise<any[]> {
    const now = new Date();
    const qb = this.premiumSlotRepo
      .createQueryBuilder('ps')
      .innerJoin('users', 'u', 'u.id = ps.agentId')
      .where('ps.isActive = true')
      .andWhere('ps.expiresAt > :now', { now })
      .orderBy('ps.slotNumber', 'ASC')
      .take(12)
      .select([
        'ps.id                          AS slotId',
        'u.id                           AS id',
        'u.name                         AS name',
        'u.avatar                       AS avatar',
        'u.phone                        AS phone',
        'u.company                      AS company',
        'COALESCE(u.city, ps.city)      AS city',
        'u.state                        AS state',
        'u.agentTick                    AS agentTick',
        'u.agentRating                  AS agentRating',
        'u.agentExperience              AS agentExperience',
        'u.totalDeals                   AS totalDeals',
        'u.agentUsedQuota               AS agentUsedQuota',
        'u.isVerified                   AS isVerified',
        'u.agentBio                     AS agentBio',
      ]);

    if (city) {
      qb.andWhere('ps.city = :city', { city: city.toLowerCase().trim() });
    }

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      id:              r.id,
      slotId:          r.slotId,
      name:            r.name || 'Featured Agent',
      avatar:          r.avatar || null,
      phone:           r.phone || null,
      company:         r.company || null,
      city:            r.city || null,
      state:           r.state || null,
      agentTick:       r.agentTick || 'verified',
      agentRating:     r.agentRating != null ? Number(r.agentRating) : 0,
      agentExperience: r.agentExperience != null ? Number(r.agentExperience) : 0,
      totalDeals:      r.totalDeals != null ? Number(r.totalDeals) : 0,
      agentUsedQuota:  r.agentUsedQuota != null ? Number(r.agentUsedQuota) : 0,
      isVerified:      r.isVerified === 1 || r.isVerified === true || r.isVerified === '1',
      agentBio:        r.agentBio || null,
    }));
  }

  /** Create or update a premium slot (admin only) */
  async upsertPremiumSlot(dto: {
    city: string;
    slotNumber: number;
    agentId: string;
    agencyId?: string;
    agentName?: string;
    agentAvatar?: string;
    agentPhone?: string;
    price?: number;
    durationDays?: number;
    adminNotes?: string;
  }): Promise<PremiumSlot> {
    const city = dto.city.toLowerCase().trim();
    // Deactivate any existing slot at same city + position
    await this.premiumSlotRepo.update(
      { city, slotNumber: dto.slotNumber, isActive: true },
      { isActive: false },
    );
    const durationDays = dto.durationDays ?? 30;
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + durationDays * 86400 * 1000);
    const slot = this.premiumSlotRepo.create({
      city,
      cityId: undefined,
      slotNumber: dto.slotNumber,
      agentId: dto.agentId,
      agencyId: dto.agencyId ?? null,
      agentName: dto.agentName ?? null,
      agentAvatar: dto.agentAvatar ?? null,
      agentPhone: dto.agentPhone ?? null,
      price: dto.price ?? 0,
      durationDays,
      startsAt,
      expiresAt,
      isActive: true,
      adminNotes: dto.adminNotes ?? null,
    });
    return this.premiumSlotRepo.save(slot);
  }

  /** Admin: list all premium slots with optional city filter */
  async listPremiumSlots(city?: string, page = 1, limit = 20) {
    const qb = this.premiumSlotRepo.createQueryBuilder('slot')
      .orderBy('slot.city', 'ASC')
      .addOrderBy('slot.slotNumber', 'ASC');
    if (city) qb.where('slot.city = :city', { city: city.toLowerCase() });
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Admin: delete/deactivate a slot */
  async deactivatePremiumSlot(id: string): Promise<{ message: string }> {
    const slot = await this.premiumSlotRepo.findOne({ where: { id } });
    if (!slot) throw new NotFoundException('Slot not found');
    slot.isActive = false;
    await this.premiumSlotRepo.save(slot);
    return { message: 'Slot deactivated' };
  }

  /** Cron: expire premium slots whose expiresAt has passed */
  @Cron(CronExpression.EVERY_HOUR)
  async expirePremiumSlots() {
    const now = new Date();
    await this.premiumSlotRepo
      .createQueryBuilder()
      .update(PremiumSlot)
      .set({ isActive: false })
      .where('isActive = :a', { a: true })
      .andWhere('expiresAt <= :now', { now })
      .execute();
  }

  // ─── Agent Authority Score ───────────────────────────────────────────────────

  /**
   * Recompute authority score for one agent profile in-place.
   *
   * Formula:
   *   subscriptionWeight 40% — tick: gold=100, silver=75, bronze=50, verified=25, none=0
   *   responseSpeed      20% — reserved, default 50
   *   dealSuccess        20% — totalDeals capped at 50 → scaled 0–100
   *   reviews            10% — agentRating/5 × 100
   *   listingQuality     10% — totalListings capped at 30 → scaled 0–100
   */
  async computeAndSaveAuthorityScore(profile: AgentProfile): Promise<number> {
    const tickMap: Record<string, number> = { gold: 100, silver: 75, bronze: 50, verified: 25, none: 0 };
    const tickScore = tickMap[profile.tick] ?? 0;
    const responseScore = 50; // reserved
    const dealScore = Math.min((profile.totalDeals / 50) * 100, 100);
    const reviewScore = profile.rating ? (Number(profile.rating) / 5) * 100 : 0;
    const listingScore = Math.min((profile.totalListings / 30) * 100, 100);

    const score =
      tickScore * 0.40 +
      responseScore * 0.20 +
      dealScore * 0.20 +
      reviewScore * 0.10 +
      listingScore * 0.10;

    const rounded = Math.round(score * 100) / 100;
    profile.authorityScore = rounded;
    profile.authorityScoreUpdatedAt = new Date();
    await this.agentProfileRepo.save(profile);
    return rounded;
  }

  /** Cron: recompute authority scores for all agent profiles every 6 hours */
  @Cron('0 */6 * * *')
  async recomputeAllAuthorityScores() {
    const profiles = await this.agentProfileRepo.find({ where: { isActive: true } });
    for (const profile of profiles) {
      await this.computeAndSaveAuthorityScore(profile);
    }
  }

  /** Return top ticked agents — city-scoped or global — shaped for the frontend Agent interface */
  async getTopAgentsByCity(city: string, limit = 12): Promise<any[]> {
    const qb = this.premiumSlotRepo.manager
      .createQueryBuilder()
      .from('users', 'u')
      .where('u.agentTick != :none', { none: 'none' })
      .andWhere('u.isActive = true')
      .orderBy('u.agentRating', 'DESC')
      .addOrderBy('u.totalDeals', 'DESC')
      .take(limit)
      .select([
        'u.id               AS id',
        'u.name             AS name',
        'u.avatar           AS avatar',
        'u.phone            AS phone',
        'u.company          AS company',
        'u.city             AS city',
        'u.state            AS state',
        'u.agentTick        AS agentTick',
        'u.agentRating      AS agentRating',
        'u.agentExperience  AS agentExperience',
        'u.totalDeals       AS totalDeals',
        'u.agentUsedQuota   AS agentUsedQuota',
        'u.isVerified       AS isVerified',
        'u.agentBio         AS agentBio',
      ]);

    if (city) {
      qb.andWhere('LOWER(u.city) = LOWER(:city)', { city });
    }

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      id:              r.id,
      name:            r.name,
      avatar:          r.avatar || null,
      phone:           r.phone || null,
      company:         r.company || null,
      city:            r.city || null,
      state:           r.state || null,
      agentTick:       r.agentTick || 'none',
      agentRating:     r.agentRating != null ? Number(r.agentRating) : 0,
      agentExperience: r.agentExperience != null ? Number(r.agentExperience) : 0,
      totalDeals:      r.totalDeals != null ? Number(r.totalDeals) : 0,
      agentUsedQuota:  r.agentUsedQuota != null ? Number(r.agentUsedQuota) : 0,
      isVerified:      r.isVerified === 1 || r.isVerified === true || r.isVerified === '1',
      agentBio:        r.agentBio || null,
    }));

  }

  // ── Broker Transparency Profile ─────────────────────────────────────────────

  async getTransparencyProfile(
    userId: string,
    transparencyService: import('./broker-transparency.service').BrokerTransparencyService,
  ) {
    const db = this.agentProfileRepo.manager.connection;

    const profile = await this.agentProfileRepo.findOne({ where: { userId } });

    const userRows: any[] = await db.query(
      'SELECT agentRating, totalDeals, avatar, agentBio, agentLicense, city, state, phone, company, agentExperience FROM users WHERE id = ?',
      [userId],
    );
    const userRow = userRows[0] ?? null;
    if (!userRow) throw new NotFoundException('Agent not found');

    const reviewResult: any[] = await db.query(
      'SELECT COUNT(*) AS cnt FROM agent_feedback WHERE agentId = ?',
      [userId],
    );
    const totalReviews = Number(reviewResult[0]?.cnt ?? 0);

    return transparencyService.buildProfile(userId, {
      totalDeals:      Number(userRow.totalDeals   ?? 0),
      rating:          Number(userRow.agentRating  ?? 0),
      totalReviews,
      avgResponseHours: profile?.avgResponseHours ?? null,
      complaintCount:   profile?.complaintCount   ?? 0,
      profileScore:     this.computeProfileScore(userRow),
    });
  }

  private computeProfileScore(u: any): number {
    let score = 0;
    if (u.avatar)                   score += 15;
    if (u.agentBio)                 score += 15;
    if (u.agentLicense)             score += 10;
    if (u.agentExperience)          score += 10;
    if (u.phone)                    score += 10;
    if (u.company)                  score += 10;
    if (u.city && u.state)          score += 10;
    if (Number(u.totalDeals) > 0)   score += 10;
    if (Number(u.agentRating) > 0)  score += 10;
    return score;
  }

  async updateTrustSignals(
    profileId: string,
    dto: { complaintCount?: number; avgResponseHours?: number | null },
  ) {
    const profile = await this.agentProfileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    if (dto.complaintCount !== undefined) {
      profile.complaintCount = Math.max(0, dto.complaintCount);
    }
    if ('avgResponseHours' in dto) {
      profile.avgResponseHours = dto.avgResponseHours ?? null;
    }

    await this.agentProfileRepo.save(profile);
    return { success: true, profileId };
  }
}

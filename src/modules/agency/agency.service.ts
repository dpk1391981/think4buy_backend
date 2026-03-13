import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Agency } from './entities/agency.entity';
import { AgentProfile } from './entities/agent-profile.entity';
import { PropertyAgentMap } from './entities/property-agent-map.entity';
import { AgentLocationMap } from './entities/agent-location-map.entity';
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
    const dataSource = this.agentProfileRepo.manager.connection;

    // Build query joining users table so we can search by name/email
    let sql = `
      SELECT ap.*, u.name AS userName, u.email AS userEmail,
             ag.name AS agencyName
      FROM agent_profiles ap
      LEFT JOIN users u ON u.id = ap.userId
      LEFT JOIN agencies ag ON ag.id = ap.agencyId
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR ap.licenseNumber LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (unassigned) {
      sql += ` AND ap.agencyId IS NULL`;
    }

    const countSql = sql.replace(
      'ap.*, u.name AS userName, u.email AS userEmail, ag.name AS agencyName',
      'COUNT(*) AS cnt',
    );
    const [{ cnt }] = await dataSource.query(countSql, params);
    const total = Number(cnt);

    sql += ` ORDER BY ap.createdAt DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);
    const rows: any[] = await dataSource.query(sql, params);

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
      isActive: r.isActive,
      bio: r.bio,
      agencyName: r.agencyName,
      user: r.userId ? { id: r.userId, name: r.userName, email: r.userEmail } : null,
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

  async getAgentProperties(
    agentId: string,
    page = 1,
    limit = 20,
  ) {
    const [items, total] = await this.propertyAgentMapRepo.findAndCount({
      where: { agentId, isActive: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Agent Location Mapping ───────────────────────────────────────────────────

  async addAgentLocation(agentId: string, dto: AssignAgentLocationDto): Promise<AgentLocationMap> {
    const profile = await this.agentProfileRepo.findOne({ where: { id: agentId } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    // Prevent duplicate location mapping
    const existing = await this.agentLocationMapRepo.findOne({
      where: {
        agentId,
        countryId: dto.countryId || null,
        stateId: dto.stateId || null,
        cityId: dto.cityId || null,
      },
    });
    if (existing) throw new ConflictException('Location already mapped to this agent');

    const loc = this.agentLocationMapRepo.create({ agentId, ...dto });
    return this.agentLocationMapRepo.save(loc);
  }

  async removeAgentLocation(locationMapId: string): Promise<{ message: string }> {
    const loc = await this.agentLocationMapRepo.findOne({ where: { id: locationMapId } });
    if (!loc) throw new NotFoundException('Location mapping not found');
    await this.agentLocationMapRepo.remove(loc);
    return { message: 'Location mapping removed' };
  }

  async getAgentLocations(agentId: string): Promise<AgentLocationMap[]> {
    return this.agentLocationMapRepo.find({ where: { agentId } });
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
}

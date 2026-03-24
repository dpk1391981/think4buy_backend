import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceLead, ServiceLeadStatus } from './entities/service-lead.entity';
import { ServiceCatalog } from './entities/service-catalog.entity';
import {
  CreateServiceLeadDto,
  UpdateServiceLeadDto,
  ServiceLeadsQueryDto,
} from './dto/service-lead.dto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ServiceLeadsService {
  constructor(
    @InjectRepository(ServiceLead)
    private readonly repo: Repository<ServiceLead>,
    @InjectRepository(ServiceCatalog)
    private readonly catalogRepo: Repository<ServiceCatalog>,
  ) {}

  // ── Public: capture lead ────────────────────────────────────────────────────

  async create(dto: CreateServiceLeadDto): Promise<ServiceLead> {
    // Accept either a UUID or a slug — resolve to the actual UUID
    let resolvedServiceId = dto.serviceId;
    if (!UUID_RE.test(dto.serviceId)) {
      const service = await this.catalogRepo.findOne({
        where: { slug: dto.serviceId },
        select: ['id'],
      });
      if (!service) {
        throw new BadRequestException(`Service "${dto.serviceId}" not found`);
      }
      resolvedServiceId = service.id;
    }

    const lead = this.repo.create({
      serviceId: resolvedServiceId,
      name:      dto.name.trim(),
      phone:     dto.phone,
      email:     dto.email || null,
      location:  dto.location?.trim() || null,
      interest:  dto.interest?.trim() || null,
      message:   dto.message?.trim() || null,
      source:    dto.source || 'web',
      status:    ServiceLeadStatus.NEW,
    });
    return this.repo.save(lead);
  }

  // ── Admin: list with filters + pagination ───────────────────────────────────

  async findAll(query: ServiceLeadsQueryDto) {
    const {
      serviceId, status, location, from, to, search,
      page = 1, limit = 20,
    } = query;

    const qb = this.repo
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.service', 'svc');

    if (serviceId) qb.andWhere('sl.serviceId = :serviceId', { serviceId });
    if (status)    qb.andWhere('sl.status = :status', { status });
    if (location)  qb.andWhere('sl.location LIKE :location', { location: `%${location}%` });
    if (from && to) qb.andWhere('sl.createdAt BETWEEN :from AND :to', { from: new Date(from), to: new Date(to) });
    if (search)    qb.andWhere('(sl.name LIKE :s OR sl.phone LIKE :s OR sl.email LIKE :s)', { s: `%${search}%` });

    const take   = Math.min(Number(limit), 100);
    const skip   = (Number(page) - 1) * take;
    const [data, total] = await qb
      .orderBy('sl.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return { data, total, page: Number(page), limit: take };
  }

  // ── Admin: get single lead ──────────────────────────────────────────────────

  async findOne(id: string): Promise<ServiceLead> {
    const lead = await this.repo.findOne({
      where: { id },
      relations: ['service'],
    });
    if (!lead) throw new NotFoundException('Service lead not found');
    return lead;
  }

  // ── Admin: update status / note ─────────────────────────────────────────────

  async update(id: string, dto: UpdateServiceLeadDto): Promise<ServiceLead> {
    const lead = await this.findOne(id);
    if (dto.status)    lead.status    = dto.status as ServiceLeadStatus;
    if (dto.adminNote !== undefined) lead.adminNote = dto.adminNote;
    return this.repo.save(lead);
  }

  // ── Admin: stats ─────────────────────────────────────────────────────────────

  async getStats() {
    const total     = await this.repo.count();
    const newCount  = await this.repo.count({ where: { status: ServiceLeadStatus.NEW } });
    const contacted = await this.repo.count({ where: { status: ServiceLeadStatus.CONTACTED } });
    const closed    = await this.repo.count({ where: { status: ServiceLeadStatus.CLOSED } });

    // Leads per service (top 10)
    const byService = await this.repo
      .createQueryBuilder('sl')
      .leftJoin('sl.service', 'svc')
      .select(['svc.name AS serviceName', 'svc.slug AS serviceSlug', 'COUNT(sl.id) AS cnt'])
      .groupBy('sl.serviceId')
      .orderBy('cnt', 'DESC')
      .limit(10)
      .getRawMany();

    return { total, new: newCount, contacted, closed, byService };
  }
}

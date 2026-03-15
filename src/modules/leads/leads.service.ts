import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead, LeadStatus, LeadSource, LeadTemperature } from './entities/lead.entity';
import { LeadAssignment, AssignmentType } from './entities/lead-assignment.entity';
import { LeadActivityLog, ActivityType, ActorType } from './entities/lead-activity-log.entity';
import { CreateLeadDto, PublicLeadDto, UpdateLeadStatusDto, AssignLeadDto, AddLeadNoteDto, LeadsQueryDto } from './dto/leads.dto';
import { LeadAssignmentEngineService } from './lead-assignment-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

/** Dedup window: same phone + same property within this many minutes = duplicate */
const DEDUP_WINDOW_MINUTES = 10;

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private leadRepo: Repository<Lead>,
    @InjectRepository(LeadAssignment)
    private assignmentRepo: Repository<LeadAssignment>,
    @InjectRepository(LeadActivityLog)
    private activityRepo: Repository<LeadActivityLog>,
    private readonly assignmentEngine: LeadAssignmentEngineService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Scoring ────────────────────────────────────────────────────────────────

  private calcScore(dto: CreateLeadDto | PublicLeadDto): number {
    let score = 0;
    if (dto.budgetMin || dto.budgetMax) score += 20;
    if (dto.contactEmail) score += 10;
    if (dto.requirement) score += 10;
    if (
      dto.source === LeadSource.PROPERTY_PAGE ||
      dto.source === LeadSource.CONTACT_FORM ||
      dto.source === LeadSource.SCHEDULE_VISIT
    ) score += 15;
    if (dto.source === LeadSource.VIEW_PHONE) score += 25;
    if (dto.source === LeadSource.DOWNLOAD_BROCHURE) score += 10;
    if (dto.propertyId) score += 15;
    if (dto.cityId) score += 5;
    return Math.min(score, 100);
  }

  private getTemperature(score: number): LeadTemperature {
    if (score >= 75) return LeadTemperature.HOT;
    if (score >= 45) return LeadTemperature.WARM;
    return LeadTemperature.COLD;
  }

  // ── Deduplication ──────────────────────────────────────────────────────────

  /**
   * Returns an existing lead if the same phone + property combo was submitted
   * within the dedup window, otherwise null.
   */
  private async findDuplicate(phone: string, propertyId?: string): Promise<Lead | null> {
    const windowStart = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000);
    const qb = this.leadRepo
      .createQueryBuilder('l')
      .where('l.contactPhone = :phone', { phone })
      .andWhere('l.createdAt >= :windowStart', { windowStart })
      .andWhere('l.status != :dup', { dup: LeadStatus.DUPLICATE })
      .orderBy('l.createdAt', 'DESC');

    if (propertyId) {
      qb.andWhere('l.propertyId = :pid', { pid: propertyId });
    }

    return qb.getOne();
  }

  // ── Public capture (no auth) ───────────────────────────────────────────────

  async capturePublic(dto: PublicLeadDto): Promise<{ lead: Lead; isDuplicate: boolean }> {
    const existing = await this.findDuplicate(dto.contactPhone, dto.propertyId);
    if (existing) {
      this.logger.debug(`Dedup hit: lead ${existing.id} for ${dto.contactPhone}`);
      return { lead: existing, isDuplicate: true };
    }

    const score = this.calcScore(dto);
    const agentId = await this.assignmentEngine.resolveAgent({
      propertyId: dto.propertyId,
      cityId: dto.cityId,
      city: dto.city,
    });

    const lead = this.leadRepo.create({
      ...dto,
      leadScore: score,
      temperature: this.getTemperature(score),
      status: LeadStatus.NEW,
      assignedAgentId: agentId ?? null,
    });
    const saved = await this.leadRepo.save(lead);

    if (agentId) {
      await this.assignmentRepo.save(
        this.assignmentRepo.create({
          leadId: saved.id,
          agentId,
          assignedBy: null,
          assignmentType: AssignmentType.AUTO,
          isActive: true,
          reason: 'Auto-assigned on capture',
        }),
      );
    }

    await this.logActivity(
      saved.id,
      ActivityType.STATUS_CHANGE,
      null,
      { status: LeadStatus.NEW },
      `Lead captured via ${dto.source}`,
      null,
      ActorType.SYSTEM,
    );

    // Notify assigned agent
    if (agentId) {
      const propertyRef = dto.propertyId ? ` for property` : '';
      this.notificationsService.createSilent({
        userId: agentId,
        role: 'agent',
        title: 'New Lead Received',
        message: `New ${saved.temperature} lead from ${saved.contactName || saved.contactPhone}${propertyRef}.`,
        type: NotificationType.LEAD,
        entityType: 'lead',
        entityId: saved.id,
      });
    }

    return { lead: saved, isDuplicate: false };
  }

  // ── Authenticated create (agent / admin) ───────────────────────────────────

  async create(dto: CreateLeadDto, createdByUserId?: string): Promise<Lead> {
    const existing = await this.findDuplicate(dto.contactPhone, dto.propertyId);
    if (existing) {
      return existing;
    }

    const score = this.calcScore(dto);
    const autoAgentId = dto.propertyId
      ? await this.assignmentEngine.resolveAgent({
          propertyId: dto.propertyId,
          cityId: dto.cityId,
          city: dto.city,
        })
      : null;

    const agentId = createdByUserId ?? autoAgentId ?? null;

    const lead = this.leadRepo.create({
      ...dto,
      leadScore: score,
      temperature: this.getTemperature(score),
      status: LeadStatus.NEW,
      assignedAgentId: agentId,
    });
    const saved = await this.leadRepo.save(lead);

    if (agentId) {
      await this.assignmentRepo.save(
        this.assignmentRepo.create({
          leadId: saved.id,
          agentId,
          assignedBy: createdByUserId ?? null,
          assignmentType: createdByUserId ? AssignmentType.MANUAL : AssignmentType.AUTO,
          isActive: true,
          reason: createdByUserId ? 'Self-created' : 'Auto-assigned',
        }),
      );
    }

    await this.logActivity(
      saved.id,
      ActivityType.STATUS_CHANGE,
      null,
      { status: LeadStatus.NEW },
      'Lead created',
      createdByUserId,
      ActorType.SYSTEM,
    );
    return saved;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async findAll(query: LeadsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const qb = this.leadRepo.createQueryBuilder('lead').orderBy('lead.createdAt', 'DESC');

    if (query.status) qb.andWhere('lead.status = :status', { status: query.status });
    if (query.temperature) qb.andWhere('lead.temperature = :temp', { temp: query.temperature });
    if (query.city) qb.andWhere('lead.city LIKE :city', { city: `%${query.city}%` });
    if (query.propertyType) qb.andWhere('lead.propertyType = :pt', { pt: query.propertyType });
    if (query.agentId) qb.andWhere('lead.assignedAgentId = :agentId', { agentId: query.agentId });
    if (query.search) {
      qb.andWhere(
        '(lead.contactName LIKE :s OR lead.contactPhone LIKE :s OR lead.contactEmail LIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    if (query.dateFrom) qb.andWhere('lead.createdAt >= :df', { df: query.dateFrom });
    if (query.dateTo) qb.andWhere('lead.createdAt <= :dt', { dt: query.dateTo });

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByAgent(agentId: string, query: LeadsQueryDto) {
    return this.findAll({ ...query, agentId });
  }

  async findOne(id: string): Promise<Lead> {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  async updateStatus(
    id: string,
    dto: UpdateLeadStatusDto,
    actorId: string,
    actorType = ActorType.AGENT,
  ): Promise<Lead> {
    const lead = await this.findOne(id);
    const oldStatus = lead.status;
    lead.status = dto.status;
    if (dto.notes) lead.notes = dto.notes;
    if (dto.lostReason) lead.lostReason = dto.lostReason;
    const saved = await this.leadRepo.save(lead);
    await this.logActivity(
      id,
      ActivityType.STATUS_CHANGE,
      { status: oldStatus },
      { status: dto.status },
      dto.notes,
      actorId,
      actorType,
    );
    return saved;
  }

  async assignLead(id: string, dto: AssignLeadDto, assignedByUserId: string): Promise<Lead> {
    const lead = await this.findOne(id);

    await this.assignmentRepo.update(
      { leadId: id, isActive: true },
      { isActive: false, unassignedAt: new Date() },
    );

    await this.assignmentRepo.save(
      this.assignmentRepo.create({
        leadId: id,
        agentId: dto.agentId,
        assignedBy: assignedByUserId,
        assignmentType: AssignmentType.MANUAL,
        isActive: true,
        reason: dto.reason,
      }),
    );

    const oldAgentId = lead.assignedAgentId;
    lead.assignedAgentId = dto.agentId;
    const saved = await this.leadRepo.save(lead);

    await this.logActivity(
      id,
      ActivityType.ASSIGNMENT_CHANGED,
      { agentId: oldAgentId },
      { agentId: dto.agentId },
      dto.reason,
      assignedByUserId,
      ActorType.ADMIN,
    );
    return saved;
  }

  async addNote(id: string, dto: AddLeadNoteDto, actorId: string): Promise<LeadActivityLog> {
    await this.findOne(id);
    return this.logActivity(id, ActivityType.NOTE_ADDED, null, null, dto.notes, actorId, ActorType.AGENT);
  }

  async getActivities(leadId: string): Promise<LeadActivityLog[]> {
    return this.activityRepo.find({ where: { leadId }, order: { createdAt: 'DESC' } });
  }

  async getAssignments(leadId: string): Promise<LeadAssignment[]> {
    return this.assignmentRepo.find({ where: { leadId }, order: { assignedAt: 'DESC' } });
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  async getStats(agentId?: string) {
    const db = this.leadRepo.manager.connection;
    const params: any[] = [];
    let where = '1=1';
    if (agentId) {
      where += ' AND assignedAgentId = ?';
      params.push(agentId);
    }

    const rows: any[] = await db.query(
      `SELECT status, COUNT(*) as cnt FROM leads WHERE ${where} GROUP BY status`,
      params,
    );
    const temp: any[] = await db.query(
      `SELECT temperature, COUNT(*) as cnt FROM leads WHERE ${where} GROUP BY temperature`,
      params,
    );

    const statusMap: Record<string, number> = {};
    rows.forEach((r) => { statusMap[r.status] = Number(r.cnt); });
    const tempMap: Record<string, number> = {};
    temp.forEach((r) => { tempMap[r.temperature] = Number(r.cnt); });

    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
    return { total, byStatus: statusMap, byTemperature: tempMap };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async logActivity(
    leadId: string,
    activityType: ActivityType,
    oldValue: any,
    newValue: any,
    notes: string,
    actorId: string,
    actorType: ActorType,
  ): Promise<LeadActivityLog> {
    const log = this.activityRepo.create({
      leadId,
      activityType,
      oldValue,
      newValue,
      notes,
      actorId,
      actorType,
    });
    return this.activityRepo.save(log);
  }
}

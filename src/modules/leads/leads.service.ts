import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead, LeadStatus, LeadSource, LeadTemperature } from './entities/lead.entity';
import { LeadAssignment, AssignmentType } from './entities/lead-assignment.entity';
import { LeadActivityLog, ActivityType, ActorType } from './entities/lead-activity-log.entity';
import { CreateLeadDto, UpdateLeadStatusDto, AssignLeadDto, AddLeadNoteDto, LeadsQueryDto } from './dto/leads.dto';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private leadRepo: Repository<Lead>,
    @InjectRepository(LeadAssignment)
    private assignmentRepo: Repository<LeadAssignment>,
    @InjectRepository(LeadActivityLog)
    private activityRepo: Repository<LeadActivityLog>,
  ) {}

  private calcScore(dto: CreateLeadDto): number {
    let score = 0;
    if (dto.budgetMin || dto.budgetMax) score += 20;
    if (dto.contactEmail) score += 10;
    if (dto.requirement) score += 10;
    if (dto.source === LeadSource.PROPERTY_PAGE || dto.source === LeadSource.CONTACT_FORM) score += 15;
    if (dto.propertyId) score += 15;
    return Math.min(score, 100);
  }

  private getTemperature(score: number): LeadTemperature {
    if (score >= 75) return LeadTemperature.HOT;
    if (score >= 45) return LeadTemperature.WARM;
    return LeadTemperature.COLD;
  }

  async create(dto: CreateLeadDto, createdByUserId?: string): Promise<Lead> {
    const score = this.calcScore(dto);
    const lead = this.leadRepo.create({
      ...dto,
      leadScore: score,
      temperature: this.getTemperature(score),
      status: LeadStatus.NEW,
      assignedAgentId: createdByUserId ?? null,
    });
    const saved = await this.leadRepo.save(lead);

    if (createdByUserId) {
      const assignment = this.assignmentRepo.create({
        leadId: saved.id,
        agentId: createdByUserId,
        assignedBy: createdByUserId,
        assignmentType: AssignmentType.MANUAL,
        isActive: true,
        reason: 'Self-created',
      });
      await this.assignmentRepo.save(assignment);
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

    const assignment = this.assignmentRepo.create({
      leadId: id,
      agentId: dto.agentId,
      assignedBy: assignedByUserId,
      assignmentType: AssignmentType.MANUAL,
      isActive: true,
      reason: dto.reason,
    });
    await this.assignmentRepo.save(assignment);

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

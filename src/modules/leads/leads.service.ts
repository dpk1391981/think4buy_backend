import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead, LeadStatus, LeadSource, LeadTemperature } from './entities/lead.entity';
import { LeadAssignment, AssignmentType } from './entities/lead-assignment.entity';
import { LeadActivityLog, ActivityType, ActorType } from './entities/lead-activity-log.entity';
import { CreateLeadDto, PublicLeadDto, UpdateLeadStatusDto, AssignLeadDto, AddLeadNoteDto, LeadsQueryDto, BulkAssignDto, BulkStatusDto, AnalyticsQueryDto } from './dto/leads.dto';
import { LeadAssignmentEngineService } from './lead-assignment-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { MessagingQueueService } from '../messaging/messaging-queue.service';
import { User } from '../users/entities/user.entity';

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
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private readonly assignmentEngine: LeadAssignmentEngineService,
    private readonly notificationsService: NotificationsService,
    private readonly messagingQueue: MessagingQueueService,
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
      dto.source === LeadSource.SCHEDULE_VISIT ||
      dto.source === LeadSource.FIND_PROPERTY
    ) score += 15;
    if (dto.source === LeadSource.VIEW_PHONE) score += 25;
    if (dto.source === LeadSource.DOWNLOAD_BROCHURE) score += 10;
    if (dto.propertyId) score += 15;
    if (dto.cityId) score += 5;
    if ((dto as any).localityId || (dto as any).locality) score += 10;
    if ((dto as any).propertyFor) score += 5;
    if ((dto as any).areaMin || (dto as any).areaMax) score += 5;
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

  /** Strip country code/spaces so phone is always 10 Indian digits */
  private normalizePhone(raw: string): string {
    const digits = (raw || '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0'))  return digits.slice(1);
    return digits.slice(-10);
  }

  async capturePublic(dto: PublicLeadDto): Promise<{ lead: Lead; isDuplicate: boolean }> {
    const phone = this.normalizePhone(dto.contactPhone);
    dto = { ...dto, contactPhone: phone };
    const existing = await this.findDuplicate(phone, dto.propertyId);
    if (existing) {
      this.logger.debug(`Dedup hit: lead ${existing.id} for ${dto.contactPhone}`);
      return { lead: existing, isDuplicate: true };
    }

    const score = this.calcScore(dto);
    // Use the explicitly-requested agent (e.g. from agent profile page) before
    // falling back to the auto-assignment engine.
    const agentId =
      (dto as any).assignedAgentId ??
      (await this.assignmentEngine.resolveAgent({
        propertyId: dto.propertyId,
        cityId: dto.cityId,
        city: dto.city,
      }));

    // Strip assignedAgentId + map extra frontend fields before spread
    const {
      assignedAgentId: _unused,
      contactUserId,
      message,
      note,
      price,
      area,
      category: _category, // Lead entity has no 'category' column; stored in requirement
      ...leadFields
    } = dto as any;

    // Map message → requirement, note → notes, price → budget range, area → areaMin/areaMax
    const requirement = leadFields.requirement || message || undefined;
    const notes       = note || undefined;
    const budgetMin   = leadFields.budgetMin ?? (price ?? undefined);
    const budgetMax   = leadFields.budgetMax ?? (price ?? undefined);
    const areaMin     = leadFields.areaMin   ?? (area  ?? undefined);
    const areaMax     = leadFields.areaMax   ?? (area  ?? undefined);

    const lead = this.leadRepo.create({
      ...leadFields,
      requirement,
      notes,
      budgetMin,
      budgetMax,
      areaMin,
      areaMax,
      leadScore: score,
      temperature: this.getTemperature(score),
      status: LeadStatus.NEW,
      assignedAgentId: agentId ?? null,
      contactUserId: contactUserId ?? null,
    });
    const saved = await this.leadRepo.save(lead) as unknown as Lead;

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

    // Trigger messaging queue event (look up agent contact details if assigned)
    const agentUser = agentId ? await this.userRepo.findOne({ where: { id: agentId } }) : null;
    this.messagingQueue.trigger('lead_created', {
      buyer: {
        userId:  contactUserId ?? undefined,
        name:    saved.contactName,
        phone:   saved.contactPhone,
        email:   saved.contactEmail,
      },
      agent: agentUser ? {
        userId: agentUser.id,
        name:   agentUser.name,
        phone:  agentUser.phone,
        email:  agentUser.email,
      } : undefined,
      property_title: dto.propertyId ?? '',
      source:         saved.source,
      lead_id:        saved.id,
    }).catch(() => {});

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
    const saved = await this.leadRepo.save(lead) as unknown as Lead;

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

  private applyFilters(qb: any, query: LeadsQueryDto) {
    if (query.status) qb.andWhere('lead.status = :status', { status: query.status });
    if (query.temperature) qb.andWhere('lead.temperature = :temp', { temp: query.temperature });
    if (query.city) qb.andWhere('lead.city LIKE :city', { city: `%${query.city}%` });
    if (query.propertyType) qb.andWhere('lead.propertyType = :pt', { pt: query.propertyType });
    if (query.agentId) qb.andWhere('lead.assignedAgentId = :agentId', { agentId: query.agentId });
    if (query.agencyId) qb.andWhere('lead.agencyId = :agencyId', { agencyId: query.agencyId });
    if (query.search) {
      qb.andWhere(
        '(lead.contactName LIKE :s OR lead.contactPhone LIKE :s OR lead.contactEmail LIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    if (query.dateFrom) qb.andWhere('lead.createdAt >= :df', { df: query.dateFrom });
    if (query.dateTo) {
      // Include full day
      const dt = new Date(query.dateTo);
      dt.setHours(23, 59, 59, 999);
      qb.andWhere('lead.createdAt <= :dt', { dt: dt.toISOString() });
    }
    if (query.source) qb.andWhere('lead.source = :source', { source: query.source });
    if (query.propertyFor) qb.andWhere('lead.propertyFor = :pf', { pf: query.propertyFor });
    if (query.locality) qb.andWhere('lead.locality LIKE :loc', { loc: `%${query.locality}%` });
    if (query.unassigned === 'true') qb.andWhere('lead.assignedAgentId IS NULL');
  }

  async findAll(query: LeadsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const qb = this.leadRepo.createQueryBuilder('lead').orderBy('lead.createdAt', 'DESC');
    this.applyFilters(qb, query);
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByAgent(agentId: string, query: LeadsQueryDto) {
    return this.findAll({ ...query, agentId });
  }

  async findOne(id: string): Promise<Lead & { property?: Record<string, any> }> {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    // Enrich with property snapshot if propertyId is set
    let property: Record<string, any> | undefined;
    if (lead.propertyId) {
      try {
        const rows: any[] = await this.leadRepo.query(`
          SELECT
            p.id, p.title, p.slug, p.type, p.category,
            p.price, p.priceUnit, p.area, p.areaUnit,
            p.city, p.state, p.locality, p.address,
            p.bedrooms, p.bathrooms, p.status, p.approvalStatus,
            p.isVerified, p.isPremium, p.reraNumber,
            (SELECT i.url FROM property_images i WHERE i.propertyId = p.id AND i.isPrimary = 1 LIMIT 1) AS primaryImage
          FROM properties p
          WHERE p.id = ?
          LIMIT 1
        `, [lead.propertyId]);
        if (rows.length) property = rows[0];
      } catch {
        // Non-critical — ignore if property table structure differs
      }
    }

    return { ...lead, property } as any;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  /** Human-readable status labels for buyer notifications */
  private readonly STATUS_LABEL: Partial<Record<LeadStatus, string>> = {
    [LeadStatus.CONTACTED]:            'An agent has reviewed your inquiry and will contact you.',
    [LeadStatus.FOLLOW_UP]:            'An agent will follow up with you soon.',
    [LeadStatus.SITE_VISIT_SCHEDULED]: 'Your site visit has been scheduled — our agent will reach out to confirm.',
    [LeadStatus.SITE_VISIT_COMPLETED]: 'Your site visit has been recorded. We hope it went well!',
    [LeadStatus.NEGOTIATION]:          'Your inquiry has entered the negotiation stage.',
    [LeadStatus.DEAL_IN_PROGRESS]:     'Great news — your deal is currently in progress.',
    [LeadStatus.DEAL_WON]:             'Congratulations! Your deal has been successfully closed.',
    [LeadStatus.DEAL_LOST]:            'Unfortunately your inquiry could not proceed this time.',
  };

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

    // Notify the buyer (if we have their user account)
    const buyerMsg = this.STATUS_LABEL[dto.status];
    if (lead.contactUserId && buyerMsg) {
      this.notificationsService.createSilent({
        userId: lead.contactUserId,
        title: 'Update on your property inquiry',
        message: buyerMsg + (dto.notes ? ` Note from agent: ${dto.notes}` : ''),
        type: NotificationType.LEAD,
        entityType: 'lead',
        entityId: id,
      });
    }

    // Trigger messaging queue event
    this.messagingQueue.trigger('lead_status_updated', {
      buyer: {
        userId: lead.contactUserId ?? undefined,
        name:   lead.contactName,
        phone:  lead.contactPhone,
        email:  lead.contactEmail,
      },
      agent: lead.assignedAgentId ? { userId: lead.assignedAgentId } : undefined,
      new_status: dto.status,
      notes:      dto.notes ?? '',
      lead_id:    id,
    }).catch(() => {});

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
    const lead = await this.findOne(id);
    const log = await this.logActivity(id, ActivityType.NOTE_ADDED, null, null, dto.notes, actorId, ActorType.AGENT);
    // Notify the buyer that the agent has sent them a message
    if (lead.contactUserId) {
      this.notificationsService.createSilent({
        userId: lead.contactUserId,
        title: 'Message from your agent',
        message: dto.notes,
        type: NotificationType.LEAD,
        entityType: 'lead',
        entityId: id,
      });
    }
    return log;
  }

  async getActivities(leadId: string): Promise<LeadActivityLog[]> {
    return this.activityRepo.find({ where: { leadId }, order: { createdAt: 'DESC' } });
  }

  async getAssignments(leadId: string): Promise<LeadAssignment[]> {
    return this.assignmentRepo.find({ where: { leadId }, order: { assignedAt: 'DESC' } });
  }

  // ── Bulk operations ────────────────────────────────────────────────────────

  async bulkAssign(dto: BulkAssignDto, assignedByUserId: string): Promise<{ updated: number }> {
    let updated = 0;
    for (const leadId of dto.leadIds) {
      try {
        await this.assignLead(leadId, { agentId: dto.agentId, reason: dto.reason || 'Bulk assigned' }, assignedByUserId);
        updated++;
      } catch (e) {
        this.logger.warn(`Bulk assign skipped lead ${leadId}: ${e.message}`);
      }
    }
    return { updated };
  }

  async bulkUpdateStatus(dto: BulkStatusDto, actorId: string): Promise<{ updated: number }> {
    let updated = 0;
    for (const leadId of dto.leadIds) {
      try {
        await this.updateStatus(leadId, { status: dto.status, notes: dto.notes }, actorId, ActorType.ADMIN);
        updated++;
      } catch (e) {
        this.logger.warn(`Bulk status skipped lead ${leadId}: ${e.message}`);
      }
    }
    return { updated };
  }

  async mergeLead(keepId: string, mergeId: string, actorId: string): Promise<Lead> {
    const keep  = await this.findOne(keepId);
    const merge = await this.findOne(mergeId);
    // Mark the merged lead as duplicate pointing to the kept lead
    merge.status      = LeadStatus.DUPLICATE;
    merge.duplicateOfId = keepId;
    await this.leadRepo.save(merge);
    // Enrich the kept lead with any missing info from the merged lead
    if (!keep.contactEmail && merge.contactEmail)  keep.contactEmail  = merge.contactEmail;
    if (!keep.city        && merge.city)           keep.city          = merge.city;
    if (!keep.locality    && merge.locality)       keep.locality      = merge.locality;
    if (!keep.propertyType && merge.propertyType)  keep.propertyType  = merge.propertyType;
    if (!keep.budgetMin   && merge.budgetMin)      keep.budgetMin     = merge.budgetMin;
    if (!keep.budgetMax   && merge.budgetMax)      keep.budgetMax     = merge.budgetMax;
    if (!keep.requirement && merge.requirement)    keep.requirement   = merge.requirement;
    const saved = await this.leadRepo.save(keep);
    await this.logActivity(keepId, ActivityType.NOTE_ADDED, null, null,
      `Merged with duplicate lead ${mergeId}`, actorId, ActorType.ADMIN);
    return saved;
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  async exportCsv(query: LeadsQueryDto): Promise<string> {
    const qb = this.leadRepo.createQueryBuilder('lead').orderBy('lead.createdAt', 'DESC');
    this.applyFilters(qb, query);
    const leads = await qb.take(10000).getMany(); // cap at 10k rows

    const cols = [
      { key: 'id',              header: 'Lead ID'        },
      { key: 'contactName',     header: 'Name'           },
      { key: 'contactPhone',    header: 'Phone'          },
      { key: 'contactEmail',    header: 'Email'          },
      { key: 'city',            header: 'City'           },
      { key: 'state',           header: 'State'          },
      { key: 'locality',        header: 'Locality'       },
      { key: 'propertyType',    header: 'Property Type'  },
      { key: 'propertyFor',     header: 'Looking To'     },
      { key: 'budgetMin',       header: 'Budget Min'     },
      { key: 'budgetMax',       header: 'Budget Max'     },
      { key: 'areaMin',         header: 'Area Min'       },
      { key: 'areaMax',         header: 'Area Max'       },
      { key: 'areaUnit',        header: 'Area Unit'      },
      { key: 'source',          header: 'Source'         },
      { key: 'status',          header: 'Status'         },
      { key: 'temperature',     header: 'Temperature'    },
      { key: 'leadScore',       header: 'Lead Score'     },
      { key: 'assignedAgentId', header: 'Assigned Agent' },
      { key: 'agencyId',        header: 'Agency ID'      },
      { key: 'requirement',     header: 'Requirement'    },
      { key: 'notes',           header: 'Notes'          },
      { key: 'utmSource',       header: 'UTM Source'     },
      { key: 'utmMedium',       header: 'UTM Medium'     },
      { key: 'utmCampaign',     header: 'UTM Campaign'   },
      { key: 'createdAt',       header: 'Created At'     },
      { key: 'updatedAt',       header: 'Updated At'     },
    ];

    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = cols.map(c => escape(c.header)).join(',');
    const rows   = leads.map(lead =>
      cols.map(c => escape((lead as any)[c.key])).join(',')
    );
    return [header, ...rows].join('\r\n');
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

  async getAnalytics(params: AnalyticsQueryDto) {
    const db = this.leadRepo.manager.connection;

    const whereClauses: string[] = [];
    const sqlParams: any[] = [];

    if (params.dateFrom) { whereClauses.push('createdAt >= ?'); sqlParams.push(params.dateFrom); }
    if (params.dateTo)   { whereClauses.push('createdAt <= ?'); sqlParams.push(`${params.dateTo} 23:59:59`); }
    if (params.agentId)  { whereClauses.push('assignedAgentId = ?'); sqlParams.push(params.agentId); }
    if (params.city)     { whereClauses.push('city LIKE ?'); sqlParams.push(`%${params.city}%`); }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [total, byStatus, byTemp, bySource, byCity, byType, dailyTrend, agentPerf] = await Promise.all([
      db.query(`SELECT COUNT(*) as cnt FROM leads ${where}`, sqlParams),
      db.query(`SELECT status, COUNT(*) as cnt FROM leads ${where} GROUP BY status ORDER BY cnt DESC`, sqlParams),
      db.query(`SELECT temperature, COUNT(*) as cnt FROM leads ${where} GROUP BY temperature`, sqlParams),
      db.query(`SELECT source, COUNT(*) as cnt FROM leads ${where} GROUP BY source ORDER BY cnt DESC`, sqlParams),
      db.query(`SELECT city, COUNT(*) as cnt FROM leads ${where} AND city IS NOT NULL AND city != '' GROUP BY city ORDER BY cnt DESC LIMIT 10`
        .replace('AND city', whereClauses.length ? 'AND city' : 'WHERE city'), sqlParams),
      db.query(`SELECT propertyType, COUNT(*) as cnt FROM leads ${where} AND propertyType IS NOT NULL GROUP BY propertyType ORDER BY cnt DESC`
        .replace('AND propertyType', whereClauses.length ? 'AND propertyType' : 'WHERE propertyType'), sqlParams),
      db.query(
        `SELECT DATE(createdAt) as date, COUNT(*) as cnt FROM leads WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY DATE(createdAt) ORDER BY date ASC`,
        [],
      ),
      db.query(
        `SELECT l.assignedAgentId as agentId,
          COALESCE(u.name, l.assignedAgentId) as agentName,
          COALESCE(u.city, '') as agentCity,
          REPLACE(l.assignedAgentId, '-', '') as agentUid,
          COUNT(*) as total,
          SUM(CASE WHEN l.status = 'deal_won' THEN 1 ELSE 0 END) as won,
          SUM(CASE WHEN l.status = 'deal_lost' THEN 1 ELSE 0 END) as lost,
          SUM(CASE WHEN l.status = 'new' THEN 1 ELSE 0 END) as newCount
         FROM leads l
         LEFT JOIN users u ON u.id = l.assignedAgentId
         WHERE l.assignedAgentId IS NOT NULL
         GROUP BY l.assignedAgentId, u.name, u.city
         ORDER BY total DESC
         LIMIT 10`,
        [],
      ),
    ]);

    const toMap = (rows: any[]) => {
      const m: Record<string, number> = {};
      rows.forEach(r => { const key = Object.keys(r).find(k => k !== 'cnt')!; m[r[key] || 'unknown'] = Number(r.cnt); });
      return m;
    };

    // Today
    const today = new Date(); today.setHours(0,0,0,0);
    const todayCount = await db.query(`SELECT COUNT(*) as cnt FROM leads WHERE createdAt >= ?`, [today.toISOString()]);

    return {
      total:          Number(total[0]?.cnt ?? 0),
      today:          Number(todayCount[0]?.cnt ?? 0),
      byStatus:       toMap(byStatus),
      byTemperature:  toMap(byTemp),
      bySource:       toMap(bySource),
      byCity:         toMap(byCity),
      byPropertyType: toMap(byType),
      dailyTrend:     dailyTrend.map((r: any) => ({ date: r.date, count: Number(r.cnt) })),
      agentPerformance: agentPerf.map((r: any) => {
        const name = r.agentName || r.agentId;
        const city = (r.agentCity || 'india').toLowerCase().replace(/\s+/g, '-');
        const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-in-${city}-${r.agentUid}`;
        return {
          agentId:        r.agentId,
          agentName:      name,
          agentSlug:      slug,
          total:          Number(r.total),
          won:            Number(r.won),
          lost:           Number(r.lost),
          newCount:       Number(r.newCount),
          conversionRate: r.total > 0 ? Math.round((Number(r.won) / Number(r.total)) * 100) : 0,
        };
      }),
    };
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

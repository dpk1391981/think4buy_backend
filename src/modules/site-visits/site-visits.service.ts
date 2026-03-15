import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteVisit, SiteVisitStatus } from './entities/site-visit.entity';
import { CreateSiteVisitDto, UpdateSiteVisitDto, CompleteVisitDto } from './dto/site-visits.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class SiteVisitsService {
  constructor(
    @InjectRepository(SiteVisit)
    private visitRepo: Repository<SiteVisit>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateSiteVisitDto): Promise<SiteVisit> {
    const visit = this.visitRepo.create({ ...dto, status: SiteVisitStatus.SCHEDULED });
    const saved = await this.visitRepo.save(visit);
    if (saved.agentId) {
      this.notificationsService.createSilent({
        userId: saved.agentId,
        role: 'agent',
        title: 'Site Visit Scheduled',
        message: `A site visit has been scheduled for ${new Date(saved.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
        type: NotificationType.LEAD,
        entityType: 'site_visit',
        entityId: saved.id,
      });
    }
    return saved;
  }

  async findByAgent(agentId: string, page = 1, limit = 20, status?: string) {
    const qb = this.visitRepo
      .createQueryBuilder('v')
      .where('v.agentId = :agentId', { agentId })
      .orderBy('v.scheduledAt', 'ASC');
    if (status) qb.andWhere('v.status = :status', { status });
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByLead(leadId: string): Promise<SiteVisit[]> {
    return this.visitRepo.find({ where: { leadId }, order: { scheduledAt: 'DESC' } });
  }

  async findAll(page = 1, limit = 20, status?: string) {
    const qb = this.visitRepo.createQueryBuilder('v').orderBy('v.scheduledAt', 'ASC');
    if (status) qb.andWhere('v.status = :status', { status });
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<SiteVisit> {
    const visit = await this.visitRepo.findOne({ where: { id } });
    if (!visit) throw new NotFoundException('Site visit not found');
    return visit;
  }

  async update(id: string, dto: UpdateSiteVisitDto): Promise<SiteVisit> {
    const visit = await this.findOne(id);
    if (dto.scheduledAt && visit.status !== SiteVisitStatus.CANCELLED) {
      visit.rescheduleCount += 1;
      visit.status = SiteVisitStatus.RESCHEDULED;
    }
    Object.assign(visit, dto);
    return this.visitRepo.save(visit);
  }

  async complete(id: string, dto: CompleteVisitDto): Promise<SiteVisit> {
    const visit = await this.findOne(id);
    visit.status = SiteVisitStatus.COMPLETED;
    visit.completedAt = new Date();
    Object.assign(visit, dto);
    return this.visitRepo.save(visit);
  }

  async cancel(id: string, reason: string): Promise<SiteVisit> {
    const visit = await this.findOne(id);
    visit.status = SiteVisitStatus.CANCELLED;
    visit.cancelReason = reason;
    return this.visitRepo.save(visit);
  }

  async getTodayVisits(agentId: string): Promise<SiteVisit[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.visitRepo
      .createQueryBuilder('v')
      .where('v.agentId = :agentId', { agentId })
      .andWhere('v.scheduledAt >= :today', { today })
      .andWhere('v.scheduledAt < :tomorrow', { tomorrow })
      .andWhere('v.status NOT IN (:...cancelled)', { cancelled: [SiteVisitStatus.CANCELLED] })
      .orderBy('v.scheduledAt', 'ASC')
      .getMany();
  }
}

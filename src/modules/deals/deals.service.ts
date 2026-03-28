import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deal, DealStage } from './entities/deal.entity';
import { Commission, CommissionStatus } from '../commissions/entities/commission.entity';
import { User } from '../users/entities/user.entity';
import { AgencyService } from '../agency/agency.service';
import { CreateDealDto, UpdateDealStageDto, DealsQueryDto } from './dto/deals.dto';

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    @InjectRepository(Deal)
    private dealRepo: Repository<Deal>,
    @InjectRepository(Commission)
    private commissionRepo: Repository<Commission>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private readonly agencyService: AgencyService,
  ) {}

  async create(dto: CreateDealDto): Promise<Deal> {
    const deal = this.dealRepo.create({
      ...dto,
      stage: DealStage.SHORTLISTED,
      offerDate: new Date(),
    });
    return this.dealRepo.save(deal);
  }

  async findAll(query: DealsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const qb = this.dealRepo.createQueryBuilder('deal').orderBy('deal.createdAt', 'DESC');
    if (query.stage) qb.andWhere('deal.stage = :stage', { stage: query.stage });
    if (query.agentId) qb.andWhere('deal.agentId = :agentId', { agentId: query.agentId });
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByAgent(agentId: string, query: DealsQueryDto) {
    return this.findAll({ ...query, agentId });
  }

  async findOne(id: string): Promise<Deal> {
    const deal = await this.dealRepo.findOne({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async updateStage(id: string, dto: UpdateDealStageDto): Promise<Deal> {
    const deal = await this.findOne(id);
    const prevStage = deal.stage;
    Object.assign(deal, dto);

    if (dto.stage === DealStage.BOOKING_PAID && !deal.bookingDate) {
      deal.bookingDate = new Date();
    }
    if (dto.stage === DealStage.CLOSED && !deal.registrationDate) {
      deal.registrationDate = new Date();
    }
    if (dto.stage === DealStage.CANCELLED) {
      deal.cancellationDate = new Date();
    }

    const saved = await this.dealRepo.save(deal);
    this.logger.log(`Deal ${id} stage: ${prevStage} → ${dto.stage}`);

    // Auto-create commission record when deal is first closed (idempotent)
    if (dto.stage === DealStage.CLOSED && !deal.commissionCreated) {
      await this.createCommissionForDeal(saved);
    }

    // Recalculate agent response time when deal closes (non-blocking)
    if (dto.stage === DealStage.CLOSED && saved.agentId) {
      this.agencyService.recalculateResponseTime(saved.agentId).catch(() => {});
    }

    return saved;
  }

  private async createCommissionForDeal(deal: Deal): Promise<void> {
    const rate = deal.commissionRate ?? 2;
    const platformCutPct = 30;
    const agencyCutPct = deal.agencyId ? 40 : 0;

    const grossCommission = (Number(deal.agreedPrice) * rate) / 100;
    const platformAmount = (grossCommission * platformCutPct) / 100;
    const agencyAgentPool = grossCommission - platformAmount;
    const agencyAmount = (agencyAgentPool * agencyCutPct) / 100;
    const agentGross = agencyAgentPool - agencyAmount;
    const tdsRate = agentGross > 15000 ? 5 : 0;
    const tdsAmount = (agentGross * tdsRate) / 100;
    const agentNetPayout = agentGross - tdsAmount;

    const commission = this.commissionRepo.create({
      dealId: deal.id,
      agentId: deal.agentId,
      agencyId: deal.agencyId ?? null,
      dealPrice: Number(deal.agreedPrice),
      commissionRate: rate,
      grossCommission,
      platformCutPct,
      platformAmount,
      agencyCutPct,
      agencyAmount,
      agentGross,
      tdsRate,
      tdsAmount,
      agentNetPayout,
      status: CommissionStatus.PENDING,
    });

    await this.commissionRepo.save(commission);
    await this.dealRepo.update(deal.id, { commissionCreated: true });

    // Increment agent's totalDeals on users table (authoritative source for cards/rankings)
    await this.userRepo.increment({ id: deal.agentId }, 'totalDeals', 1);

    this.logger.log(
      `Commission auto-created for deal ${deal.id}: gross=₹${grossCommission.toFixed(2)}, agent_net=₹${agentNetPayout.toFixed(2)}`,
    );
  }

  /**
   * Nightly recalculation: refresh avgResponseHours for all agents who have responded inquiries.
   * Catches any drift from manual DB edits or missed real-time updates.
   */
  @Cron('5 0 * * *') // 00:05 daily (offset from deal-count cron)
  async recalculateAllAgentResponseTimes(): Promise<void> {
    const agents: { id: string }[] = await this.userRepo.query(
      `SELECT id FROM users WHERE role = 'agent'`,
    );
    let updated = 0;
    for (const agent of agents) {
      try {
        await this.agencyService.recalculateResponseTime(agent.id);
        updated++;
      } catch {
        // skip individual failures — next run will retry
      }
    }
    this.logger.log(`Response time recalculation complete (agents updated: ${updated})`);
  }

  /**
   * Nightly recalculation: sync users.totalDeals from actual closed deal count.
   * Catches any drift caused by manual DB edits, rollbacks, or missed increments.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async recalculateAgentDealCounts(): Promise<void> {
    const result = await this.userRepo.manager.query(`
      UPDATE users u
      SET u.totalDeals = (
        SELECT COUNT(*) FROM deals d
        WHERE d.agentId = u.id AND d.stage = 'closed'
      )
      WHERE u.role = 'agent'
    `);
    this.logger.log(`Deal count recalculation complete (rows affected: ${result?.affectedRows ?? 'unknown'})`);
  }

  async getStats(agentId?: string) {
    const db = this.dealRepo.manager.connection;
    const params: any[] = [];
    let where = '1=1';
    if (agentId) {
      where += ' AND agentId = ?';
      params.push(agentId);
    }
    const rows: any[] = await db.query(
      `SELECT stage, COUNT(*) as cnt FROM deals WHERE ${where} GROUP BY stage`,
      params,
    );
    const map: Record<string, number> = {};
    rows.forEach((r) => { map[r.stage] = Number(r.cnt); });
    const total = Object.values(map).reduce((a, b) => a + b, 0);

    const revenueParams = agentId ? [agentId] : [];
    const revenue: any[] = await db.query(
      `SELECT SUM(agreedPrice) as total FROM deals WHERE stage = 'closed'${agentId ? ' AND agentId = ?' : ''}`,
      revenueParams,
    );
    return { total, byStage: map, totalRevenue: Number(revenue[0]?.total || 0) };
  }
}

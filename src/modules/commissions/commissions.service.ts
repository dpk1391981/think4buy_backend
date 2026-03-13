import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commission, CommissionStatus } from './entities/commission.entity';
import {
  CreateCommissionDto,
  ApproveCommissionDto,
  MarkPaidDto,
  CommissionsQueryDto,
} from './dto/commissions.dto';

@Injectable()
export class CommissionsService {
  constructor(
    @InjectRepository(Commission)
    private commissionRepo: Repository<Commission>,
  ) {}

  private calculate(dto: CreateCommissionDto) {
    const rate = dto.commissionRate ?? 2;
    const platformCutPct = dto.platformCutPct ?? 30;
    const agencyCutPct = dto.agencyCutPct ?? 40;

    const grossCommission = (dto.dealPrice * rate) / 100;
    const platformAmount = (grossCommission * platformCutPct) / 100;
    const agencyAgentPool = grossCommission - platformAmount;
    const agencyAmount = (agencyAgentPool * agencyCutPct) / 100;
    const agentGross = agencyAgentPool - agencyAmount;
    const tdsRate = agentGross > 15000 ? 5 : 0;
    const tdsAmount = (agentGross * tdsRate) / 100;
    const agentNetPayout = agentGross - tdsAmount;

    return {
      grossCommission,
      platformAmount,
      agencyAmount,
      agentGross,
      tdsRate,
      tdsAmount,
      agentNetPayout,
      platformCutPct,
      agencyCutPct,
    };
  }

  async create(dto: CreateCommissionDto): Promise<Commission> {
    const calc = this.calculate(dto);
    const commission = this.commissionRepo.create({
      ...dto,
      ...calc,
      status: CommissionStatus.PENDING,
    });
    return this.commissionRepo.save(commission);
  }

  async findAll(query: CommissionsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const qb = this.commissionRepo.createQueryBuilder('c').orderBy('c.createdAt', 'DESC');
    if (query.status) qb.andWhere('c.status = :status', { status: query.status });
    if (query.agentId) qb.andWhere('c.agentId = :agentId', { agentId: query.agentId });
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByAgent(agentId: string, query: CommissionsQueryDto) {
    return this.findAll({ ...query, agentId });
  }

  async findOne(id: string): Promise<Commission> {
    const c = await this.commissionRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Commission not found');
    return c;
  }

  async approve(id: string, approvedByUserId: string, dto: ApproveCommissionDto): Promise<Commission> {
    const c = await this.findOne(id);
    c.approvedBy = approvedByUserId;
    c.approvedAt = new Date();
    if (dto.notes) c.notes = dto.notes;
    c.invoiceNumber = `INV-${Date.now()}`;
    c.invoiceDate = new Date();
    c.status = CommissionStatus.INVOICED;
    return this.commissionRepo.save(c);
  }

  async markPaid(id: string, dto: MarkPaidDto): Promise<Commission> {
    const c = await this.findOne(id);
    c.status = CommissionStatus.PAID;
    c.paymentReference = dto.paymentReference;
    c.paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    return this.commissionRepo.save(c);
  }

  async dispute(id: string, reason: string): Promise<Commission> {
    const c = await this.findOne(id);
    c.status = CommissionStatus.DISPUTED;
    c.clawbackReason = reason;
    return this.commissionRepo.save(c);
  }

  async getStats(agentId?: string) {
    const db = this.commissionRepo.manager.connection;
    const params: any[] = [];
    let where = '1=1';
    if (agentId) {
      where += ' AND agentId = ?';
      params.push(agentId);
    }

    const rows: any[] = await db.query(
      `SELECT status, COUNT(*) as cnt, SUM(agentNetPayout) as totalPayout
       FROM commissions WHERE ${where} GROUP BY status`,
      params,
    );
    const map: Record<string, { count: number; payout: number }> = {};
    rows.forEach((r) => {
      map[r.status] = { count: Number(r.cnt), payout: Number(r.totalPayout || 0) };
    });

    const totalEarned = map['paid']?.payout || 0;
    const totalPending =
      (map['pending']?.payout || 0) +
      (map['approved']?.payout || 0) +
      (map['invoiced']?.payout || 0);

    return { byStatus: map, totalEarned, totalPending };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deal, DealStage } from './entities/deal.entity';
import { CreateDealDto, UpdateDealStageDto, DealsQueryDto } from './dto/deals.dto';

@Injectable()
export class DealsService {
  constructor(
    @InjectRepository(Deal)
    private dealRepo: Repository<Deal>,
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
    return this.dealRepo.save(deal);
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

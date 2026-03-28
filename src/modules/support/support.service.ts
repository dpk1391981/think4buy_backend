import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import {
  IsString, IsNotEmpty, IsOptional, IsEmail, MaxLength,
  IsEnum, IsInt, Min, Max,
} from 'class-validator';
import { SupportTicket, SupportTicketType, SupportTicketStatus } from './entities/support-ticket.entity';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsEnum(SupportTicketType)
  type: SupportTicketType;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private ticketRepo: Repository<SupportTicket>,
  ) {}

  async create(dto: CreateSupportTicketDto, userId?: string): Promise<SupportTicket> {
    const ticket = this.ticketRepo.create({
      userId:   userId ?? null,
      name:     dto.name,
      email:    dto.email ?? null,
      phone:    dto.phone ?? null,
      type:     dto.type,
      category: dto.category ?? null,
      subject:  dto.subject ?? null,
      message:  dto.message,
      rating:   dto.rating ?? null,
      status:   SupportTicketStatus.OPEN,
    });
    return this.ticketRepo.save(ticket);
  }

  async findAll(page = 1, limit = 20, search?: string, status?: SupportTicketStatus, type?: SupportTicketType) {
    const where: FindOptionsWhere<SupportTicket>[] | FindOptionsWhere<SupportTicket> = {};

    if (status) (where as any).status = status;
    if (type)   (where as any).type   = type;

    const qb = this.ticketRepo.createQueryBuilder('t').orderBy('t.createdAt', 'DESC');

    if (status) qb.andWhere('t.status = :status', { status });
    if (type)   qb.andWhere('t.type = :type', { type });
    if (search) {
      qb.andWhere(
        '(t.name LIKE :q OR t.email LIKE :q OR t.subject LIKE :q OR t.message LIKE :q)',
        { q: `%${search}%` },
      );
    }

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async update(id: string, dto: UpdateSupportTicketDto): Promise<SupportTicket> {
    const ticket = await this.findOne(id);
    if (dto.status     !== undefined) ticket.status     = dto.status;
    if (dto.adminNotes !== undefined) ticket.adminNotes = dto.adminNotes;
    return this.ticketRepo.save(ticket);
  }

  async getStats() {
    const rows: any[] = await this.ticketRepo.query(
      `SELECT status, type, COUNT(*) as cnt FROM support_tickets GROUP BY status, type`,
    );

    const byStatus: Record<string, number> = {};
    const byType:   Record<string, number> = {};
    let total = 0;

    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + Number(r.cnt);
      byType[r.type]     = (byType[r.type]     || 0) + Number(r.cnt);
      total += Number(r.cnt);
    }

    // Average rating for feedback tickets
    const ratingRow: any[] = await this.ticketRepo.query(
      `SELECT ROUND(AVG(rating), 2) as avg FROM support_tickets WHERE type = 'feedback' AND rating IS NOT NULL`,
    );

    return {
      total,
      byStatus,
      byType,
      avgRating: ratingRow[0]?.avg ? Number(ratingRow[0].avg) : null,
    };
  }

  async findByUser(userId: string) {
    return this.ticketRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}

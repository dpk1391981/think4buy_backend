import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

export class AssignTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  assignedToId: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private ticketRepo: Repository<SupportTicket>,
    private dataSource: DataSource,
  ) {}

  // ── Ticket number generator: TKT-YYYYMMDD-NNNN ─────────────────────────────
  private async generateTicketNumber(): Promise<string> {
    const now   = new Date();
    const date  = now.toISOString().slice(0, 10).replace(/-/g, ''); // e.g. 20260330
    const count = await this.ticketRepo.count();
    const seq   = String(count + 1).padStart(4, '0');
    return `TKT-${date}-${seq}`;
  }

  async create(dto: CreateSupportTicketDto, userId?: string): Promise<SupportTicket> {
    const ticketNumber = await this.generateTicketNumber();
    const ticket = this.ticketRepo.create({
      userId:       userId ?? null,
      name:         dto.name,
      email:        dto.email ?? null,
      phone:        dto.phone ?? null,
      type:         dto.type,
      category:     dto.category ?? null,
      subject:      dto.subject ?? null,
      message:      dto.message,
      rating:       dto.rating ?? null,
      status:       SupportTicketStatus.OPEN,
      ticketNumber,
      showAsTestimonial: false,
      assignedToId:      null,
      assignedToName:    null,
      resolvedAt:        null,
    });
    return this.ticketRepo.save(ticket);
  }

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    status?: SupportTicketStatus,
    type?: SupportTicketType,
  ) {
    const qb = this.ticketRepo.createQueryBuilder('t').orderBy('t.createdAt', 'DESC');

    if (status) qb.andWhere('t.status = :status', { status });
    if (type)   qb.andWhere('t.type = :type', { type });
    if (search) {
      qb.andWhere(
        '(t.name LIKE :q OR t.email LIKE :q OR t.subject LIKE :q OR t.message LIKE :q OR t.ticketNumber LIKE :q)',
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
    if (dto.status !== undefined) {
      ticket.status = dto.status;
      if (
        dto.status === SupportTicketStatus.RESOLVED ||
        dto.status === SupportTicketStatus.CLOSED
      ) {
        ticket.resolvedAt = ticket.resolvedAt ?? new Date();
      } else {
        ticket.resolvedAt = null;
      }
    }
    if (dto.adminNotes !== undefined) ticket.adminNotes = dto.adminNotes;
    return this.ticketRepo.save(ticket);
  }

  // ── Toggle testimonial visibility ─────────────────────────────────────────
  async toggleTestimonial(id: string): Promise<SupportTicket> {
    const ticket = await this.findOne(id);
    if (ticket.type !== SupportTicketType.FEEDBACK) {
      throw new BadRequestException('Only feedback submissions can be shown as testimonials');
    }
    ticket.showAsTestimonial = !ticket.showAsTestimonial;
    return this.ticketRepo.save(ticket);
  }

  // ── Assign ticket to a staff member ──────────────────────────────────────
  async assignTicket(id: string, assignedToId: string): Promise<SupportTicket> {
    const ticket = await this.findOne(id);

    // Verify the assignee exists and is admin/staff
    const member: any[] = await this.dataSource.query(
      `SELECT id, name, email FROM users WHERE id = ? LIMIT 1`,
      [assignedToId],
    );
    if (!member.length) throw new NotFoundException('Member not found');

    const m = member[0];
    ticket.assignedToId   = assignedToId;
    ticket.assignedToName = m.name || m.email;

    // Auto-move to in_review if still open
    if (ticket.status === SupportTicketStatus.OPEN) {
      ticket.status = SupportTicketStatus.IN_REVIEW;
    }

    return this.ticketRepo.save(ticket);
  }

  // ── Unassign ticket ───────────────────────────────────────────────────────
  async unassignTicket(id: string): Promise<SupportTicket> {
    const ticket      = await this.findOne(id);
    ticket.assignedToId   = null;
    ticket.assignedToName = null;
    return this.ticketRepo.save(ticket);
  }

  // ── Get admin/staff members available for assignment ──────────────────────
  async getAdminMembers(): Promise<{ id: string; name: string; email: string; role: string }[]> {
    const rows: any[] = await this.dataSource.query(
      `SELECT id, name, email, role
       FROM users
       WHERE role IN ('admin','super_admin')
       ORDER BY name ASC`,
    );
    return rows.map((r) => ({
      id:    r.id,
      name:  r.name || r.email,
      email: r.email,
      role:  r.role,
    }));
  }

  // ── Assign ticket helper: look up member ─────────────────────────────────
  private async lookupMember(assignedToId: string): Promise<any[]> {
    return this.dataSource.query(
      `SELECT id, name, email FROM users WHERE id = ? LIMIT 1`,
      [assignedToId],
    );
  }

  // ── Public: approved testimonials for the homepage ───────────────────────
  // Joins with users table so the frontend can show profile photo, name, city.
  async getPublicTestimonials(limit = 20): Promise<any[]> {
    const rows: any[] = await this.dataSource.query(
      `SELECT
         st.id,
         st.userId,
         st.name,
         st.email,
         st.phone,
         st.category,
         st.subject,
         st.message,
         st.rating,
         st.createdAt,
         u.avatar    AS userAvatar,
         u.name      AS userName,
         u.city      AS userCity,
         u.state     AS userState,
         u.role      AS userRole
       FROM support_tickets st
       LEFT JOIN users u ON u.id = st.userId
       WHERE st.type = 'feedback'
         AND st.showAsTestimonial = 1
       ORDER BY st.createdAt DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({
      id:        r.id,
      name:      r.userName || r.name,      // prefer system name over submitted name
      email:     r.email,
      category:  r.category,
      subject:   r.subject,
      message:   r.message,
      rating:    r.rating ? Number(r.rating) : null,
      createdAt: r.createdAt,
      userAvatar: r.userAvatar ?? null,
      city:      r.userCity  || null,
      state:     r.userState || null,
      role:      r.userRole  || null,
    }));
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

    const ratingRow: any[] = await this.ticketRepo.query(
      `SELECT ROUND(AVG(rating), 2) as avg FROM support_tickets WHERE type = 'feedback' AND rating IS NOT NULL`,
    );

    const testimonialCount = await this.ticketRepo.count({
      where: { type: SupportTicketType.FEEDBACK, showAsTestimonial: true },
    });

    return {
      total,
      byStatus,
      byType,
      avgRating: ratingRow[0]?.avg ? Number(ratingRow[0].avg) : null,
      testimonialCount,
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

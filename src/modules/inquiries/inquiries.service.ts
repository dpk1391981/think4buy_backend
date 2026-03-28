import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsString, IsNotEmpty, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { Inquiry, InquiryStatus } from './entities/inquiry.entity';
import { Property } from '../properties/entities/property.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { AgentProfile } from '../agency/entities/agent-profile.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

export class CreateInquiryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  phone: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

@Injectable()
export class InquiriesService {
  constructor(
    @InjectRepository(Inquiry)
    private inquiryRepo: Repository<Inquiry>,
    @InjectRepository(Property)
    private propertyRepo: Repository<Property>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(AgentProfile)
    private agentProfileRepo: Repository<AgentProfile>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(propertyId: string, dto: CreateInquiryDto, userId?: string) {
    const property = await this.propertyRepo.findOne({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');

    const inquiry = this.inquiryRepo.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      message: dto.message,
      type: (dto.type as any) ?? 'general',
      propertyId,
      userId,
    } as any);
    const saved = await this.inquiryRepo.save(inquiry);
    // Notify property owner
    if (property.ownerId) {
      this.notificationsService.createSilent({
        userId: property.ownerId,
        title: 'New Inquiry Received',
        message: `${dto.name} sent an inquiry about your property.`,
        type: NotificationType.LEAD,
        entityType: 'property',
        entityId: propertyId,
      });
    }
    return saved;
  }

  async contactAgent(agentId: string, dto: CreateInquiryDto, userId?: string) {
    const agent = await this.userRepo.findOne({ where: { id: agentId, role: UserRole.AGENT } });
    if (!agent) throw new NotFoundException('Agent not found');

    const inquiry = this.inquiryRepo.create({
      name:    dto.name,
      email:   dto.email ?? '',
      phone:   dto.phone ?? '',
      message: dto.message,
      type:    (dto.type as any) ?? 'general',
      agentId,
      userId,
    } as any);
    const saved = await this.inquiryRepo.save(inquiry) as any;
    // Notify the agent
    this.notificationsService.createSilent({
      userId: agentId,
      role: 'agent',
      title: 'New Inquiry Received',
      message: `${dto.name} sent you a direct inquiry.`,
      type: NotificationType.LEAD,
      entityType: 'inquiry',
      entityId: saved.id,
    });
    return saved;
  }

  async findByAgent(agentId: string) {
    return this.inquiryRepo.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProperty(propertyId: string) {
    return this.inquiryRepo.find({
      where: { propertyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByBuyer(userId: string) {
    return this.inquiryRepo.find({
      where: { userId },
      relations: ['property'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByOwner(ownerId: string) {
    return this.inquiryRepo
      .createQueryBuilder('inquiry')
      .innerJoin('inquiry.property', 'property')
      .where('property.ownerId = :ownerId', { ownerId })
      .leftJoinAndSelect('inquiry.property', 'prop')
      .orderBy('inquiry.createdAt', 'DESC')
      .getMany();
  }

  async findByOwnerPaginated(ownerId: string, page = 1, limit = 20) {
    const qb = this.inquiryRepo
      .createQueryBuilder('inquiry')
      .innerJoin('inquiry.property', 'property')
      .where('property.ownerId = :ownerId', { ownerId })
      .leftJoinAndSelect('inquiry.property', 'prop')
      .orderBy('inquiry.createdAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((+page - 1) * +limit)
      .take(+limit)
      .getMany();

    return {
      data: items,
      meta: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / +limit),
      },
    };
  }

  /**
   * Mark an inquiry as responded.
   * Records respondedAt timestamp (only on first response) and
   * recalculates the agent's average response time.
   * Only the property owner / agent for that inquiry may call this.
   */
  async markResponded(inquiryId: string, responderId: string): Promise<Inquiry> {
    const inquiry = await this.inquiryRepo.findOne({
      where: { id: inquiryId },
      relations: ['property'],
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found');

    // Authorisation: responder must be the property owner or the direct agent
    const ownerMatch = inquiry.property?.ownerId === responderId;
    const agentMatch = inquiry.agentId === responderId;
    if (!ownerMatch && !agentMatch) {
      throw new ForbiddenException('Not authorised to respond to this inquiry');
    }

    // Only stamp respondedAt once (preserve first-response time)
    if (!inquiry.respondedAt) {
      inquiry.respondedAt = new Date();
    }
    inquiry.status = InquiryStatus.RESPONDED;
    const saved = await this.inquiryRepo.save(inquiry);

    // Recalculate avgResponseHours in the background (non-blocking)
    this.recalcResponseTime(responderId).catch(() => {});

    return saved;
  }

  /** Recalculate avgResponseHours from all responded inquiries for this agent */
  private async recalcResponseTime(agentUserId: string): Promise<void> {
    const db = this.agentProfileRepo.manager.connection;
    const rows: any[] = await db.query(
      `SELECT ROUND(AVG(TIMESTAMPDIFF(SECOND, i.createdAt, i.respondedAt)) / 3600.0, 1) AS avgHours
       FROM inquiries i
       LEFT JOIN properties p ON p.id = i.property_id
       WHERE i.respondedAt IS NOT NULL
         AND (i.agent_id = ? OR p.ownerId = ?)`,
      [agentUserId, agentUserId],
    );
    const avgHours: number | null =
      rows[0]?.avgHours != null ? Number(rows[0].avgHours) : null;

    const profile = await this.agentProfileRepo.findOne({ where: { userId: agentUserId } });
    if (profile) {
      await this.agentProfileRepo.update(profile.id, { avgResponseHours: avgHours });
    }
  }
}

import {
  Injectable, BadRequestException, ConflictException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentFeedback } from './entities/agent-feedback.entity';
import { User } from '../users/entities/user.entity';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';

@Injectable()
export class AgentFeedbackService {
  constructor(
    @InjectRepository(AgentFeedback)
    private feedbackRepo: Repository<AgentFeedback>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(AnalyticsEvent)
    private analyticsRepo: Repository<AnalyticsEvent>,
  ) {}

  // ── Submit a review ─────────────────────────────────────────────────────────

  async submit(
    agentId: string,
    reviewerId: string,
    dto: { rating: number; comment?: string },
  ) {
    // 1. Cannot review yourself
    if (agentId === reviewerId) {
      throw new BadRequestException('You cannot review your own profile.');
    }

    // 2. Agent must exist
    const agent = await this.userRepo.findOne({ where: { id: agentId }, select: ['id', 'name', 'agentRating', 'city', 'state'] });
    if (!agent) throw new NotFoundException('Agent not found.');

    // 3. Reviewer must exist
    const reviewer = await this.userRepo.findOne({ where: { id: reviewerId }, select: ['id', 'name'] });
    if (!reviewer) throw new NotFoundException('Reviewer not found.');

    // 4. Validate rating
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5.');
    }

    // 5. Check duplicate (unique constraint also guards this)
    const existing = await this.feedbackRepo.findOne({ where: { agentId, reviewerId } });
    if (existing) {
      throw new ConflictException('You have already submitted a review for this agent.');
    }

    // 6. Save review
    const feedback = this.feedbackRepo.create({
      agentId,
      reviewerId,
      reviewerName: reviewer.name,
      rating:       dto.rating,
      comment:      dto.comment?.trim() || null,
    });
    await this.feedbackRepo.save(feedback);

    // 7. Recalculate agent's average rating
    const { avg } = await this.feedbackRepo
      .createQueryBuilder('f')
      .select('AVG(f.rating)', 'avg')
      .where('f.agentId = :agentId', { agentId })
      .getRawOne();
    await this.userRepo.update(agentId, { agentRating: Number(Number(avg).toFixed(2)) });

    // 8. Track analytics event (fire-and-forget)
    this.analyticsRepo.save(
      this.analyticsRepo.create({
        eventType:  'agent_feedback',
        entityType: 'agent',
        entityId:   agentId,
        userId:     reviewerId,
        city:       agent.city,
        state:      agent.state,
        source:     'direct',
        metadata:   { rating: dto.rating, hasComment: !!dto.comment },
      }),
    ).catch(() => {});

    return { message: 'Review submitted successfully.', id: feedback.id };
  }

  // ── List reviews for an agent ────────────────────────────────────────────────

  async list(agentId: string, page = 1, limit = 10) {
    const [items, total] = await this.feedbackRepo.findAndCount({
      where:  { agentId },
      order:  { createdAt: 'DESC' },
      skip:   (page - 1) * limit,
      take:   limit,
    });

    const { avg } = await this.feedbackRepo
      .createQueryBuilder('f')
      .select('AVG(f.rating)', 'avg')
      .where('f.agentId = :agentId', { agentId })
      .getRawOne();

    const distribution = await this.feedbackRepo
      .createQueryBuilder('f')
      .select('f.rating', 'star')
      .addSelect('COUNT(*)', 'count')
      .where('f.agentId = :agentId', { agentId })
      .groupBy('f.rating')
      .getRawMany();

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      averageRating: avg ? Number(Number(avg).toFixed(1)) : null,
      distribution,
    };
  }

  // ── Check if reviewer already submitted ─────────────────────────────────────

  async hasReviewed(agentId: string, reviewerId: string): Promise<boolean> {
    const count = await this.feedbackRepo.count({ where: { agentId, reviewerId } });
    return count > 0;
  }
}

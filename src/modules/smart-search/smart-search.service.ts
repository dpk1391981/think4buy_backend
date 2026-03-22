import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchLog } from './entities/search-log.entity';
import {
  UserBehavior,
  BehaviorEventType,
  BEHAVIOR_SCORES,
  HOT_LEAD_THRESHOLD,
} from './entities/user-behavior.entity';
import { Lead, LeadSource, LeadStatus, LeadTemperature } from '../leads/entities/lead.entity';

export class LogSearchDto {
  userId?: string;
  searchQuery: string;
  parsedFilters?: Record<string, any>;
  latitude?: number;
  longitude?: number;
  resultCount?: number;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class TrackBehaviorDto {
  userId?: string;
  propertyId: string;
  eventType: BehaviorEventType;
  duration?: number;
  sessionId?: string;
  ipAddress?: string;
  /** Optional contact info for auto lead creation on CONTACT/INQUIRY events */
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

@Injectable()
export class SmartSearchService {
  private readonly logger = new Logger(SmartSearchService.name);

  constructor(
    @InjectRepository(SearchLog)
    private searchLogRepo: Repository<SearchLog>,
    @InjectRepository(UserBehavior)
    private behaviorRepo: Repository<UserBehavior>,
    @InjectRepository(Lead)
    private leadRepo: Repository<Lead>,
  ) {}

  // ─── Log a search ────────────────────────────────────────────────────────────

  async logSearch(dto: LogSearchDto): Promise<void> {
    try {
      await this.searchLogRepo.save(this.searchLogRepo.create(dto));
    } catch (err) {
      this.logger.warn(`Failed to log search: ${err.message}`);
    }
  }

  // ─── Track user behavior event ───────────────────────────────────────────────

  async trackBehavior(dto: TrackBehaviorDto): Promise<{ cumulativeScore: number; isHotLead: boolean }> {
    const score = BEHAVIOR_SCORES[dto.eventType] ?? 0;

    // Compute cumulative score for this identity × property
    const identity = dto.userId ?? dto.sessionId ?? dto.ipAddress ?? 'unknown';
    const prevEvents = await this.behaviorRepo
      .createQueryBuilder('ub')
      .select('SUM(ub.score)', 'total')
      .where(dto.userId
        ? 'ub.userId = :id AND ub.propertyId = :pid'
        : 'ub.sessionId = :id AND ub.propertyId = :pid',
        { id: dto.userId ?? dto.sessionId, pid: dto.propertyId })
      .getRawOne();

    const prevScore = Number(prevEvents?.total ?? 0);
    const cumulativeScore = prevScore + score;

    await this.behaviorRepo.save(
      this.behaviorRepo.create({
        userId: dto.userId,
        propertyId: dto.propertyId,
        eventType: dto.eventType,
        duration: dto.duration,
        score,
        cumulativeScore,
        sessionId: dto.sessionId,
        ipAddress: dto.ipAddress,
      }),
    );

    const isHotLead = cumulativeScore >= HOT_LEAD_THRESHOLD;

    // Auto-create / upgrade lead when threshold crossed for the first time
    if (isHotLead && score > 0) {
      await this.upsertBehaviorLead(dto, cumulativeScore);
    }

    return { cumulativeScore, isHotLead };
  }

  // ─── Auto lead upsert from behavior ─────────────────────────────────────────

  private async upsertBehaviorLead(dto: TrackBehaviorDto, score: number): Promise<void> {
    try {
      const temperature = score >= HOT_LEAD_THRESHOLD ? LeadTemperature.HOT
        : score >= 5 ? LeadTemperature.WARM
        : LeadTemperature.COLD;

      // Check if lead already exists for this user × property
      const existing = dto.userId
        ? await this.leadRepo.findOne({ where: { contactUserId: dto.userId, propertyId: dto.propertyId } })
        : null;

      if (existing) {
        // Upgrade temperature if it improved
        const tempOrder = { [LeadTemperature.COLD]: 0, [LeadTemperature.WARM]: 1, [LeadTemperature.HOT]: 2 };
        if (tempOrder[temperature] > tempOrder[existing.temperature]) {
          existing.temperature = temperature;
          existing.leadScore = score;
          await this.leadRepo.save(existing);
        }
        return;
      }

      // Only auto-create lead with contact info OR for HOT leads based on behavior
      const source = dto.eventType === BehaviorEventType.CONTACT
        ? LeadSource.CALL
        : dto.eventType === BehaviorEventType.INQUIRY
          ? LeadSource.ENQUIRY
          : LeadSource.PROPERTY_PAGE;

      if (dto.contactPhone || temperature === LeadTemperature.HOT) {
        await this.leadRepo.save(
          this.leadRepo.create({
            propertyId: dto.propertyId,
            contactUserId: dto.userId,
            contactName: dto.contactName ?? 'Visitor',
            contactPhone: dto.contactPhone ?? '',
            contactEmail: dto.contactEmail,
            source,
            temperature,
            leadScore: score,
            status: LeadStatus.NEW,
            sessionId: dto.sessionId,
          }),
        );
      }
    } catch (err) {
      this.logger.warn(`Auto-lead upsert failed: ${err.message}`);
    }
  }

  // ─── Trending searches ────────────────────────────────────────────────────────

  async getTrendingSearches(limit = 8): Promise<{ query: string; count: number }[]> {
    const rows = await this.searchLogRepo
      .createQueryBuilder('sl')
      .select('sl.searchQuery', 'query')
      .addSelect('COUNT(*)', 'cnt')
      .where('sl.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
      .andWhere('LENGTH(sl.searchQuery) > 2')
      .groupBy('sl.searchQuery')
      .orderBy('cnt', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map(r => ({ query: r.query, count: Number(r.cnt) }));
  }

  // ─── User search history ─────────────────────────────────────────────────────

  async getUserSearchHistory(userId: string, limit = 5): Promise<SearchLog[]> {
    return this.searchLogRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

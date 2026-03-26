import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CookieConsent, ConsentSource } from './entities/cookie-consent.entity';
import { SaveConsentDto } from './dto/save-consent.dto';

const CURRENT_POLICY_VERSION = '1.0';

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(CookieConsent)
    private readonly repo: Repository<CookieConsent>,
  ) {}

  /**
   * Upsert consent for a user or anonymous session.
   * - Logged-in user  → match on userId (one row per user)
   * - Anonymous guest → match on sessionId
   * Fires and forgets — caller uses void return.
   */
  async save(
    dto: SaveConsentDto,
    ipAddress: string | null,
    userAgent: string | null,
    userId?: string,
  ): Promise<CookieConsent> {
    let existing: CookieConsent | null = null;

    if (userId) {
      existing = await this.repo.findOne({ where: { userId } });
    } else if (dto.sessionId) {
      existing = await this.repo.findOne({ where: { sessionId: dto.sessionId } });
    }

    const record = existing ?? this.repo.create();

    record.userId         = userId ?? record.userId ?? null;
    record.sessionId      = dto.sessionId ?? record.sessionId ?? null;
    record.ipAddress      = ipAddress;
    record.userAgent      = userAgent;
    record.essential      = true;
    record.personalization = dto.personalization;
    record.analytics      = dto.analytics;
    record.marketing      = dto.marketing;
    record.source         = dto.source ?? ConsentSource.BANNER;
    record.consentVersion = dto.consentVersion ?? CURRENT_POLICY_VERSION;

    return this.repo.save(record);
  }

  /**
   * Fetch the latest consent for a user or session.
   * Returns null if no consent record found — frontend shows the banner.
   */
  async findOne(userId?: string, sessionId?: string): Promise<CookieConsent | null> {
    if (userId) {
      return this.repo.findOne({ where: { userId } });
    }
    if (sessionId) {
      return this.repo.findOne({ where: { sessionId } });
    }
    return null;
  }

  /**
   * Admin: aggregated consent stats for the dashboard.
   * Returns counts and percentages for each consent category.
   */
  async getStats(): Promise<{
    total: number;
    acceptedAll: number;
    rejectedAll: number;
    analytics: { accepted: number; pct: number };
    personalization: { accepted: number; pct: number };
    marketing: { accepted: number; pct: number };
  }> {
    const total = await this.repo.count();
    if (total === 0) {
      return {
        total: 0,
        acceptedAll: 0,
        rejectedAll: 0,
        analytics:      { accepted: 0, pct: 0 },
        personalization:{ accepted: 0, pct: 0 },
        marketing:      { accepted: 0, pct: 0 },
      };
    }

    const [analyticsCount, personalizationCount, marketingCount] = await Promise.all([
      this.repo.countBy({ analytics: true }),
      this.repo.countBy({ personalization: true }),
      this.repo.countBy({ marketing: true }),
    ]);

    // "Accepted all" = all three optional categories on
    const acceptedAll = await this.repo.count({
      where: { analytics: true, personalization: true, marketing: true },
    });
    // "Rejected all" = all three optional categories off
    const rejectedAll = await this.repo.count({
      where: { analytics: false, personalization: false, marketing: false },
    });

    const pct = (n: number) => Math.round((n / total) * 100);

    return {
      total,
      acceptedAll,
      rejectedAll,
      analytics:       { accepted: analyticsCount,       pct: pct(analyticsCount)       },
      personalization: { accepted: personalizationCount, pct: pct(personalizationCount) },
      marketing:       { accepted: marketingCount,       pct: pct(marketingCount)       },
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsService } from './analytics.service';

/**
 * Background cron jobs that refresh all cache tables periodically.
 *
 * Schedule overview:
 *  - Category analytics  : every hour
 *  - Location cache      : every 2 hours
 *  - Properties cache    : every 30 minutes
 *  - Agents cache        : every 2 hours
 *  - Projects cache      : every hour
 *  - Old event cleanup   : daily at 3 AM
 */
@Injectable()
export class AnalyticsCronService {
  private readonly logger = new Logger(AnalyticsCronService.name);
  private isRunning = false;

  constructor(private readonly analyticsService: AnalyticsService) {}

  // ── Category analytics: every hour ──────────────────────────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async refreshCategories() {
    if (this.isRunning) return;
    try {
      await this.analyticsService.aggregateCategories();
    } catch (err) {
      this.logger.error('Category aggregation failed', err?.message);
    }
  }

  // ── Location cache: every 2 hours ───────────────────────────────────────────
  @Cron('0 */2 * * *')
  async refreshLocations() {
    try {
      await this.analyticsService.aggregateLocations();
    } catch (err) {
      this.logger.error('Location aggregation failed', err?.message);
    }
  }

  // ── Properties cache: every 30 minutes ───────────────────────────────────────
  @Cron('*/30 * * * *')
  async refreshProperties() {
    try {
      await this.analyticsService.aggregateProperties();
    } catch (err) {
      this.logger.error('Properties aggregation failed', err?.message);
    }
  }

  // ── Agents cache: every 2 hours ──────────────────────────────────────────────
  @Cron('0 */2 * * *')
  async refreshAgents() {
    try {
      await this.analyticsService.aggregateAgents();
    } catch (err) {
      this.logger.error('Agents aggregation failed', err?.message);
    }
  }

  // ── Projects cache: every hour ───────────────────────────────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async refreshProjects() {
    try {
      await this.analyticsService.aggregateProjects();
    } catch (err) {
      this.logger.error('Projects aggregation failed', err?.message);
    }
  }

  // ── Full refresh on startup (30s delay) ──────────────────────────────────────
  @Cron('*/30 * * * * *')   // fires at :30 seconds — used as one-shot startup delay
  async initialSeed() {
    // Only run once by checking if analytics tables are empty
    // We unregister after first run by toggling a flag
    if (this._seeded) return;
    this._seeded = true;
    this.logger.log('Running initial analytics seed on startup…');
    try {
      this.isRunning = true;
      await Promise.all([
        this.analyticsService.aggregateCategories(),
        this.analyticsService.aggregateLocations(),
      ]);
      await Promise.all([
        this.analyticsService.aggregateProperties(),
        this.analyticsService.aggregateAgents(),
        this.analyticsService.aggregateProjects(),
      ]);
    } catch (err) {
      this.logger.error('Initial seed failed', err?.message);
    } finally {
      this.isRunning = false;
    }
  }
  private _seeded = false;

  // ── Purge raw events older than 90 days (daily at 3 AM) ──────────────────────
  @Cron('0 3 * * *')
  async purgeOldEvents() {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    this.logger.log(`Purging analytics events older than ${cutoff.toISOString()}`);
    try {
      await this.analyticsService['eventRepo'].query(
        'DELETE FROM analytics_events WHERE createdAt < ?',
        [cutoff],
      );
    } catch (err) {
      this.logger.error('Event purge failed', err?.message);
    }
  }
}

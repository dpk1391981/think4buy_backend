import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { TopPropertiesCache } from './entities/top-properties-cache.entity';
import { TopAgentsCache } from './entities/top-agents-cache.entity';
import { TopProjectsCache } from './entities/top-projects-cache.entity';
import { TopLocationsCache } from './entities/top-locations-cache.entity';
import { CategoryAnalytics } from './entities/category-analytics.entity';
import { MarketSnapshot } from './entities/market-snapshot.entity';
import { LocalityCircleRate } from './entities/locality-circle-rate.entity';
import { ScoringConfig } from './entities/scoring-config.entity';
import { PropType } from '../property-config/entities/prop-type.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCronService } from './analytics-cron.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      AnalyticsEvent,
      TopPropertiesCache,
      TopAgentsCache,
      TopProjectsCache,
      TopLocationsCache,
      CategoryAnalytics,
      MarketSnapshot,
      LocalityCircleRate,
      ScoringConfig,
      PropType,
    ]),
  ],
  providers: [AnalyticsService, AnalyticsCronService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

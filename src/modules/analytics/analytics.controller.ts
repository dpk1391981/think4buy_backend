import {
  Controller, Get, Post, Body, Query,
  HttpCode, HttpStatus, Ip, Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { AnalyticsService } from './analytics.service';

// ─── Track Event DTO ─────────────────────────────────────────────────────────
class TrackEventDto {
  @IsString()
  eventType: string;

  @IsOptional() @IsString()
  entityType?: string;

  @IsOptional() @IsString()
  entityId?: string;

  @IsOptional() @IsString()
  sessionId?: string;

  @IsOptional() @IsString()
  country?: string;

  @IsOptional() @IsString()
  state?: string;

  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsString()
  deviceType?: string;

  @IsOptional() @IsString()
  source?: string;

  @IsOptional() @IsObject()
  metadata?: Record<string, any>;
}

@ApiTags('Analytics & Home')
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ─── POST /api/analytics/track ──────────────────────────────────────────────
  @Post('analytics/track')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track a user analytics event (fire-and-forget)' })
  async track(
    @Body() dto: TrackEventDto,
    @Headers('x-user-id') userId?: string,
    @Headers('x-device-type') device?: string,
  ) {
    // Fire and forget — do not await
    this.analyticsService.trackEvent({
      ...dto,
      userId:     userId || dto['userId'],
      deviceType: device  || dto.deviceType || 'desktop',
    });
    // Always return 204
  }

  // ─── GET /api/home/top-categories ───────────────────────────────────────────
  @Get('home/top-categories')
  @ApiOperation({ summary: 'Top property categories (analytics-powered)' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'state',   required: false })
  @ApiQuery({ name: 'city',    required: false })
  @ApiQuery({ name: 'limit',   required: false })
  async getTopCategories(
    @Query('country') country?: string,
    @Query('state')   state?:   string,
    @Query('city')    city?:    string,
    @Query('limit')   limit?:   string,
  ) {
    const data = await this.analyticsService.getTopCategories({
      country, state, city, limit: limit ? parseInt(limit) : 12,
    });
    return { success: true, data };
  }

  // ─── GET /api/home/top-states ────────────────────────────────────────────────
  @Get('home/top-states')
  @ApiOperation({ summary: 'Top states ranked by analytics score' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'limit',   required: false })
  async getTopStates(
    @Query('country') country?: string,
    @Query('limit')   limit?:   string,
  ) {
    const data = await this.analyticsService.getTopStates(country, limit ? parseInt(limit) : 12);
    return { success: true, data };
  }

  // ─── GET /api/home/top-cities ────────────────────────────────────────────────
  @Get('home/top-cities')
  @ApiOperation({ summary: 'Top cities ranked by analytics score' })
  @ApiQuery({ name: 'state',   required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'limit',   required: false })
  async getTopCities(
    @Query('state')   state?:   string,
    @Query('country') country?: string,
    @Query('limit')   limit?:   string,
  ) {
    const data = await this.analyticsService.getTopCities(state, country, limit ? parseInt(limit) : 12);
    return { success: true, data };
  }

  // ─── GET /api/home/top-properties ────────────────────────────────────────────
  @Get('home/top-properties')
  @ApiOperation({ summary: 'Top properties by tab and location' })
  @ApiQuery({ name: 'tab',     required: false, description: 'featured|premium|most_viewed|just_listed|new_projects' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'state',   required: false })
  @ApiQuery({ name: 'city',    required: false })
  @ApiQuery({ name: 'limit',   required: false })
  @ApiQuery({ name: 'period',  required: false, description: '24h|7d|30d' })
  async getTopProperties(
    @Query('tab')     tab?:     string,
    @Query('country') country?: string,
    @Query('state')   state?:   string,
    @Query('city')    city?:    string,
    @Query('limit')   limit?:   string,
    @Query('period')  period?:  string,
  ) {
    const data = await this.analyticsService.getTopProperties({
      tab, country, state, city, period,
      limit: limit ? parseInt(limit) : 8,
    });
    return { success: true, data };
  }

  // ─── GET /api/home/top-agents ────────────────────────────────────────────────
  @Get('home/top-agents')
  @ApiOperation({ summary: 'Top agents ranked by analytics score' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'state',   required: false })
  @ApiQuery({ name: 'city',    required: false })
  @ApiQuery({ name: 'limit',   required: false })
  async getTopAgents(
    @Query('country') country?: string,
    @Query('state')   state?:   string,
    @Query('city')    city?:    string,
    @Query('limit')   limit?:   string,
  ) {
    const data = await this.analyticsService.getTopAgents({
      country, state, city, limit: limit ? parseInt(limit) : 8,
    });
    return { success: true, data };
  }

  // ─── GET /api/home/top-projects ──────────────────────────────────────────────
  @Get('home/top-projects')
  @ApiOperation({ summary: 'Top new launch projects' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'state',   required: false })
  @ApiQuery({ name: 'city',    required: false })
  @ApiQuery({ name: 'limit',   required: false })
  async getTopProjects(
    @Query('country') country?: string,
    @Query('state')   state?:   string,
    @Query('city')    city?:    string,
    @Query('limit')   limit?:   string,
  ) {
    const data = await this.analyticsService.getTopProjects({
      country, state, city, limit: limit ? parseInt(limit) : 8,
    });
    return { success: true, data };
  }

  // ─── GET /api/analytics/admin/summary ────────────────────────────────────────
  @Get('analytics/admin/summary')
  @ApiOperation({ summary: 'Admin analytics dashboard summary' })
  async getAdminSummary(@Query('days') days?: string) {
    const d = days ? parseInt(days) : 7;
    const since = new Date(Date.now() - d * 24 * 60 * 60 * 1000);

    const [totalEvents, eventBreakdown, topCities, topTypes] = await Promise.all([
      this.analyticsService['eventRepo'].count({ where: { createdAt: require('typeorm').MoreThan(since) } }),

      this.analyticsService['eventRepo']
        .createQueryBuilder('ae')
        .select('ae.eventType', 'eventType')
        .addSelect('COUNT(*)', 'count')
        .where('ae.createdAt > :since', { since })
        .groupBy('ae.eventType')
        .orderBy('count', 'DESC')
        .getRawMany(),

      this.analyticsService['eventRepo']
        .createQueryBuilder('ae')
        .select('ae.city', 'city')
        .addSelect('COUNT(*)', 'count')
        .where('ae.createdAt > :since', { since })
        .andWhere("ae.city IS NOT NULL AND ae.city != ''")
        .groupBy('ae.city')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),

      this.analyticsService['catRepo']
        .createQueryBuilder('c')
        .where("(c.state IS NULL OR c.state = '') AND (c.city IS NULL OR c.city = '')")
        .orderBy('c.rank', 'ASC')
        .limit(8)
        .getMany(),
    ]);

    return {
      success: true,
      data: {
        period: `${d}d`,
        totalEvents,
        eventBreakdown,
        topCities,
        topCategories: topTypes,
      },
    };
  }
}

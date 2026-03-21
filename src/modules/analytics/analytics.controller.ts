import {
  Controller, Get, Post, Patch, Delete, Body, Query, Param,
  HttpCode, HttpStatus, Headers, UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsBoolean, IsNumber } from 'class-validator';
import { AnalyticsService } from './analytics.service';

// ─── Admin DTOs ───────────────────────────────────────────────────────────────
class UpdateSnapshotDto {
  @IsOptional() @IsBoolean()
  isFeatured?: boolean;

  @IsOptional() @IsNumber()
  sortOrder?: number;
}

class SetScoringConfigDto {
  @IsNumber()
  value: number;

  @IsOptional() @IsString()
  description?: string;
}

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

  // ─── GET /api/home/trending ───────────────────────────────────────────────────
  @Get('home/trending')
  @ApiOperation({ summary: 'Trending properties scored by views + 7d inquiries + recency' })
  @ApiQuery({ name: 'city',     required: false })
  @ApiQuery({ name: 'state',    required: false })
  @ApiQuery({ name: 'category', required: false, description: 'buy|rent|pg|commercial|all' })
  @ApiQuery({ name: 'limit',    required: false })
  async getTrending(
    @Query('city')     city?:     string,
    @Query('state')    state?:    string,
    @Query('category') category?: string,
    @Query('limit')    limit?:    string,
  ) {
    const data = await this.analyticsService.getTrendingProperties({
      city, state, category,
      limit: limit ? parseInt(limit) : 8,
    });
    return { success: true, data };
  }

  // ─── GET /api/home/compare ────────────────────────────────────────────────────
  @Get('home/compare')
  @ApiOperation({ summary: 'Fetch full comparison data for up to 3 property IDs' })
  @ApiQuery({ name: 'ids', required: true, description: 'Comma-separated property UUIDs (max 3)' })
  async compareProperties(@Query('ids') ids: string) {
    const idList = (ids || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const data = await this.analyticsService.getCompareProperties(idList);
    return { success: true, data };
  }

  // ─── GET /api/home/price-snapshot ─────────────────────────────────────────────
  @Get('home/price-snapshot')
  @ApiOperation({ summary: 'Real price-per-sqft stats, locality breakdown, and buy-vs-rent from DB' })
  @ApiQuery({ name: 'city',  required: false })
  @ApiQuery({ name: 'state', required: false })
  async getPriceSnapshot(
    @Query('city')  city?:  string,
    @Query('state') state?: string,
  ) {
    const data = await this.analyticsService.getPriceSnapshot(city, state);
    return { success: true, data };
  }

  // ─── GET /api/home/insights ───────────────────────────────────────────────────
  @Get('home/insights')
  @ApiOperation({ summary: 'Dynamic market insights derived from real property & inquiry data' })
  @ApiQuery({ name: 'city',  required: false })
  @ApiQuery({ name: 'state', required: false })
  async getMarketInsights(
    @Query('city')  city?:  string,
    @Query('state') state?: string,
  ) {
    const data = await this.analyticsService.getMarketInsights(city, state);
    return { success: true, data };
  }

  // ─── GET /api/home/market-cities ─────────────────────────────────────────────
  @Get('home/market-cities')
  @ApiOperation({ summary: 'Ordered list of cities for Market Intelligence tabs' })
  @ApiQuery({ name: 'limit', required: false })
  async getMarketCities(@Query('limit') limit?: string) {
    const data = await this.analyticsService.getMarketCities(limit ? parseInt(limit) : 12);
    return { success: true, data };
  }

  // ─── POST /api/home/market-snapshot/refresh ───────────────────────────────────
  @Post('home/market-snapshot/refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Admin: force-refresh market snapshot for a city' })
  async refreshSnapshot(
    @Body() body: { city?: string; state?: string; all?: boolean },
    @Request() req: any,
  ) {
    if (req.user?.role !== 'admin') throw new ForbiddenException('Admin only');
    if (body.all) {
      const result = await this.analyticsService.refreshAllMarketSnapshots();
      return { success: true, ...result };
    }
    const data = await this.analyticsService.refreshMarketSnapshot(body.city, body.state);
    return { success: true, data };
  }

  // ─── GET /api/admin/market-snapshots ──────────────────────────────────────────
  @Get('admin/market-snapshots')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Admin: list all market snapshots' })
  async listSnapshots(@Request() req: any) {
    if (req.user?.role !== 'admin') throw new ForbiddenException('Admin only');
    const data = await this.analyticsService.listMarketSnapshots();
    return { success: true, data };
  }

  // ─── PATCH /api/admin/market-snapshots/:id ────────────────────────────────────
  @Patch('admin/market-snapshots/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Admin: update isFeatured / sortOrder for a snapshot' })
  async updateSnapshot(
    @Param('id') id: string,
    @Body() dto: UpdateSnapshotDto,
    @Request() req: any,
  ) {
    if (req.user?.role !== 'admin') throw new ForbiddenException('Admin only');
    const data = await this.analyticsService.updateSnapshotMeta(id, dto);
    return { success: true, data };
  }

  // ─── GET /api/admin/scoring-config ────────────────────────────────────────────
  @Get('admin/scoring-config')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Admin: list all scoring weight configs' })
  async getScoringConfig(@Request() req: any) {
    if (req.user?.role !== 'admin') throw new ForbiddenException('Admin only');
    const data = await this.analyticsService.getScoringConfig();
    return { success: true, data };
  }

  // ─── PATCH /api/admin/scoring-config/:key ─────────────────────────────────────
  @Patch('admin/scoring-config/:key')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Admin: update a scoring weight by key' })
  async setScoringConfig(
    @Param('key') key: string,
    @Body() dto: SetScoringConfigDto,
    @Request() req: any,
  ) {
    if (req.user?.role !== 'admin') throw new ForbiddenException('Admin only');
    const data = await this.analyticsService.setScoringConfig(key, dto.value, dto.description);
    return { success: true, data };
  }

  // ─── DELETE /api/admin/scoring-config/:key ────────────────────────────────────
  @Delete('admin/scoring-config/:key')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Admin: reset a scoring weight to its default value' })
  async resetScoringConfig(
    @Param('key') key: string,
    @Request() req: any,
  ) {
    if (req.user?.role !== 'admin') throw new ForbiddenException('Admin only');
    await this.analyticsService.resetScoringConfig(key);
    return { success: true, message: `${key} reset to default` };
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

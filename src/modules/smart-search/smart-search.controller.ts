import {
  Controller, Post, Get, Body, Req, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SmartSearchService, LogSearchDto, TrackBehaviorDto } from './smart-search.service';
import { BehaviorEventType } from './entities/user-behavior.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';

@ApiTags('Smart Search')
@Controller('smart-search')
export class SmartSearchController {
  constructor(private readonly service: SmartSearchService) {}

  /**
   * GLOBAL SMART SEARCH — parse natural language query into structured filters.
   * Called by every search bar across the platform.
   * Returns redirect URL + filter chips for UI.
   * Rate-limited to 60/min per IP.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Parse natural language search query and get structured filters + redirect URL' })
  async smartSearch(
    @Body() body: { query: string; category?: string },
    @Req() req: any,
  ) {
    const query = (body.query || '').trim();
    if (!query) {
      return {
        filters: {},
        redirectUrl: '/properties',
        chips: [],
        nearbySearch: false,
        parsed: {},
      };
    }

    const result = await this.service.parseQuery(query, body.category);

    // Log the search (fire-and-forget — don't await)
    const userId = req.user?.id ?? null;
    void this.service.logSearch({
      userId,
      searchQuery: query,
      parsedFilters: result.filters,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });

    return result;
  }

  /**
   * Log a search query (fire-and-forget from client)
   * Rate-limited to 30/min per IP
   */
  @Post('log')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Log a search query for analytics / AI ranking' })
  async logSearch(
    @Body() body: {
      searchQuery: string;
      parsedFilters?: Record<string, any>;
      latitude?: number;
      longitude?: number;
      resultCount?: number;
      sessionId?: string;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.id ?? null;
    const dto: LogSearchDto = {
      ...body,
      userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    await this.service.logSearch(dto);
  }

  /**
   * Track a user behavior event (view, long_stay, wishlist, contact, etc.)
   * This drives lead scoring — no auth required.
   */
  @Post('behavior')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Track user behavior for smart lead scoring' })
  async trackBehavior(
    @Body() body: {
      propertyId: string;
      eventType: BehaviorEventType;
      duration?: number;
      sessionId?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
    },
    @Req() req: any,
  ) {
    const dto: TrackBehaviorDto = {
      ...body,
      userId: req.user?.id ?? undefined,
      ipAddress: req.ip,
    };
    return this.service.trackBehavior(dto);
  }

  /**
   * Get trending searches (last 7 days) for search bar autocomplete
   */
  @Get('trending')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get trending search queries, optionally filtered by category' })
  async getTrending(
    @Query('limit') limit = '8',
    @Query('category') category?: string,
  ) {
    return this.service.getTrendingSearches(
      Math.min(parseInt(limit) || 8, 20),
      category || undefined,
    );
  }

  /**
   * Get current user's recent search history
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user search history, optionally filtered by category' })
  async getHistory(
    @Req() req: any,
    @Query('limit') limit = '5',
    @Query('category') category?: string,
  ) {
    return this.service.getUserSearchHistory(
      req.user.id,
      Math.min(parseInt(limit) || 5, 10),
      category || undefined,
    );
  }
}

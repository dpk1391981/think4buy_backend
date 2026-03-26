import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ConsentService } from './consent.service';
import { SaveConsentDto } from './dto/save-consent.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('consent')
export class ConsentController {
  constructor(private readonly svc: ConsentService) {}

  // ── Public: save / upsert consent ──────────────────────────────────────────

  /**
   * POST /api/v1/consent
   * Save (or update) the user's consent preferences.
   * Works for both authenticated users and anonymous guests.
   * Returns 204 — fire-and-forget from the frontend.
   */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async save(@Body() dto: SaveConsentDto, @Req() req: Request): Promise<void> {
    const userId    = (req as any).user?.id as string | undefined;
    const ipAddress = (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null
    );
    const userAgent = req.headers['user-agent'] ?? null;

    // Fire-and-forget: do not await, never throws to the client
    this.svc.save(dto, ipAddress, userAgent, userId).catch(() => {});
  }

  // ── Auth optional: get current user's consent ──────────────────────────────

  /**
   * GET /api/v1/consent/me?sessionId=xxx
   * Returns the stored consent for the current user or session.
   * Allows the frontend to sync preferences across devices when user logs in.
   */
  @Get('me')
  async getMe(
    @Query('sessionId') sessionId: string | undefined,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id as string | undefined;
    const consent = await this.svc.findOne(userId, sessionId);
    if (!consent) return null;
    return {
      essential:       consent.essential,
      personalization: consent.personalization,
      analytics:       consent.analytics,
      marketing:       consent.marketing,
      consentVersion:  consent.consentVersion,
      decidedAt:       consent.updatedAt,
    };
  }

  // ── Admin: consent stats ────────────────────────────────────────────────────

  /**
   * GET /api/v1/consent/stats
   * Aggregated consent statistics for the admin dashboard.
   * Admin role required.
   */
  @Get('stats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async getStats() {
    return this.svc.getStats();
  }
}

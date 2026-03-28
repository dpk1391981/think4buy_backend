import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../users/entities/user.entity';
import { MediaProcessingService } from './media-processing.service';
import { MediaJobStatus, MediaJobType } from './entities/media-job.entity';

/**
 * Admin endpoints for media queue monitoring.
 *
 * GET  /admin/media/stats              — dashboard stats
 * GET  /admin/media/jobs               — paginated job list with filters
 * GET  /admin/media/jobs/:id           — single job detail
 * POST /admin/media/jobs/:id/retry     — re-enqueue a failed job
 * DELETE /admin/media/jobs/:id         — delete job record
 */
@UseGuards(AuthGuard('jwt'))
@Controller('admin/media')
export class MediaProcessingController {
  constructor(private readonly svc: MediaProcessingService) {}

  private assertAdmin(req: any) {
    const role = req.user?.role;
    if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN && !req.user?.isSuperAdmin) {
      throw new ForbiddenException('Admin access required');
    }
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    this.assertAdmin(req);
    return this.svc.getStats();
  }

  @Get('jobs')
  async list(
    @Request() req: any,
    @Query('status') status?: MediaJobStatus,
    @Query('type')   type?: MediaJobType,
    @Query('page')   page = '1',
    @Query('limit')  limit = '50',
  ) {
    this.assertAdmin(req);
    return this.svc.findAll({
      status,
      type,
      page:  Number(page),
      limit: Math.min(Number(limit), 200),
    });
  }

  @Get('jobs/:id')
  async getOne(@Request() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.svc.findById(id);
  }

  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retry(@Request() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    await this.svc.retry(id);
  }

  @Delete('jobs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    await this.svc.remove(id);
  }
}

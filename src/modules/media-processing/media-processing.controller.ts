import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseEnumPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
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
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/media')
export class MediaProcessingController {
  constructor(private readonly svc: MediaProcessingService) {}

  @Get('stats')
  async getStats() {
    return this.svc.getStats();
  }

  @Get('jobs')
  async list(
    @Query('status') status?: MediaJobStatus,
    @Query('type')   type?: MediaJobType,
    @Query('page')   page = '1',
    @Query('limit')  limit = '50',
  ) {
    return this.svc.findAll({
      status,
      type,
      page:  Number(page),
      limit: Math.min(Number(limit), 200),
    });
  }

  @Get('jobs/:id')
  async getOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retry(@Param('id') id: string) {
    await this.svc.retry(id);
  }

  @Delete('jobs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
  }
}

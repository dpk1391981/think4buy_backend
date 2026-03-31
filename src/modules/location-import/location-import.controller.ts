import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  ForbiddenException,
  BadRequestException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import * as path from 'path';
import { spreadsheetMulterOptions } from '../upload/multer.config';
import { LocationImportService } from './location-import.service';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('location-import')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin/location-import')
export class LocationImportController {
  constructor(private readonly service: LocationImportService) {}

  private assertAdmin(req: any) {
    const role = req.user?.role;
    if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN && !req.user?.isSuperAdmin) {
      throw new ForbiddenException('Admin access required');
    }
  }

  /**
   * POST /admin/location-import/upload
   * Accept a .xlsx / .xls / .csv file, save to disk, enqueue processing job.
   */
  @Post('upload')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Upload spreadsheet and enqueue location import job' })
  @UseInterceptors(FileInterceptor('file', spreadsheetMulterOptions()))
  async upload(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('geocode') geocode?: string,
    @Body('forceGeocode') forceGeocode?: string,
    @Body('dryRun') dryRun?: string,
    @Body('fileFilter') fileFilter?: string,
  ) {
    this.assertAdmin(req);

    if (!file) throw new BadRequestException('No file provided');

    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

    return this.service.createJob(
      file.originalname,
      ext,
      file.path, // diskStorage writes to disk and provides the path
      {
        geocode:      geocode === 'true',
        forceGeocode: forceGeocode === 'true',
        dryRun:       dryRun === 'true',
        fileFilter:   fileFilter?.trim() ?? '',
      },
    );
  }

  /**
   * GET /admin/location-import/jobs
   * List all import jobs (summary, no log output).
   */
  @Get('jobs')
  @ApiOperation({ summary: 'List all import jobs' })
  listJobs(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    this.assertAdmin(req);
    return this.service.listJobs(page, Math.min(limit, 50));
  }

  /**
   * GET /admin/location-import/jobs/:id
   * Get full job details including log output.
   */
  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job details + log' })
  getJob(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.getJob(id);
  }

  /**
   * PATCH /admin/location-import/jobs/:id/cancel
   * Cancel a pending or processing job.
   */
  @Patch('jobs/:id/cancel')
  @ApiOperation({ summary: 'Cancel a pending/processing job' })
  cancelJob(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.cancelJob(id);
  }

  /**
   * DELETE /admin/location-import/jobs/:id
   * Delete a job record and its temp file.
   */
  @Delete('jobs/:id')
  @ApiOperation({ summary: 'Delete a job record' })
  async deleteJob(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    await this.service.deleteJob(id);
    return { message: 'Job deleted' };
  }
}

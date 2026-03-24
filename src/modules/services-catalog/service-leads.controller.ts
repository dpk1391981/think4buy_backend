import {
  Controller, Post, Get, Put, Param, Body, Query, Request,
  HttpCode, HttpStatus, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { ServiceLeadsService } from './service-leads.service';
import {
  CreateServiceLeadDto,
  UpdateServiceLeadDto,
  ServiceLeadsQueryDto,
} from './dto/service-lead.dto';
import { UserRole } from '../users/entities/user.entity';

// ── Public lead capture ───────────────────────────────────────────────────────

@ApiTags('service-leads')
@Controller('service-leads')
export class ServiceLeadsController {
  constructor(private readonly svc: ServiceLeadsService) {}

  /**
   * POST /api/v1/service-leads
   * Public — no auth required, throttled to 5 req/min per IP
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit a service lead (public)' })
  create(@Body() dto: CreateServiceLeadDto) {
    return this.svc.create(dto);
  }
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

@ApiTags('admin / service-leads')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin/service-leads')
export class AdminServiceLeadsController {
  constructor(private readonly svc: ServiceLeadsService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  @Get()
  @ApiOperation({ summary: 'List service leads with filters (admin)' })
  findAll(@Request() req: any, @Query() query: ServiceLeadsQueryDto) {
    this.assertAdmin(req);
    return this.svc.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Service lead stats (admin)' })
  getStats(@Request() req: any) {
    this.assertAdmin(req);
    return this.svc.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single service lead (admin)' })
  findOne(@Request() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.svc.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update lead status / note (admin)' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateServiceLeadDto) {
    this.assertAdmin(req);
    return this.svc.update(id, dto);
  }
}

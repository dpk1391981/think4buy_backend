import {
  Controller, Post, Get, Put, Param, Body, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ServiceLeadsService } from './service-leads.service';
import {
  CreateServiceLeadDto,
  UpdateServiceLeadDto,
  ServiceLeadsQueryDto,
} from './dto/service-lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';

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
@UseGuards(JwtAuthGuard)
@Roles('admin')
@Controller('admin/service-leads')
export class AdminServiceLeadsController {
  constructor(private readonly svc: ServiceLeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List service leads with filters (admin)' })
  findAll(@Query() query: ServiceLeadsQueryDto) {
    return this.svc.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Service lead stats (admin)' })
  getStats() {
    return this.svc.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single service lead (admin)' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update lead status / note (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceLeadDto) {
    return this.svc.update(id, dto);
  }
}

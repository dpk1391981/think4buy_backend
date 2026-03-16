import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Request, HttpCode, HttpStatus, Res, Header,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import {
  CreateLeadDto,
  PublicLeadDto,
  UpdateLeadStatusDto,
  AssignLeadDto,
  AddLeadNoteDto,
  LeadsQueryDto,
  BulkAssignDto,
  BulkStatusDto,
  AnalyticsQueryDto,
} from './dto/leads.dto';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // ── Public endpoint — no JWT required ─────────────────────────────────────

  @Post('public')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public lead capture — from property pages, forms, chatbot etc.' })
  async capturePublic(@Body() dto: PublicLeadDto) {
    const { lead, isDuplicate } = await this.leadsService.capturePublic(dto);
    return {
      success: true,
      isDuplicate,
      leadId: lead.id,
      message: isDuplicate
        ? 'Your inquiry has already been received. Our team will reach out shortly.'
        : 'Thank you! Our team will contact you shortly.',
    };
  }

  // ── Analytics & Export (before :id routes) ────────────────────────────────

  @Get('analytics')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Comprehensive lead analytics' })
  analytics(@Query() query: AnalyticsQueryDto) {
    return this.leadsService.getAnalytics(query);
  }

  @Get('export')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export leads as CSV' })
  async exportCsv(@Query() query: LeadsQueryDto, @Res() res: Response) {
    const csv = await this.leadsService.exportCsv(query);
    const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
  }

  // ── Bulk operations ────────────────────────────────────────────────────────

  @Patch('bulk/assign')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk assign leads to an agent' })
  bulkAssign(@Body() dto: BulkAssignDto, @Request() req) {
    return this.leadsService.bulkAssign(dto, req.user.id);
  }

  @Patch('bulk/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update lead statuses' })
  bulkStatus(@Body() dto: BulkStatusDto, @Request() req) {
    return this.leadsService.bulkUpdateStatus(dto, req.user.id);
  }

  // ── Authenticated endpoints ────────────────────────────────────────────────

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create lead (agent/admin)' })
  create(@Body() dto: CreateLeadDto, @Request() req) {
    const agentId = req.user.agentProfileId || req.user.id;
    return this.leadsService.create(dto, agentId);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all leads (admin)' })
  findAll(@Query() query: LeadsQueryDto) {
    return this.leadsService.findAll(query);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My leads (agent sees own, admin sees all)' })
  myLeads(@Request() req, @Query() query: LeadsQueryDto) {
    if (req.user.role === 'admin') {
      return this.leadsService.findAll(query);
    }
    const agentId = req.user.agentProfileId || req.user.id;
    return this.leadsService.findByAgent(agentId, query);
  }

  @Get('stats')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lead statistics' })
  stats(@Request() req, @Query('agentId') agentId?: string) {
    const isAdmin = req.user.role === 'admin';
    const id = isAdmin ? agentId : (req.user.agentProfileId || req.user.id);
    return this.leadsService.getStats(id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  updateStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto, @Request() req) {
    return this.leadsService.updateStatus(id, dto, req.user.id);
  }

  @Patch(':id/assign')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  assign(@Param('id') id: string, @Body() dto: AssignLeadDto, @Request() req) {
    return this.leadsService.assignLead(id, dto, req.user.id);
  }

  @Post(':id/notes')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  addNote(@Param('id') id: string, @Body() dto: AddLeadNoteDto, @Request() req) {
    return this.leadsService.addNote(id, dto, req.user.id);
  }

  @Get(':id/activities')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  activities(@Param('id') id: string) {
    return this.leadsService.getActivities(id);
  }

  @Get(':id/assignments')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  assignments(@Param('id') id: string) {
    return this.leadsService.getAssignments(id);
  }

  @Post(':id/merge/:sourceId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Merge duplicate lead into this lead' })
  mergeLead(@Param('id') id: string, @Param('sourceId') sourceId: string, @Request() req) {
    return this.leadsService.mergeLead(id, sourceId, req.user.id);
  }
}

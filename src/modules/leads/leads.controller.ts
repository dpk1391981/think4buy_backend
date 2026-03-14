import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
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
}

import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LeadsService } from './leads.service';
import {
  CreateLeadDto,
  UpdateLeadStatusDto,
  AssignLeadDto,
  AddLeadNoteDto,
  LeadsQueryDto,
} from './dto/leads.dto';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateLeadDto, @Request() req) {
    const agentId = req.user.agentProfileId || req.user.id;
    return this.leadsService.create(dto, agentId);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() query: LeadsQueryDto) {
    return this.leadsService.findAll(query);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  myLeads(@Request() req, @Query() query: LeadsQueryDto) {
    const isAdmin = req.user.role === 'admin';
    if (isAdmin) {
      return this.leadsService.findAll(query);
    }
    const agentId = req.user.agentProfileId || req.user.id;
    return this.leadsService.findByAgent(agentId, query);
  }

  @Get('stats')
  @UseGuards(AuthGuard('jwt'))
  stats(@Request() req, @Query('agentId') agentId?: string) {
    const isAdmin = req.user.role === 'admin';
    const id = isAdmin ? agentId : (req.user.agentProfileId || req.user.id);
    return this.leadsService.getStats(id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'))
  updateStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto, @Request() req) {
    return this.leadsService.updateStatus(id, dto, req.user.id);
  }

  @Patch(':id/assign')
  @UseGuards(AuthGuard('jwt'))
  assign(@Param('id') id: string, @Body() dto: AssignLeadDto, @Request() req) {
    return this.leadsService.assignLead(id, dto, req.user.id);
  }

  @Post(':id/notes')
  @UseGuards(AuthGuard('jwt'))
  addNote(@Param('id') id: string, @Body() dto: AddLeadNoteDto, @Request() req) {
    return this.leadsService.addNote(id, dto, req.user.id);
  }

  @Get(':id/activities')
  @UseGuards(AuthGuard('jwt'))
  activities(@Param('id') id: string) {
    return this.leadsService.getActivities(id);
  }

  @Get(':id/assignments')
  @UseGuards(AuthGuard('jwt'))
  assignments(@Param('id') id: string) {
    return this.leadsService.getAssignments(id);
  }
}

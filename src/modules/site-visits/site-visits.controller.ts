import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SiteVisitsService } from './site-visits.service';
import { CreateSiteVisitDto, UpdateSiteVisitDto, CompleteVisitDto } from './dto/site-visits.dto';

@Controller('site-visits')
export class SiteVisitsController {
  constructor(private readonly siteVisitsService: SiteVisitsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateSiteVisitDto) {
    return this.siteVisitsService.create(dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.siteVisitsService.findAll(+page, +limit, status);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  myVisits(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    const agentId = req.user.agentProfileId || req.user.id;
    return this.siteVisitsService.findByAgent(agentId, +page, +limit, status);
  }

  @Get('today')
  @UseGuards(AuthGuard('jwt'))
  todayVisits(@Request() req) {
    const agentId = req.user.agentProfileId || req.user.id;
    return this.siteVisitsService.getTodayVisits(agentId);
  }

  @Get('lead/:leadId')
  @UseGuards(AuthGuard('jwt'))
  byLead(@Param('leadId') leadId: string) {
    return this.siteVisitsService.findByLead(leadId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.siteVisitsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() dto: UpdateSiteVisitDto) {
    return this.siteVisitsService.update(id, dto);
  }

  @Patch(':id/complete')
  @UseGuards(AuthGuard('jwt'))
  complete(@Param('id') id: string, @Body() dto: CompleteVisitDto) {
    return this.siteVisitsService.complete(id, dto);
  }

  @Patch(':id/cancel')
  @UseGuards(AuthGuard('jwt'))
  cancel(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.siteVisitsService.cancel(id, body.reason);
  }
}

import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DealsService } from './deals.service';
import { CreateDealDto, UpdateDealStageDto, DealsQueryDto } from './dto/deals.dto';

@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Request() req, @Body() dto: CreateDealDto) {
    dto.agentId = req.user.agentProfileId || req.user.id;
    return this.dealsService.create(dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() query: DealsQueryDto) {
    return this.dealsService.findAll(query);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  myDeals(@Request() req, @Query() query: DealsQueryDto) {
    const agentId = req.user.agentProfileId || req.user.id;
    return this.dealsService.findByAgent(agentId, query);
  }

  @Get('stats')
  @UseGuards(AuthGuard('jwt'))
  stats(@Request() req, @Query('agentId') agentId?: string) {
    const isAdmin = req.user.role === 'admin';
    const id = isAdmin ? agentId : (req.user.agentProfileId || req.user.id);
    return this.dealsService.getStats(id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.dealsService.findOne(id);
  }

  @Patch(':id/stage')
  @UseGuards(AuthGuard('jwt'))
  updateStage(@Param('id') id: string, @Body() dto: UpdateDealStageDto) {
    return this.dealsService.updateStage(id, dto);
  }
}

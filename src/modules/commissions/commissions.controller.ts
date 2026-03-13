import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CommissionsService } from './commissions.service';
import {
  CreateCommissionDto,
  ApproveCommissionDto,
  MarkPaidDto,
  CommissionsQueryDto,
} from './dto/commissions.dto';

@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateCommissionDto) {
    return this.commissionsService.create(dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() query: CommissionsQueryDto) {
    return this.commissionsService.findAll(query);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  myCommissions(@Request() req, @Query() query: CommissionsQueryDto) {
    const agentId = req.user.agentProfileId || req.user.id;
    return this.commissionsService.findByAgent(agentId, query);
  }

  @Get('stats')
  @UseGuards(AuthGuard('jwt'))
  stats(@Request() req, @Query('agentId') agentId?: string) {
    const isAdmin = req.user.role === 'admin';
    const id = isAdmin ? agentId : (req.user.agentProfileId || req.user.id);
    return this.commissionsService.getStats(id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.commissionsService.findOne(id);
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard('jwt'))
  approve(@Param('id') id: string, @Body() dto: ApproveCommissionDto, @Request() req) {
    return this.commissionsService.approve(id, req.user.id, dto);
  }

  @Patch(':id/pay')
  @UseGuards(AuthGuard('jwt'))
  markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.commissionsService.markPaid(id, dto);
  }

  @Patch(':id/dispute')
  @UseGuards(AuthGuard('jwt'))
  dispute(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.commissionsService.dispute(id, body.reason);
  }
}

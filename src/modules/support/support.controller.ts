import {
  Controller, Post, Get, Patch, Body, Param,
  Query, UseGuards, Request, HttpCode, HttpStatus,
  ParseIntPipe, DefaultValuePipe, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { UserRole } from '../users/entities/user.entity';
import {
  SupportService,
  CreateSupportTicketDto,
  UpdateSupportTicketDto,
  AssignTicketDto,
} from './support.service';
import { SupportTicketStatus, SupportTicketType } from './entities/support-ticket.entity';

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /** Inline admin check — mirrors assertAdmin() in AdminController */
  private assertAdmin(req: any) {
    const role = req.user?.role;
    const ok   = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN || req.user?.isSuperAdmin;
    if (!ok) throw new ForbiddenException('Admin access required');
  }

  // ── Public: testimonials for homepage ─────────────────────────────────────
  @Get('testimonials')
  @ApiOperation({ summary: 'Public: approved testimonials for homepage display' })
  @ApiQuery({ name: 'limit', required: false })
  getTestimonials(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.supportService.getPublicTestimonials(Math.min(limit, 50));
  }

  // ── Public: submit a ticket ───────────────────────────────────────────────
  @Post()
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a support ticket or feedback (guest-friendly)' })
  create(@Body() dto: CreateSupportTicketDto, @Request() req: any) {
    return this.supportService.create(dto, req.user?.id);
  }

  // ── User: my tickets ──────────────────────────────────────────────────────
  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the logged-in user's submitted tickets" })
  getMyTickets(@Request() req: any) {
    return this.supportService.findByUser(req.user.id);
  }

  // ── Admin: stats ──────────────────────────────────────────────────────────
  @Get('stats')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: support ticket stats' })
  getStats(@Request() req: any) {
    this.assertAdmin(req);
    return this.supportService.getStats();
  }

  // ── Admin: list assignable members ────────────────────────────────────────
  @Get('members')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: staff members available for ticket assignment' })
  getMembers(@Request() req: any) {
    this.assertAdmin(req);
    return this.supportService.getAdminMembers();
  }

  // ── Admin: paginated list ─────────────────────────────────────────────────
  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: list all support tickets' })
  @ApiQuery({ name: 'page',   required: false })
  @ApiQuery({ name: 'limit',  required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SupportTicketStatus })
  @ApiQuery({ name: 'type',   required: false, enum: SupportTicketType })
  findAll(
    @Request() req: any,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: SupportTicketStatus,
    @Query('type')   type?: SupportTicketType,
  ) {
    this.assertAdmin(req);
    return this.supportService.findAll(page, limit, search, status, type);
  }

  // ── Admin: get one ────────────────────────────────────────────────────────
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: get a single support ticket' })
  findOne(@Param('id') id: string, @Request() req: any) {
    this.assertAdmin(req);
    return this.supportService.findOne(id);
  }

  // ── Admin: update status / notes ──────────────────────────────────────────
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: update ticket status or add notes' })
  update(@Param('id') id: string, @Body() dto: UpdateSupportTicketDto, @Request() req: any) {
    this.assertAdmin(req);
    return this.supportService.update(id, dto);
  }

  // ── Admin: toggle testimonial ─────────────────────────────────────────────
  @Patch(':id/testimonial')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: toggle feedback as homepage testimonial' })
  toggleTestimonial(@Param('id') id: string, @Request() req: any) {
    this.assertAdmin(req);
    return this.supportService.toggleTestimonial(id);
  }

  // ── Admin: assign ticket ──────────────────────────────────────────────────
  @Patch(':id/assign')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: assign ticket to a staff member' })
  assignTicket(@Param('id') id: string, @Body() dto: AssignTicketDto, @Request() req: any) {
    this.assertAdmin(req);
    return this.supportService.assignTicket(id, dto.assignedToId);
  }

  // ── Admin: unassign ticket ────────────────────────────────────────────────
  @Patch(':id/unassign')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: remove assignment from a ticket' })
  unassignTicket(@Param('id') id: string, @Request() req: any) {
    this.assertAdmin(req);
    return this.supportService.unassignTicket(id);
  }
}

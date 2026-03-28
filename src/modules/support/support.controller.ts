import {
  Controller, Post, Get, Patch, Body, Param,
  Query, UseGuards, Request, HttpCode, HttpStatus,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { SupportService, CreateSupportTicketDto, UpdateSupportTicketDto } from './support.service';
import { SupportTicketStatus, SupportTicketType } from './entities/support-ticket.entity';

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /** POST /support — submit a help query or feedback (works for guests + logged-in users) */
  @Post()
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a support ticket or feedback (guest-friendly)' })
  create(@Body() dto: CreateSupportTicketDto, @Request() req: any) {
    return this.supportService.create(dto, req.user?.id);
  }

  /** GET /support/my — get current user's own tickets */
  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the logged-in user's submitted tickets" })
  getMyTickets(@Request() req: any) {
    return this.supportService.findByUser(req.user.id);
  }

  /** GET /support/stats — admin summary stats */
  @Get('stats')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: support ticket stats' })
  getStats() {
    return this.supportService.getStats();
  }

  /** GET /support — admin paginated list */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: list all support tickets' })
  @ApiQuery({ name: 'page',   required: false })
  @ApiQuery({ name: 'limit',  required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SupportTicketStatus })
  @ApiQuery({ name: 'type',   required: false, enum: SupportTicketType })
  findAll(
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: SupportTicketStatus,
    @Query('type')   type?: SupportTicketType,
  ) {
    return this.supportService.findAll(page, limit, search, status, type);
  }

  /** GET /support/:id — admin get one ticket */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: get a single support ticket' })
  findOne(@Param('id') id: string) {
    return this.supportService.findOne(id);
  }

  /** PATCH /support/:id — admin update status / add notes */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: update ticket status or add notes' })
  update(@Param('id') id: string, @Body() dto: UpdateSupportTicketDto) {
    return this.supportService.update(id, dto);
  }
}

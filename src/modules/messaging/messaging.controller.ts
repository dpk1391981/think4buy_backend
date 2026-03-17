import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { MessagingQueueService } from './messaging-queue.service';
import {
  CreateMessageServiceDto, UpdateMessageServiceDto,
  CreateMessageTemplateDto, UpdateMessageTemplateDto,
  CreateEventMappingDto, UpdateEventMappingDto,
  MessageLogQueryDto,
} from './dto/messaging.dto';

@ApiTags('admin/messaging')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin/messaging')
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly queueService: MessagingQueueService,
  ) {}

  // ── Services ──────────────────────────────────────────────────────────────

  @Get('services')
  @ApiOperation({ summary: 'List all messaging services' })
  listServices() {
    return this.messagingService.findAllServices();
  }

  @Post('services')
  @ApiOperation({ summary: 'Create a messaging service (WhatsApp/SMS/Email)' })
  createService(@Body() dto: CreateMessageServiceDto) {
    return this.messagingService.createService(dto);
  }

  @Patch('services/:id')
  @ApiOperation({ summary: 'Update a messaging service' })
  updateService(@Param('id') id: string, @Body() dto: UpdateMessageServiceDto) {
    return this.messagingService.updateService(id, dto);
  }

  @Delete('services/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a messaging service' })
  deleteService(@Param('id') id: string) {
    return this.messagingService.deleteService(id);
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  @Get('templates')
  @ApiOperation({ summary: 'List all message templates' })
  listTemplates() {
    return this.messagingService.findAllTemplates();
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a message template' })
  createTemplate(@Body() dto: CreateMessageTemplateDto) {
    return this.messagingService.createTemplate(dto);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Update a message template' })
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateMessageTemplateDto) {
    return this.messagingService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message template' })
  deleteTemplate(@Param('id') id: string) {
    return this.messagingService.deleteTemplate(id);
  }

  // ── Event Mappings ────────────────────────────────────────────────────────

  @Get('event-mappings')
  @ApiOperation({ summary: 'List all event → template mappings' })
  listMappings() {
    return this.messagingService.findAllMappings();
  }

  @Post('event-mappings')
  @ApiOperation({ summary: 'Create an event → template mapping' })
  createMapping(@Body() dto: CreateEventMappingDto) {
    return this.messagingService.createMapping(dto);
  }

  @Patch('event-mappings/:id')
  @ApiOperation({ summary: 'Update an event mapping' })
  updateMapping(@Param('id') id: string, @Body() dto: UpdateEventMappingDto) {
    return this.messagingService.updateMapping(id, dto);
  }

  @Delete('event-mappings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an event mapping' })
  deleteMapping(@Param('id') id: string) {
    return this.messagingService.deleteMapping(id);
  }

  // ── Logs ──────────────────────────────────────────────────────────────────

  @Get('logs')
  @ApiOperation({ summary: 'Get message delivery logs (paginated)' })
  getLogs(@Query() query: MessageLogQueryDto) {
    return this.messagingService.getLogs(query);
  }

  @Get('logs/stats')
  @ApiOperation({ summary: 'Get message log statistics' })
  getLogStats() {
    return this.messagingService.getLogStats();
  }

  @Post('logs/:id/retry')
  @ApiOperation({ summary: 'Retry a failed message' })
  retryMessage(@Param('id') id: string) {
    return this.queueService.retryLog(id);
  }

  // ── Test / Meta ───────────────────────────────────────────────────────────

  @Get('events')
  @ApiOperation({ summary: 'List all available system events' })
  listEvents() {
    const { SystemEvent, RecipientType } = require('./entities/event-template-mapping.entity');
    return {
      events:         Object.values(SystemEvent),
      recipientTypes: Object.values(RecipientType),
    };
  }

  @Post('test-trigger')
  @ApiOperation({ summary: 'Test-trigger an event with dummy data (dev only)' })
  async testTrigger(@Body() body: { event: string; context: Record<string, any> }) {
    await this.queueService.trigger(body.event, body.context);
    return { message: `Event "${body.event}" triggered` };
  }
}

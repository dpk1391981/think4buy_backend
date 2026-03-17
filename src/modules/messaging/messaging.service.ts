import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageService, MessageChannel, MessageProvider } from './entities/message-service.entity';
import { MessageTemplate } from './entities/message-template.entity';
import { EventTemplateMapping } from './entities/event-template-mapping.entity';
import { MessageLog, MessageStatus } from './entities/message-log.entity';
import {
  CreateMessageServiceDto, UpdateMessageServiceDto,
  CreateMessageTemplateDto, UpdateMessageTemplateDto,
  CreateEventMappingDto, UpdateEventMappingDto,
  MessageLogQueryDto,
} from './dto/messaging.dto';
import { WhatsAppMetaProvider } from './providers/whatsapp-meta.provider';
import { WhatsAppTwilioProvider } from './providers/whatsapp-twilio.provider';
import { SmsProvider } from './providers/sms.provider';
import { EmailProvider } from './providers/email.provider';
import { IMessagingProvider, SendMessagePayload } from './providers/provider.interface';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectRepository(MessageService)   private serviceRepo: Repository<MessageService>,
    @InjectRepository(MessageTemplate)  private templateRepo: Repository<MessageTemplate>,
    @InjectRepository(EventTemplateMapping) private mappingRepo: Repository<EventTemplateMapping>,
    @InjectRepository(MessageLog)       private logRepo: Repository<MessageLog>,
    private readonly whatsappMeta: WhatsAppMetaProvider,
    private readonly whatsappTwilio: WhatsAppTwilioProvider,
    private readonly smsProvider: SmsProvider,
    private readonly emailProvider: EmailProvider,
  ) {}

  // ── Message Services CRUD ─────────────────────────────────────────────────

  async createService(dto: CreateMessageServiceDto): Promise<MessageService> {
    const svc = this.serviceRepo.create(dto);
    return this.serviceRepo.save(svc);
  }

  async findAllServices(): Promise<MessageService[]> {
    return this.serviceRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOneService(id: string): Promise<MessageService> {
    const svc = await this.serviceRepo.findOne({ where: { id } });
    if (!svc) throw new NotFoundException('Message service not found');
    return svc;
  }

  async updateService(id: string, dto: UpdateMessageServiceDto): Promise<MessageService> {
    const svc = await this.findOneService(id);
    Object.assign(svc, dto);
    return this.serviceRepo.save(svc);
  }

  async deleteService(id: string): Promise<void> {
    const svc = await this.findOneService(id);
    await this.serviceRepo.remove(svc);
  }

  // ── Message Templates CRUD ────────────────────────────────────────────────

  async createTemplate(dto: CreateMessageTemplateDto): Promise<MessageTemplate> {
    const tpl = this.templateRepo.create(dto);
    return this.templateRepo.save(tpl);
  }

  async findAllTemplates(): Promise<MessageTemplate[]> {
    return this.templateRepo.find({ relations: ['service'], order: { createdAt: 'DESC' } });
  }

  async findOneTemplate(id: string): Promise<MessageTemplate> {
    const tpl = await this.templateRepo.findOne({ where: { id }, relations: ['service'] });
    if (!tpl) throw new NotFoundException('Message template not found');
    return tpl;
  }

  async updateTemplate(id: string, dto: UpdateMessageTemplateDto): Promise<MessageTemplate> {
    const tpl = await this.findOneTemplate(id);
    Object.assign(tpl, dto);
    return this.templateRepo.save(tpl);
  }

  async deleteTemplate(id: string): Promise<void> {
    const tpl = await this.findOneTemplate(id);
    await this.templateRepo.remove(tpl);
  }

  // ── Event Mappings CRUD ───────────────────────────────────────────────────

  async createMapping(dto: CreateEventMappingDto): Promise<EventTemplateMapping> {
    const mapping = this.mappingRepo.create(dto);
    return this.mappingRepo.save(mapping);
  }

  async findAllMappings(): Promise<EventTemplateMapping[]> {
    return this.mappingRepo.find({
      relations: ['template', 'template.service'],
      order: { event: 'ASC', recipientType: 'ASC' },
    });
  }

  async findMappingsByEvent(event: string): Promise<EventTemplateMapping[]> {
    return this.mappingRepo.find({
      where: { event: event as any, isActive: true },
      relations: ['template', 'template.service'],
    });
  }

  async updateMapping(id: string, dto: UpdateEventMappingDto): Promise<EventTemplateMapping> {
    const mapping = await this.mappingRepo.findOne({ where: { id } });
    if (!mapping) throw new NotFoundException('Event mapping not found');
    Object.assign(mapping, dto);
    return this.mappingRepo.save(mapping);
  }

  async deleteMapping(id: string): Promise<void> {
    const mapping = await this.mappingRepo.findOne({ where: { id } });
    if (!mapping) throw new NotFoundException('Event mapping not found');
    await this.mappingRepo.remove(mapping);
  }

  // ── Template Rendering ────────────────────────────────────────────────────

  /** Replace {{variable}} placeholders with values from context */
  renderTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return context[key] !== undefined ? String(context[key]) : `{{${key}}}`;
    });
  }

  /** Extract variable names as array of rendered values (for WhatsApp template params) */
  extractVariableValues(variables: string[], context: Record<string, any>): string[] {
    return (variables || []).map(v => context[v] !== undefined ? String(context[v]) : '');
  }

  // ── Send Message ──────────────────────────────────────────────────────────

  /** Direct send (called by worker) — no queue */
  async sendDirect(params: {
    templateId: string;
    recipientType: string;
    recipient: string;
    recipientUserId?: string;
    event: string;
    context: Record<string, any>;
    logId?: string;
    jobId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const log = params.logId
      ? await this.logRepo.findOne({ where: { id: params.logId } })
      : null;

    try {
      const template = await this.templateRepo.findOne({
        where: { id: params.templateId },
        relations: ['service'],
      });

      if (!template || !template.isActive) {
        await this.updateLog(log, MessageStatus.SKIPPED, 'Template inactive or not found', params);
        return { success: false, error: 'Template not found or inactive' };
      }

      const service = template.service;
      if (!service || !service.isActive) {
        await this.updateLog(log, MessageStatus.SKIPPED, 'Service inactive or not found', params, template);
        return { success: false, error: 'Service not found or inactive' };
      }

      const renderedBody = this.renderTemplate(template.body, params.context);
      const renderedSubject = template.subject
        ? this.renderTemplate(template.subject, params.context)
        : undefined;
      const templateVars = this.extractVariableValues(template.variables ?? [], params.context);

      const payload: SendMessagePayload = {
        to: params.recipient,
        body: renderedBody,
        subject: renderedSubject,
        providerTemplateName: template.providerTemplateName,
        templateVariables: templateVars,
      };

      const provider = this.resolveProvider(service.channel, service.provider);
      const result = await provider.send(payload, service.config ?? {});

      if (log) {
        log.status       = result.success ? MessageStatus.SENT : MessageStatus.FAILED;
        log.renderedBody = renderedBody;
        log.errorMessage = result.error ?? null;
        log.sentAt       = result.success ? new Date() : null;
        log.attempts     = (log.attempts ?? 0) + 1;
        await this.logRepo.save(log);
      }

      return result;
    } catch (err: any) {
      this.logger.error(`sendDirect failed: ${err.message}`, err.stack);
      if (log) {
        log.status       = MessageStatus.FAILED;
        log.errorMessage = err.message;
        log.attempts     = (log.attempts ?? 0) + 1;
        await this.logRepo.save(log);
      }
      return { success: false, error: err.message };
    }
  }

  private async updateLog(
    log: MessageLog | null,
    status: MessageStatus,
    error: string,
    params: any,
    template?: MessageTemplate,
  ) {
    if (!log) return;
    log.status       = status;
    log.errorMessage = error;
    log.renderedBody = template ? this.renderTemplate(template.body, params.context) : null;
    await this.logRepo.save(log);
  }

  /** Create a log entry for a queued job */
  async createLog(params: {
    event: string;
    templateId: string;
    serviceId?: string;
    recipientType: string;
    recipient: string;
    recipientUserId?: string;
    jobId?: string;
    contextData?: Record<string, any>;
  }): Promise<MessageLog> {
    const log = this.logRepo.create({
      ...params,
      status: MessageStatus.QUEUED,
      attempts: 0,
    });
    return this.logRepo.save(log);
  }

  // ── Logs Query ────────────────────────────────────────────────────────────

  async getLogs(query: MessageLogQueryDto) {
    const page  = query.page  ? Number(query.page)  : 1;
    const limit = query.limit ? Number(query.limit) : 20;

    const qb = this.logRepo.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');

    if (query.event)         qb.andWhere('log.event = :event',               { event: query.event });
    if (query.status)        qb.andWhere('log.status = :status',             { status: query.status });
    if (query.recipientType) qb.andWhere('log.recipientType = :rt',          { rt: query.recipientType });
    if (query.dateFrom)      qb.andWhere('log.createdAt >= :df',             { df: query.dateFrom });
    if (query.dateTo) {
      const dt = new Date(query.dateTo); dt.setHours(23, 59, 59, 999);
      qb.andWhere('log.createdAt <= :dt', { dt: dt.toISOString() });
    }

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getLogStats() {
    const db = this.logRepo.manager.connection;
    const [byStatus, byEvent, todayCount] = await Promise.all([
      db.query('SELECT status, COUNT(*) as cnt FROM message_logs GROUP BY status'),
      db.query('SELECT event, COUNT(*) as cnt FROM message_logs GROUP BY event ORDER BY cnt DESC LIMIT 10'),
      db.query('SELECT COUNT(*) as cnt FROM message_logs WHERE DATE(createdAt) = CURDATE()'),
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, Number(r.cnt)])),
      byEvent:  Object.fromEntries(byEvent.map((r: any) => [r.event, Number(r.cnt)])),
      today:    Number(todayCount[0]?.cnt ?? 0),
    };
  }

  // ── Provider Resolution ───────────────────────────────────────────────────

  resolveProvider(channel: MessageChannel, provider: MessageProvider): IMessagingProvider {
    if (channel === MessageChannel.WHATSAPP) {
      if (provider === MessageProvider.TWILIO) return this.whatsappTwilio;
      return this.whatsappMeta; // default for WhatsApp
    }
    if (channel === MessageChannel.SMS) return this.smsProvider;
    if (channel === MessageChannel.EMAIL) return this.emailProvider;
    throw new Error(`Unsupported channel: ${channel}`);
  }
}

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MessagingService } from './messaging.service';
import { MessageStatus } from './entities/message-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageLog } from './entities/message-log.entity';

export const MESSAGING_QUEUE = 'messaging';

export interface MessageJobData {
  event: string;
  templateId: string;
  serviceId?: string;
  recipientType: string;
  recipient: string;
  recipientUserId?: string;
  context: Record<string, any>;
  logId: string;
}

/**
 * EventContext: data passed when triggering an event.
 * Keys map to recipient types (buyer, agent, admin, owner).
 * Each sub-object contains the data for that recipient.
 */
export interface EventContext {
  buyer?: {
    userId?: string;
    name?: string;
    phone?: string;
    email?: string;
    [key: string]: any;
  };
  agent?: {
    userId?: string;
    name?: string;
    phone?: string;
    email?: string;
    [key: string]: any;
  };
  admin?: {
    userId?: string;
    name?: string;
    phone?: string;
    email?: string;
    [key: string]: any;
  };
  owner?: {
    userId?: string;
    name?: string;
    phone?: string;
    email?: string;
    [key: string]: any;
  };
  /** Shared data merged into each recipient's context */
  [key: string]: any;
}

@Injectable()
export class MessagingQueueService {
  private readonly logger = new Logger(MessagingQueueService.name);

  constructor(
    @Optional() @InjectQueue(MESSAGING_QUEUE) private readonly queue: Queue | null,
    private readonly messagingService: MessagingService,
    @InjectRepository(MessageLog) private logRepo: Repository<MessageLog>,
  ) {}

  /**
   * Trigger a system event.
   * Looks up all active event→template mappings and enqueues one job per mapping.
   *
   * @param event   - SystemEvent enum value, e.g. 'lead_created'
   * @param context - Recipient data + shared metadata
   */
  async trigger(event: string, context: EventContext): Promise<void> {
    try {
      const mappings = await this.messagingService.findMappingsByEvent(event);
      if (!mappings.length) {
        this.logger.debug(`No active mappings for event: ${event}`);
        return;
      }

      for (const mapping of mappings) {
        const recipientType = mapping.recipientType;
        const recipientData = context[recipientType] ?? {};

        // Determine the actual recipient contact (phone/email)
        const template  = mapping.template;
        const channel   = template?.channel;
        let   recipient = '';

        if (channel === 'whatsapp' || channel === 'sms') {
          recipient = recipientData.phone ?? '';
        } else if (channel === 'email') {
          recipient = recipientData.email ?? '';
        }

        if (!recipient) {
          this.logger.warn(`No ${channel} contact for ${recipientType} in event ${event} — skipping`);
          continue;
        }

        // Merge shared context + recipient-specific data for variable rendering
        const { buyer: _b, agent: _a, admin: _ad, owner: _o, ...shared } = context;
        const mergedContext: Record<string, any> = {
          ...shared,
          ...recipientData,
          recipient_type: recipientType,
          event,
        };

        // Create log entry first
        const log = await this.messagingService.createLog({
          event,
          templateId:      mapping.templateId,
          serviceId:       template?.serviceId ?? undefined,
          recipientType,
          recipient,
          recipientUserId: recipientData.userId,
          contextData:     mergedContext,
        });

        const jobData: MessageJobData = {
          event,
          templateId:      mapping.templateId,
          serviceId:       template?.serviceId,
          recipientType,
          recipient,
          recipientUserId: recipientData.userId,
          context:         mergedContext,
          logId:           log.id,
        };

        if (this.queue) {
          await this.queue.add('sendMessage', jobData, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 500 },
          });
          this.logger.debug(`Queued message job for event=${event} recipientType=${recipientType}`);
        } else {
          // Fallback: direct send if queue is unavailable
          this.logger.warn('BullMQ queue not available — sending directly');
          await this.messagingService.sendDirect({ ...jobData, logId: log.id });
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to trigger event ${event}: ${err.message}`, err.stack);
    }
  }

  /** Retry a failed message log by re-queuing */
  async retryLog(logId: string): Promise<void> {
    const log = await this.logRepo.findOne({ where: { id: logId } });
    if (!log) throw new Error('Log not found');

    log.status = MessageStatus.QUEUED;
    log.errorMessage = null;
    await this.logRepo.save(log);

    const jobData: MessageJobData = {
      event:           log.event,
      templateId:      log.templateId,
      serviceId:       log.serviceId,
      recipientType:   log.recipientType,
      recipient:       log.recipient,
      recipientUserId: log.recipientUserId,
      context:         log.contextData ?? {},
      logId:           log.id,
    };

    if (this.queue) {
      await this.queue.add('sendMessage', jobData, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    } else {
      await this.messagingService.sendDirect({ ...jobData, logId });
    }
  }
}

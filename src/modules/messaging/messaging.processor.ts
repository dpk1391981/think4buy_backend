import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MessagingService } from './messaging.service';
import { MESSAGING_QUEUE, MessageJobData } from './messaging-queue.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageLog, MessageStatus } from './entities/message-log.entity';

/**
 * BullMQ Worker — processes 'sendMessage' jobs from the messaging queue.
 *
 * Each job contains:
 *   templateId, recipientType, recipient (phone/email), context (merged data), logId
 *
 * Failed jobs are automatically retried 3× with exponential backoff (configured at enqueue time).
 */
@Processor(MESSAGING_QUEUE)
export class MessagingProcessor extends WorkerHost {
  private readonly logger = new Logger(MessagingProcessor.name);

  constructor(
    private readonly messagingService: MessagingService,
    @InjectRepository(MessageLog) private logRepo: Repository<MessageLog>,
  ) {
    super();
  }

  async process(job: Job<MessageJobData>): Promise<any> {
    const { event, templateId, recipientType, recipient, context, logId } = job.data;
    this.logger.log(`Processing job ${job.id} — event=${event} recipient=${recipientType}:${recipient}`);

    // Mark as retrying if this is not the first attempt
    if (job.attemptsMade > 0) {
      await this.logRepo.update(
        { id: logId },
        { status: MessageStatus.RETRYING, attempts: job.attemptsMade },
      );
    }

    const result = await this.messagingService.sendDirect({
      templateId,
      recipientType,
      recipient,
      recipientUserId: job.data.recipientUserId,
      event,
      context,
      logId,
      jobId: String(job.id),
    });

    if (!result.success) {
      // Throw so BullMQ retries the job (if attempts remaining)
      throw new Error(result.error ?? 'Send failed');
    }

    this.logger.log(`Job ${job.id} succeeded — event=${event} recipient=${recipient}`);
    return { success: true };
  }
}

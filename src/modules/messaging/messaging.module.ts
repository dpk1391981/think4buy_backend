import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MessageService } from './entities/message-service.entity';
import { MessageTemplate } from './entities/message-template.entity';
import { EventTemplateMapping } from './entities/event-template-mapping.entity';
import { MessageLog } from './entities/message-log.entity';
import { MessagingService } from './messaging.service';
import { MessagingQueueService, MESSAGING_QUEUE } from './messaging-queue.service';
import { MessagingProcessor } from './messaging.processor';
import { MessagingController } from './messaging.controller';
import { WhatsAppMetaProvider } from './providers/whatsapp-meta.provider';
import { WhatsAppTwilioProvider } from './providers/whatsapp-twilio.provider';
import { SmsProvider } from './providers/sms.provider';
import { EmailProvider } from './providers/email.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageService, MessageTemplate, EventTemplateMapping, MessageLog]),
    BullModule.registerQueue({ name: MESSAGING_QUEUE }),
  ],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    MessagingQueueService,
    MessagingProcessor,
    WhatsAppMetaProvider,
    WhatsAppTwilioProvider,
    SmsProvider,
    EmailProvider,
  ],
  exports: [MessagingQueueService, MessagingService],
})
export class MessagingModule {}

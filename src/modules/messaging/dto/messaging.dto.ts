import { IsString, IsEnum, IsOptional, IsBoolean, IsArray, IsObject, IsUUID } from 'class-validator';
import { MessageChannel, MessageProvider } from '../entities/message-service.entity';
import { SystemEvent, RecipientType } from '../entities/event-template-mapping.entity';

// ── Message Service ──────────────────────────────────────────────────────────

export class CreateMessageServiceDto {
  @IsString()
  name: string;

  @IsEnum(MessageChannel)
  channel: MessageChannel;

  @IsEnum(MessageProvider)
  @IsOptional()
  provider?: MessageProvider;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateMessageServiceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(MessageChannel)
  @IsOptional()
  channel?: MessageChannel;

  @IsEnum(MessageProvider)
  @IsOptional()
  provider?: MessageProvider;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ── Message Template ─────────────────────────────────────────────────────────

export class CreateMessageTemplateDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(MessageChannel)
  channel: MessageChannel;

  @IsString()
  @IsOptional()
  providerTemplateName?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  body: string;

  @IsArray()
  @IsOptional()
  variables?: string[];

  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateMessageTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(MessageChannel)
  @IsOptional()
  channel?: MessageChannel;

  @IsString()
  @IsOptional()
  providerTemplateName?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsArray()
  @IsOptional()
  variables?: string[];

  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ── Event Template Mapping ───────────────────────────────────────────────────

export class CreateEventMappingDto {
  @IsEnum(SystemEvent)
  event: SystemEvent;

  @IsEnum(RecipientType)
  recipientType: RecipientType;

  @IsUUID()
  templateId: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateEventMappingDto {
  @IsEnum(SystemEvent)
  @IsOptional()
  event?: SystemEvent;

  @IsEnum(RecipientType)
  @IsOptional()
  recipientType?: RecipientType;

  @IsUUID()
  @IsOptional()
  templateId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ── Log Query ────────────────────────────────────────────────────────────────

export class MessageLogQueryDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  event?: string;

  @IsOptional()
  status?: string;

  @IsOptional()
  recipientType?: string;

  @IsOptional()
  dateFrom?: string;

  @IsOptional()
  dateTo?: string;
}

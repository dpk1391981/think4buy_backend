import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SiteVisitStatus, VisitOutcome } from '../entities/site-visit.entity';

export class CreateSiteVisitDto {
  @IsUUID()
  leadId: string;

  @IsUUID()
  agentId: string;

  @IsUUID()
  @IsOptional()
  propertyId?: string;

  @IsDateString()
  scheduledAt: string;
}

export class UpdateSiteVisitDto {
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsEnum(SiteVisitStatus)
  @IsOptional()
  status?: SiteVisitStatus;

  @IsEnum(VisitOutcome)
  @IsOptional()
  outcome?: VisitOutcome;

  @IsString()
  @IsOptional()
  agentNotes?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  clientRating?: number;

  @IsString()
  @IsOptional()
  clientFeedback?: string;

  @IsString()
  @IsOptional()
  cancelReason?: string;
}

export class CompleteVisitDto {
  @IsEnum(VisitOutcome)
  outcome: VisitOutcome;

  @IsString()
  @IsOptional()
  agentNotes?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  clientRating?: number;
}

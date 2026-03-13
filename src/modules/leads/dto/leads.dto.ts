import { IsString, IsOptional, IsEnum, IsNumber, IsEmail, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { LeadSource, LeadStatus, LeadPropertyType } from '../entities/lead.entity';

export class CreateLeadDto {
  @IsEnum(LeadSource)
  @IsOptional()
  source?: LeadSource;

  @IsString()
  @IsOptional()
  sourceRef?: string;

  @IsUUID()
  @IsOptional()
  propertyId?: string;

  @IsString()
  contactName: string;

  @IsString()
  contactPhone: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  cityId?: string;

  @IsEnum(LeadPropertyType)
  @IsOptional()
  propertyType?: LeadPropertyType;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  budgetMin?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  budgetMax?: number;

  @IsString()
  @IsOptional()
  requirement?: string;
}

export class UpdateLeadStatusDto {
  @IsEnum(LeadStatus)
  status: LeadStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  lostReason?: string;
}

export class AssignLeadDto {
  @IsUUID()
  agentId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class AddLeadNoteDto {
  @IsString()
  notes: string;
}

export class LeadsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  status?: string;

  @IsOptional()
  temperature?: string;

  @IsOptional()
  city?: string;

  @IsOptional()
  propertyType?: string;

  @IsOptional()
  agentId?: string;

  @IsOptional()
  search?: string;

  @IsOptional()
  dateFrom?: string;

  @IsOptional()
  dateTo?: string;
}

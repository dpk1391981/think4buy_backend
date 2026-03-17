import { IsString, IsOptional, IsEnum, IsNumber, IsEmail, IsUUID, IsArray, Length, Matches } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/** Strips country code / spaces so phone is always a 10-digit Indian number */
function normalizeIndianPhone({ value }: { value: string }): string {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0'))  return digits.slice(1);
  return digits.slice(-10);
}
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
  locality?: string;

  @IsString()
  @IsOptional()
  localityId?: string;

  @IsString()
  @IsOptional()
  propertyFor?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  areaMin?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  areaMax?: number;

  @IsString()
  @IsOptional()
  areaUnit?: string;

  @IsString()
  @IsOptional()
  userType?: string;

  @IsString()
  @IsOptional()
  preferredLocalities?: string;

  @IsString()
  @IsOptional()
  requirement?: string;

  // Tracking
  @IsString()
  @IsOptional()
  utmSource?: string;

  @IsString()
  @IsOptional()
  utmMedium?: string;

  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  deviceType?: string;
}

/** Stripped-down DTO for public (unauthenticated) lead capture forms */
export class PublicLeadDto {
  @IsEnum(LeadSource)
  source: LeadSource;

  @IsString()
  @IsOptional()
  propertyId?: string;

  @IsString()
  @Length(2, 100)
  contactName: string;

  @Transform(normalizeIndianPhone)
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  contactPhone: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  cityId?: string;

  @IsString()
  @IsOptional()
  state?: string;

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
  locality?: string;

  @IsString()
  @IsOptional()
  localityId?: string;

  @IsString()
  @IsOptional()
  propertyFor?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  areaMin?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  areaMax?: number;

  @IsString()
  @IsOptional()
  areaUnit?: string;

  @IsString()
  @IsOptional()
  userType?: string;

  @IsString()
  @IsOptional()
  preferredLocalities?: string;

  @IsString()
  @IsOptional()
  requirement?: string;

  @IsString()
  @IsOptional()
  utmSource?: string;

  @IsString()
  @IsOptional()
  utmMedium?: string;

  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  deviceType?: string;

  /** Optional: directly assign this lead to a specific agent (e.g. from agent profile page) */
  @IsString()
  @IsOptional()
  assignedAgentId?: string;

  /** Logged-in buyer's user.id — used to notify them on status changes */
  @IsString()
  @IsOptional()
  contactUserId?: string;
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
  agencyId?: string;

  @IsOptional()
  source?: string;

  @IsOptional()
  propertyFor?: string;

  @IsOptional()
  locality?: string;

  @IsOptional()
  search?: string;

  @IsOptional()
  dateFrom?: string;

  @IsOptional()
  dateTo?: string;

  @IsOptional()
  unassigned?: string;
}

export class BulkAssignDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  leadIds: string[];

  @IsUUID()
  agentId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class BulkStatusDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  leadIds: string[];

  @IsEnum(LeadStatus)
  status: LeadStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AnalyticsQueryDto {
  @IsOptional()
  dateFrom?: string;

  @IsOptional()
  dateTo?: string;

  @IsOptional()
  agentId?: string;

  @IsOptional()
  city?: string;
}

import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCommissionDto {
  @IsUUID()
  dealId: string;

  @IsUUID()
  agentId: string;

  @IsUUID()
  @IsOptional()
  agencyId?: string;

  @IsNumber()
  @Type(() => Number)
  dealPrice: number;

  @IsNumber()
  @Type(() => Number)
  commissionRate: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  platformCutPct?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  agencyCutPct?: number;
}

export class ApproveCommissionDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class MarkPaidDto {
  @IsString()
  paymentReference: string;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;
}

export class CommissionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  status?: string;

  @IsOptional()
  agentId?: string;
}

import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { DealStage, SellerType } from '../entities/deal.entity';

export class CreateDealDto {
  @IsUUID()
  leadId: string;

  // Injected from JWT in controller — not required from body
  @IsUUID()
  @IsOptional()
  agentId?: string;

  @IsUUID()
  @IsOptional()
  agencyId?: string;

  // Empty string from frontend should be treated as absent
  @IsUUID()
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  propertyId?: string;

  @IsEnum(SellerType)
  @IsOptional()
  sellerType?: SellerType;

  @IsUUID()
  @IsOptional()
  sellerId?: string;

  @IsNumber()
  @Type(() => Number)
  agreedPrice: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  bookingAmount?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  commissionRate?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateDealStageDto {
  @IsEnum(DealStage)
  stage: DealStage;

  @IsDateString()
  @IsOptional()
  bookingDate?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  bookingAmount?: number;

  @IsDateString()
  @IsOptional()
  agreementDate?: string;

  @IsDateString()
  @IsOptional()
  registrationDate?: string;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class DealsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  stage?: string;

  @IsOptional()
  agentId?: string;

  @IsOptional()
  search?: string;
}

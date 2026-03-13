import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { DealStage, SellerType } from '../entities/deal.entity';

export class CreateDealDto {
  @IsUUID()
  leadId: string;

  @IsUUID()
  agentId: string;

  @IsUUID()
  @IsOptional()
  agencyId?: string;

  @IsUUID()
  @IsOptional()
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

import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentType } from '../entities/payment-transaction.entity';

export class InitiatePaymentDto {
  @ApiProperty({ description: 'Client-generated UUID to ensure idempotency', example: 'a1b2c3d4-...' })
  @IsString()
  @Length(10, 64)
  idempotencyKey: string;

  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiProperty({ description: 'Amount in INR (or configured currency)', example: 999 })
  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  amount: number;

  @ApiPropertyOptional({ default: 'INR' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'ID of the plan/boost being purchased' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Extra metadata stored on the transaction' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  transactionId: string;

  @ApiProperty()
  @IsString()
  gatewayOrderId: string;

  @ApiProperty()
  @IsString()
  gatewayPaymentId: string;

  @ApiProperty()
  @IsString()
  gatewaySignature: string;
}

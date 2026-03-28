import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RefundInitiatedBy } from '../entities/refund.entity';

export class InitiateRefundDto {
  @ApiProperty({ description: 'ID of the payment transaction to refund' })
  @IsUUID()
  transactionId: string;

  @ApiProperty({ description: 'Amount to refund (must be ≤ original amount)' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Reason for the refund (stored in audit log)' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ enum: RefundInitiatedBy, default: RefundInitiatedBy.ADMIN })
  @IsOptional()
  @IsEnum(RefundInitiatedBy)
  initiatedBy?: RefundInitiatedBy;
}

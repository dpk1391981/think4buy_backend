import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsBoolean,
  IsString,
  Length,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GatewayName, GatewayStatus } from '../entities/payment-gateway.entity';

export class CreateGatewayDto {
  @ApiProperty({ enum: GatewayName })
  @IsEnum(GatewayName)
  name: GatewayName;

  @ApiProperty({ example: 'Razorpay (Production)' })
  @IsString()
  @Length(2, 100)
  displayName: string;

  @ApiProperty({
    description: 'Gateway credentials (will be AES-256 encrypted at rest)',
    examples: {
      razorpay: { value: { keyId: 'rzp_live_xxx', keySecret: 'yyy', webhookSecret: 'zzz' } },
      stripe:   { value: { publishableKey: 'pk_live_xxx', secretKey: 'sk_live_yyy', webhookSecret: 'whsec_zzz' } },
    },
  })
  @IsObject()
  config: Record<string, string>;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;
}

export class UpdateGatewayDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 100)
  displayName?: string;

  @ApiPropertyOptional({ enum: GatewayStatus })
  @IsOptional()
  @IsEnum(GatewayStatus)
  status?: GatewayStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;
}

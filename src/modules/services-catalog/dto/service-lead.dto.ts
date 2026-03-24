import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MaxLength,
  Matches,
  IsIn,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateServiceLeadDto {
  @ApiProperty({ description: 'Service catalog ID' })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ description: 'Contact name', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({ description: 'Mobile number (10 digits)', example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\D/g, '').slice(-10) : value,
  )
  phone: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ description: 'City or state', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ description: 'Specific interest / requirement', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  interest?: string;

  @ApiPropertyOptional({ description: 'Additional message' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ enum: ['web', 'mobile'], default: 'web' })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  source?: string;
}

export class UpdateServiceLeadDto {
  @ApiPropertyOptional({ enum: ['new', 'contacted', 'closed'] })
  @IsOptional()
  @IsIn(['new', 'contacted', 'closed'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

export class ServiceLeadsQueryDto {
  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsIn(['new', 'contacted', 'closed'])
  status?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

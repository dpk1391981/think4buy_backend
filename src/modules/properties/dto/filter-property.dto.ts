import { IsOptional, IsEnum, IsNumber, IsString, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PropertyType,
  PropertyCategory,
  FurnishingStatus,
  PossessionStatus,
  PropertyStatus,
} from '../entities/property.entity';

export class FilterPropertyDto {
  @ApiPropertyOptional({ enum: PropertyCategory })
  @IsOptional()
  @IsEnum(PropertyCategory)
  category?: PropertyCategory;

  @ApiPropertyOptional({ enum: PropertyType, isArray: true })
  @IsOptional()
  type?: PropertyType | PropertyType[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minArea?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxArea?: number;

  @ApiPropertyOptional()
  @IsOptional()
  bedrooms?: string; // "1,2,3,4+"

  @ApiPropertyOptional({ enum: FurnishingStatus })
  @IsOptional()
  @IsEnum(FurnishingStatus)
  furnishingStatus?: FurnishingStatus;

  @ApiPropertyOptional({ enum: PossessionStatus })
  @IsOptional()
  @IsEnum(PossessionStatus)
  possessionStatus?: PossessionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isNewProject?: boolean;

  @ApiPropertyOptional({ enum: PropertyStatus })
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by agent/owner ID' })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 12;

  @ApiPropertyOptional({ default: 'createdAt', enum: ['createdAt', 'price', 'area', 'viewCount'] })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

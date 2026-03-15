import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PropertyType,
  PropertyCategory,
  FurnishingStatus,
  PossessionStatus,
} from '../entities/property.entity';

export class CreatePropertyDto {
  @ApiProperty({ example: '3 BHK Apartment in Bandra West' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Beautiful 3 BHK apartment...' })
  @IsString()
  description: string;

  @ApiProperty({ enum: PropertyType })
  @IsEnum(PropertyType)
  type: PropertyType;

  @ApiProperty({ enum: PropertyCategory })
  @IsEnum(PropertyCategory)
  category: PropertyCategory;

  @ApiProperty({ example: 15000000 })
  @IsNumber()
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ example: 'total' })
  @IsOptional()
  @IsString()
  priceUnit?: string;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  area?: number;

  @ApiPropertyOptional({ example: 'sqft' })
  @IsOptional()
  @IsString()
  areaUnit?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  bathrooms?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  balconies?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalFloors?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  floorNumber?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  parkingSpots?: number;

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
  @IsDateString()
  possessionDate?: string;

  @ApiProperty({ example: 'Mumbai' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'uuid-of-city-record' })
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional({ example: 'Maharashtra' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'uuid-of-state-record' })
  @IsOptional()
  @IsString()
  stateId?: string;

  @ApiProperty({ example: 'Bandra West' })
  @IsString()
  locality: string;

  @ApiPropertyOptional({ example: 'uuid-of-location-record' })
  @IsOptional()
  @IsString()
  localityId?: string;

  @ApiPropertyOptional({ example: 'Oberoi Splendor' })
  @IsOptional()
  @IsString()
  society?: string;

  @ApiPropertyOptional({ example: '123 Main Street' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '400050' })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ example: 19.054 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ example: 72.842 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ example: 'P52100012345' })
  @IsOptional()
  @IsString()
  reraNumber?: string;

  @ApiPropertyOptional({ example: 'Oberoi Realty' })
  @IsOptional()
  @IsString()
  builderName?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  propertyAge?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  amenityIds?: string[];

  @ApiPropertyOptional({ description: 'AgentProfile ID (for agent listings — auto-set by backend)' })
  @IsOptional()
  @IsString()
  agentProfileId?: string;

  @ApiPropertyOptional({ description: 'Agency ID (for agent listings — auto-set by backend)' })
  @IsOptional()
  @IsString()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Save as draft — skips quota check and approval workflow' })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}

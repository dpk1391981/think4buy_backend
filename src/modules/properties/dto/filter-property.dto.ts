import { IsOptional, IsEnum, IsNumber, IsString, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PropertyType,
  PropertyCategory,
  FurnishingStatus,
  PossessionStatus,
  PropertyStatus,
  ListingUserType,
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
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

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
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isPremium?: boolean;

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

  @ApiPropertyOptional({ description: 'Full-text search across title, locality, society, city' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Smart NLP keyword search e.g. "2 BHK in Noida under 50 lakh"' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Filter by agent/owner user ID' })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Filter by amenity IDs (comma-separated)', example: 'id1,id2,id3' })
  @IsOptional()
  @IsString()
  amenityIds?: string;

  @ApiPropertyOptional({ enum: ListingUserType, description: 'Posted by: owner, agent, builder' })
  @IsOptional()
  @IsEnum(ListingUserType)
  listedBy?: ListingUserType;

  @ApiPropertyOptional({ description: 'Filter by builder/developer name' })
  @IsOptional()
  @IsString()
  builderName?: string;

  // ── Geo radius search (Near Me / landmark) ───────────────────────────────
  @ApiPropertyOptional({ description: 'Center latitude for radius-based geo search' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ description: 'Center longitude for radius-based geo search' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ description: 'Search radius in km (default 5)', default: 5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  radius?: number;

  // Geo bounding box search (for map view)
  @ApiPropertyOptional({ description: 'Minimum latitude for bounding box search' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minLat?: number;

  @ApiPropertyOptional({ description: 'Maximum latitude for bounding box search' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxLat?: number;

  @ApiPropertyOptional({ description: 'Minimum longitude for bounding box search' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minLng?: number;

  @ApiPropertyOptional({ description: 'Maximum longitude for bounding box search' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxLng?: number;

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

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: ['createdAt', 'price', 'area', 'viewCount', 'trending', 'relevance'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ description: 'Filter trending properties (isTrending = true)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isTrending?: boolean;

  @ApiPropertyOptional({ description: 'Filter properties by top agents (gold/silver/bronze/verified tick)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  topAgent?: boolean;

  @ApiPropertyOptional({ description: 'Filter properties with zero brokerage (brokerage = "0")' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  zeroBrokerage?: boolean;
}

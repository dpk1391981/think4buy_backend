import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAgentDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() company?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() stateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentLicense?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentBio?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() agentExperience?: number;
  @ApiPropertyOptional({ default: 100 }) @IsOptional() @IsInt() @Min(0) agentFreeQuota?: number;
}

export class UpdateAgentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() company?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() stateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentLicense?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentBio?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() agentExperience?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) agentFreeQuota?: number;
  @ApiPropertyOptional({ enum: ['none', 'verified', 'bronze', 'silver', 'gold'] })
  @IsOptional() @IsEnum(['none', 'verified', 'bronze', 'silver', 'gold']) agentTick?: 'none' | 'verified' | 'bronze' | 'silver' | 'gold';
}

export class UpdateAgentQuotaDto {
  @ApiProperty() @IsInt() @Min(0) agentFreeQuota: number;
}

export class RejectPropertyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

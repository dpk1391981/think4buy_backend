import { IsEmail, IsString, MinLength, IsOptional, IsEnum, Length, Matches, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

// Only OWNER and AGENT roles are allowed during public registration.
// BUYER is for search-only users (registered via OTP flow).
// ADMIN is system-only and cannot be self-registered.
const ALLOWED_REGISTRATION_ROLES = [UserRole.OWNER, UserRole.AGENT] as const;

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    enum: ALLOWED_REGISTRATION_ROLES,
    default: UserRole.OWNER,
    description: 'Only "owner" or "agent" allowed during registration',
  })
  @IsOptional()
  @IsEnum(ALLOWED_REGISTRATION_ROLES, {
    message: 'role must be either "owner" or "agent"',
  })
  role?: UserRole.OWNER | UserRole.AGENT;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

export class SendOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class OnboardingDto {
  @ApiProperty({ enum: ['buyer', 'owner', 'agent'], description: 'Role chosen during onboarding' })
  @IsEnum(['buyer', 'owner', 'agent'], { message: 'Role must be buyer, owner, or agent' })
  role: 'buyer' | 'owner' | 'agent';

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'MH-AG-12345' })
  @IsOptional()
  @IsString()
  agentLicense?: string;

  @ApiPropertyOptional({ example: '27AAPFU0939F1ZV' })
  @IsOptional()
  @IsString()
  agentGstNumber?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  agentExperience?: number;

  /** Company / agency name — when provided for agents, a pending agency record is created */
  @ApiPropertyOptional({ example: 'PropElite Realty' })
  @IsOptional()
  @IsString()
  agencyName?: string;

  /** Agent business contact phone */
  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  /** Agent business address */
  @ApiPropertyOptional({ example: '12, MG Road, Bangalore' })
  @IsOptional()
  @IsString()
  businessAddress?: string;
}

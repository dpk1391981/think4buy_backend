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

  // ── Agent professional fields ──────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'MH/RERA/A12345' })
  @IsOptional()
  @IsString()
  agentLicense?: string;

  @ApiPropertyOptional({ example: '27AAPFU0939F1ZV' })
  @IsOptional()
  @IsString()
  agentGstNumber?: string;

  /** PAN stored in agentBio as structured prefix; pure optional KYC capture */
  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  agentPan?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  agentExperience?: number;

  /** Company / agency name — creates a pending agency record when provided */
  @ApiPropertyOptional({ example: 'PropElite Realty Pvt Ltd' })
  @IsOptional()
  @IsString()
  agencyName?: string;

  /** Agent business contact phone */
  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  /** Agent business address */
  @ApiPropertyOptional({ example: '12, MG Road, Bangalore 560001' })
  @IsOptional()
  @IsString()
  businessAddress?: string;

  /** Business type: individual | firm | pvt_ltd | llp | partnership */
  @ApiPropertyOptional({ example: 'pvt_ltd' })
  @IsOptional()
  @IsString()
  businessType?: string;

  /** Comma-separated specializations e.g. "Residential,Commercial,Plots" */
  @ApiPropertyOptional({ example: 'Residential,Commercial' })
  @IsOptional()
  @IsString()
  agentSpecializations?: string;

  /** Comma-separated spoken languages e.g. "Hindi,English,Marathi" */
  @ApiPropertyOptional({ example: 'Hindi,English' })
  @IsOptional()
  @IsString()
  agentLanguages?: string;

  /** Office opening time e.g. "09:00" */
  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  officeStartTime?: string;

  /** Office closing time e.g. "19:00" */
  @ApiPropertyOptional({ example: '19:00' })
  @IsOptional()
  @IsString()
  officeEndTime?: string;

  /** Comma-separated working days e.g. "Mon,Tue,Wed,Thu,Fri,Sat" */
  @ApiPropertyOptional({ example: 'Mon,Tue,Wed,Thu,Fri,Sat' })
  @IsOptional()
  @IsString()
  workingDays?: string;

  /** Agent / agency website */
  @ApiPropertyOptional({ example: 'https://propelite.in' })
  @IsOptional()
  @IsString()
  agentWebsite?: string;

  // ── Buyer preference fields (captured at onboarding for instant personalisation) ──

  /** Preferred city name for buyers */
  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional()
  @IsString()
  buyerCity?: string;

  /** Preferred city ID for buyers */
  @ApiPropertyOptional({ example: 'uuid-city-id' })
  @IsOptional()
  @IsString()
  buyerCityId?: string;

  /** Buyer minimum budget in rupees */
  @ApiPropertyOptional({ example: 5000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  buyerBudgetMin?: number;

  /** Buyer maximum budget in rupees */
  @ApiPropertyOptional({ example: 15000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  buyerBudgetMax?: number;

  /** Buyer preferred property types — comma-separated e.g. "apartment,villa" */
  @ApiPropertyOptional({ example: 'apartment,villa' })
  @IsOptional()
  @IsString()
  buyerPropertyTypes?: string;

  /** Purpose: buy | rent */
  @ApiPropertyOptional({ example: 'buy' })
  @IsOptional()
  @IsString()
  buyerPurpose?: string;

  // ── Owner listing intent (captured at onboarding to pre-fill post-property) ──

  /** Property type owner wants to list */
  @ApiPropertyOptional({ example: 'apartment' })
  @IsOptional()
  @IsString()
  ownerPropertyType?: string;

  /** Listing type: sale | rent */
  @ApiPropertyOptional({ example: 'sale' })
  @IsOptional()
  @IsString()
  ownerListingType?: string;
}

import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ConsentSource } from '../entities/cookie-consent.entity';

export class SaveConsentDto {
  /** Anonymous session ID — required if user is not authenticated. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sessionId?: string;

  @IsBoolean()
  personalization: boolean;

  @IsBoolean()
  analytics: boolean;

  @IsBoolean()
  marketing: boolean;

  /** Which UI element triggered this consent save. */
  @IsOptional()
  @IsEnum(ConsentSource)
  source?: ConsentSource;

  /** Policy version the user consented to. Sent from the frontend constant. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  consentVersion?: string;
}

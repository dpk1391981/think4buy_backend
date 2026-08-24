import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type OtpPurpose = 'login';

/**
 * Delivery channel for the OTP.
 *
 * `sms` rows are keyed on `phone`, `email` rows on `email` — exactly one of the
 * two is ever populated. SMS is gated behind the ENABLE_MOBILE_OTP system-config
 * flag (off until DLT approval), so `email` is the only live channel at launch.
 */
export type OtpChannel = 'sms' | 'email';

@Entity('otp_verifications')
@Index('idx_otp_phone_purpose', ['phone', 'purpose'])
@Index('idx_otp_email_purpose', ['email', 'purpose'])
export class OtpVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Populated for `sms` channel rows only */
  @Column({ length: 20, nullable: true })
  phone: string | null;

  /** Populated for `email` channel rows only — lower-cased before write */
  @Column({ length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 10, default: 'sms' })
  channel: OtpChannel;

  /** bcrypt hash of the OTP — never store plaintext */
  @Column({ length: 60 })
  otpHash: string;

  @Column({ type: 'varchar', length: 20, default: 'login' })
  purpose: OtpPurpose;

  /** Number of failed verify attempts on this entry */
  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** UTC timestamp after which this OTP is invalid */
  @Column({ type: 'datetime' })
  expiresAt: Date;

  /** True once successfully verified — prevents reuse */
  @Column({ type: 'boolean', default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

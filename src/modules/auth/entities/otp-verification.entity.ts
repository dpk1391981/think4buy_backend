import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type OtpPurpose = 'login';

@Entity('otp_verifications')
@Index('idx_otp_phone_purpose', ['phone', 'purpose'])
export class OtpVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20 })
  phone: string;

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

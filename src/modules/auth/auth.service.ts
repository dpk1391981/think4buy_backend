import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { OtpVerification } from './entities/otp-verification.entity';
import { RegisterDto, LoginDto, SendOtpDto, VerifyOtpDto, OnboardingDto } from './dto/auth.dto';
import { WalletService } from '../wallet/wallet.service';
import { MenusService } from '../menus/menus.service';
import { AgencyService } from '../agency/agency.service';

/** Max OTP verify attempts before entry is locked */
const OTP_MAX_ATTEMPTS = 5;
/** OTP validity window */
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
/** Max failed login attempts before account lockout */
const MAX_FAILED_ATTEMPTS = 5;
/** Lockout duration in milliseconds (15 minutes) */
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OtpVerification)
    private otpRepo: Repository<OtpVerification>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private walletService: WalletService,
    private menusService: MenusService,
    private agencyService: AgencyService,
  ) {}

  // ── Registration ──────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const allowedRoles = [UserRole.OWNER, UserRole.AGENT];
    if (dto.role && !allowedRoles.includes(dto.role as UserRole)) {
      throw new BadRequestException('Only "owner" or "agent" roles can be self-registered');
    }

    const hashed = await bcrypt.hash(dto.password, 12); // increased to 12 rounds
    const user = this.userRepository.create({
      ...dto,
      role: dto.role ?? UserRole.OWNER,
      password: hashed,
    });
    await this.userRepository.save(user);
    await this.walletService.createWallet(user.id);

    return this.buildAuthResponse(user);
  }

  // ── Login with account lockout ────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });

    // Always run bcrypt even if user not found to prevent timing-based user enumeration
    const dummyHash = '$2a$12$dummyhashforpreventtimingattack00000000000000000000000';
    const passwordToCheck = user?.password ?? dummyHash;
    const valid = await bcrypt.compare(dto.password, passwordToCheck);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException(
        `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      );
    }

    if (!valid) {
      await this.recordFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) throw new ForbiddenException('Account is deactivated');

    // Successful login — reset failure counters
    await this.userRepository.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    return this.buildAuthResponse(user);
  }

  private async recordFailedLogin(user: User) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const update: Partial<User> = { failedLoginAttempts: attempts };

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      update.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    }
    await this.userRepository.update(user.id, update);
  }

  // ── Refresh Token ─────────────────────────────────────────────────────────

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token required');

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET', 'refresh-secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!user || !user.refreshToken) throw new UnauthorizedException('Session expired. Please login again.');

    // Verify the stored hash matches
    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenMatches) throw new UnauthorizedException('Refresh token reuse detected');

    return this.buildAuthResponse(user);
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null });
    return { message: 'Logged out successfully' };
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    return this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id', 'name', 'email', 'phone', 'role', 'isSuperAdmin', 'systemRoleId',
        'avatar', 'pendingAvatar',
        'city', 'company', 'isVerified', 'createdAt', 'lastLoginAt',
        'needsOnboarding', 'agentTick', 'agentLicense', 'agentGstNumber', 'agentBio',
        'agentExperience', 'agentProfileStatus', 'isActive',
      ],
    });
  }

  // ── Onboarding ────────────────────────────────────────────────────────────

  async completeOnboarding(userId: string, dto: OnboardingDto) {
    const update: Partial<User> = {
      role: dto.role as UserRole,
      needsOnboarding: false,
    };
    if (dto.name?.trim()) update.name = dto.name.trim();
    if (dto.agentLicense?.trim()) update.agentLicense = dto.agentLicense.trim();
    if ((dto as any).agentGstNumber?.trim()) (update as any).agentGstNumber = (dto as any).agentGstNumber.trim();
    if (dto.agentExperience != null) update.agentExperience = dto.agentExperience;
    if (dto.agencyName?.trim()) update.company = dto.agencyName.trim();
    if (dto.contactPhone?.trim()) update.phone = dto.contactPhone.trim();

    await this.userRepository.update(userId, update);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    // For agents: ensure AgentProfile exists + create pending Agency if company provided
    if (dto.role === 'agent') {
      if (dto.agencyName?.trim()) {
        // Creates pending agency + links agent profile
        await this.agencyService.agentRegisterOrJoinAgency(userId, {
          agencyName: dto.agencyName.trim(),
        });
      } else {
        // Always create an AgentProfile so the agent appears in admin panel
        await this.agencyService.getOrCreateAgentProfile(userId);
      }
    }

    return this.buildAuthResponse(user);
  }

  async updateProfile(userId: string, dto: {
    name?: string; email?: string; city?: string; company?: string;
    phone?: string; agentLicense?: string; agentGstNumber?: string; agentBio?: string; agentExperience?: number;
  }) {
    const isProfessionalUpdate = dto.agentLicense !== undefined || dto.agentBio !== undefined || dto.agentExperience !== undefined || dto.agentGstNumber !== undefined;
    const update: any = { ...dto };
    if (isProfessionalUpdate) {
      // Only set pending if not already approved
      const current = await this.userRepository.findOne({ where: { id: userId }, select: ['agentProfileStatus', 'role'] });
      if (current?.role === UserRole.AGENT && current?.agentProfileStatus !== 'inactive') {
        update.agentProfileStatus = 'pending';
      }
    }
    await this.userRepository.update(userId, update);
    return this.getProfile(userId);
  }

  /** Allows a BUYER to upgrade their role to OWNER or AGENT */
  async upgradeRole(userId: string, newRole: 'owner' | 'agent') {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.role !== UserRole.BUYER) {
      throw new BadRequestException('Role upgrade is only available for buyers');
    }
    if (newRole !== 'owner' && newRole !== 'agent') {
      throw new BadRequestException('Role must be either "owner" or "agent"');
    }

    user.role = newRole as UserRole;
    await this.userRepository.save(user);
    return this.buildAuthResponse(user);
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    // Agents: put upload into pending queue — admin must approve before it goes live
    if (user?.role === UserRole.AGENT) {
      await this.userRepository.update(userId, { pendingAvatar: avatarUrl });
    } else {
      await this.userRepository.update(userId, { avatar: avatarUrl });
    }
    return this.getProfile(userId);
  }

  // ── OTP ───────────────────────────────────────────────────────────────────

  async sendOtp(dto: SendOtpDto) {
    // Rate-limit: block if a non-expired, non-used OTP was sent within the last 60 seconds
    const recent = await this.otpRepo.findOne({
      where: { phone: dto.phone, purpose: 'login', used: false },
      order: { createdAt: 'DESC' },
    });
    if (recent && !recent.used && recent.expiresAt > new Date()) {
      const secondsSince = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (secondsSince < 60) {
        throw new BadRequestException(`Please wait ${Math.ceil(60 - secondsSince)}s before requesting a new OTP.`);
      }
    }

    const plainOtp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const otpHash  = await bcrypt.hash(plainOtp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Invalidate previous unused entries for this phone
    await this.otpRepo.delete({ phone: dto.phone, purpose: 'login', used: false });

    await this.otpRepo.save(
      this.otpRepo.create({ phone: dto.phone, otpHash, purpose: 'login', expiresAt }),
    );

    // TODO production: send SMS via MSG91 / Twilio
    console.log(`[OTP] Phone: ${dto.phone}  OTP: ${plainOtp}`);

    const isNew = !(await this.userRepository.findOne({ where: { phone: dto.phone } }));
    return {
      message: 'OTP sent successfully',
      isNewUser: isNew,
      ...(process.env.NODE_ENV !== 'production' && { devOtp: plainOtp }),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const entry = await this.otpRepo.findOne({
      where: { phone: dto.phone, purpose: 'login', used: false },
      order: { createdAt: 'DESC' },
    });

    if (!entry) throw new BadRequestException('OTP not sent or expired. Please request a new OTP.');

    if (entry.expiresAt < new Date()) {
      await this.otpRepo.delete(entry.id);
      throw new BadRequestException('OTP expired. Please request a new one.');
    }

    // Increment attempt counter first (prevents race condition abuse)
    entry.attempts += 1;
    await this.otpRepo.save(entry);

    if (entry.attempts > OTP_MAX_ATTEMPTS) {
      await this.otpRepo.delete(entry.id);
      throw new BadRequestException('Too many OTP attempts. Please request a new OTP.');
    }

    const isMatch = await bcrypt.compare(dto.otp, entry.otpHash);
    if (!isMatch) throw new BadRequestException('Invalid OTP. Please try again.');

    // Mark as used (soft-delete — keeps audit trail)
    entry.used = true;
    await this.otpRepo.save(entry);

    let user = await this.userRepository.findOne({ where: { phone: dto.phone } });
    const isNewUser = !user;

    if (!user) {
      user = this.userRepository.create({
        phone:            dto.phone,
        name:             dto.name || `User${dto.phone.slice(-4)}`,
        email:            `${dto.phone}@t4bs.local`,
        password:         await bcrypt.hash(Math.random().toString(36), 12),
        role:             UserRole.BUYER,
        isVerified:       true,
        isActive:         true,
        needsOnboarding:  true,  // prompt role selection on first login
      });
      await this.userRepository.save(user);
      await this.walletService.createWallet(user.id);
    }

    if (!user.isActive) throw new ForbiddenException('Account is deactivated.');

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    const authResponse = await this.buildAuthResponse(user);
    return { ...authResponse, isNewUser };
  }

  /** Purge expired/used OTP rows — call via a cron or admin job */
  async cleanupExpiredOtps(): Promise<number> {
    const result = await this.otpRepo
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now OR used = true', { now: new Date() })
      .execute();
    return result.affected ?? 0;
  }

  // ── Token Generation ──────────────────────────────────────────────────────

  private generateAccessToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret:    this.configService.get('JWT_SECRET', 'secret'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
      },
    );
  }

  private generateRefreshToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id },
      {
        secret:    this.configService.get('JWT_REFRESH_SECRET', 'refresh-secret'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );
  }

  private async buildAuthResponse(user: User) {
    const accessToken  = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store hashed refresh token in DB (rotation invalidates previous sessions)
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(user.id, { refreshToken: hashedRefresh });

    const { password, refreshToken: _rt, failedLoginAttempts: _fa, lockedUntil: _lu, ...safeUser } = user as any;

    // Fetch role-based menus for dynamic sidebar rendering
    const menus = await this.menusService.getMenusForRole(user.role);

    // `token` is an alias for `accessToken` kept for backward compatibility with frontend consumers
    return { user: safeUser, token: accessToken, accessToken, refreshToken, menus };
  }
}

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { OtpVerification } from './entities/otp-verification.entity';
import {
  RegisterDto,
  LoginDto,
  SendOtpDto,
  VerifyOtpDto,
  OnboardingDto,
  SendEmailOtpDto,
  VerifyEmailOtpDto,
} from './dto/auth.dto';
import { WalletService } from '../wallet/wallet.service';
import { MenusService } from '../menus/menus.service';
import { AgencyService } from '../agency/agency.service';
import { MessagingService } from '../messaging/messaging.service';
import { SystemConfigService } from '../system-config/system-config.service';

/** Max OTP verify attempts before entry is locked */
const OTP_MAX_ATTEMPTS = 5;
/** OTP validity window */
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
/** Max failed login attempts before account lockout */
const MAX_FAILED_ATTEMPTS = 5;
/**
 * Sentinel written to `users.password` for accounts created through an OTP flow,
 * which never chose a password. The column is NOT NULL, so a marker is needed
 * rather than null. It is deliberately not a valid bcrypt hash — `bcrypt.compare`
 * returns false for any input against it, so such an account can never be
 * password-logged-in, and `hasPassword` on the email-status lookup can tell the
 * auth page to offer OTP instead of a password box.
 */
const OTP_ONLY_PASSWORD = '__otp_only__';
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
    private messagingService: MessagingService,
    private systemConfig: SystemConfigService,
  ) {}

  // ── Registration ──────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    // Normalised before the duplicate check, not just before the insert —
    // looking up the raw address lets "John@X.com" slip past a stored
    // "john@x.com" and fail later on the unique index as a 500.
    const email = dto.email.trim().toLowerCase();

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    // Mirrors ALLOWED_REGISTRATION_ROLES in auth.dto.ts. BUYER is self-service
    // now that the consolidated /auth page offers a password signup to
    // search-only users; ADMIN stays system-only.
    const allowedRoles = [UserRole.OWNER, UserRole.AGENT, UserRole.BUYER];
    if (dto.role && !allowedRoles.includes(dto.role as UserRole)) {
      throw new BadRequestException(
        'Only "owner", "agent" or "buyer" roles can be self-registered',
      );
    }

    const hashed = await bcrypt.hash(dto.password, 12); // increased to 12 rounds
    const user = this.userRepository.create({
      ...dto,
      email,
      role: dto.role ?? UserRole.OWNER,
      password: hashed,
      isVerified: false, // flipped by verifyEmailOtp
    });
    await this.userRepository.save(user);
    await this.walletService.createWallet(user.id);
    await this.walletService.assignDefaultPlan(user.id);

    // Registration does not hand out tokens — the address has to be proven first.
    // The account exists but stays unverified until the emailed OTP is entered,
    // which is what stops signups against addresses the person doesn't control.
    const delivery = await this.dispatchEmailOtpTolerant(user.email);

    return {
      requiresVerification: true,
      email: user.email,
      message: 'Account created. Enter the verification code sent to your email.',
      ...delivery,
    };
  }

  // ── Login with account lockout ────────────────────────────────────────────

  async login(dto: LoginDto) {
    // Addresses are stored lower-cased, so the lookup has to normalise too —
    // otherwise "John@X.com" fails against its own account.
    const user = await this.userRepository.findOne({
      where: { email: dto.email.trim().toLowerCase() },
    });

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

    // Verify-first gate for accounts registered under the email-OTP flow.
    //
    // Scoped to accounts that are unverified AND have never logged in. Without
    // the `lastLoginAt` half, every pre-existing account would be caught:
    // `isVerified` has never been enforced at login in this codebase, so
    // established users carry it as false and would all be pushed through an
    // OTP they never needed. With it, the only accounts affected are ones that
    // registered and never got in — exactly the case that must not be able to
    // skip verification by going straight to the password box.
    if (!user.isVerified && !user.lastLoginAt) {
      const delivery = await this.dispatchEmailOtpTolerant(user.email);
      return {
        requiresVerification: true,
        email: user.email,
        message: 'Please verify your email. A verification code has been sent.',
        ...delivery,
      };
    }

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
    if (dto.agentGstNumber?.trim()) update.agentGstNumber = dto.agentGstNumber.trim();
    if (dto.agentExperience != null) update.agentExperience = dto.agentExperience;
    if (dto.agencyName?.trim()) update.company = dto.agencyName.trim();
    if (dto.contactPhone?.trim()) update.phone = dto.contactPhone.trim();

    // Buyer: store city preference
    if (dto.role === 'buyer') {
      if (dto.buyerCity?.trim()) update.city = dto.buyerCity.trim();
      if (dto.buyerCityId?.trim()) update.cityId = dto.buyerCityId.trim();
    }

    // Agent: build rich bio from extended profile fields
    if (dto.role === 'agent') {
      const bioMeta: Record<string, string> = {};
      if (dto.agentPan?.trim())             bioMeta.pan             = dto.agentPan.trim().toUpperCase();
      if (dto.businessType?.trim())         bioMeta.businessType    = dto.businessType.trim();
      if (dto.agentSpecializations?.trim()) bioMeta.specializations = dto.agentSpecializations.trim();
      if (dto.agentLanguages?.trim())       bioMeta.languages       = dto.agentLanguages.trim();
      if (dto.officeStartTime?.trim())      bioMeta.officeStart     = dto.officeStartTime.trim();
      if (dto.officeEndTime?.trim())        bioMeta.officeEnd       = dto.officeEndTime.trim();
      if (dto.workingDays?.trim())          bioMeta.workingDays     = dto.workingDays.trim();
      if (dto.agentWebsite?.trim())         bioMeta.website         = dto.agentWebsite.trim();
      if (Object.keys(bioMeta).length) {
        // Prefix structured metadata so it can be parsed without a schema change
        update.agentBio = `__meta__:${JSON.stringify(bioMeta)}`;
      }
    }

    await this.userRepository.update(userId, update);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    // For agents: ensure AgentProfile exists + create pending Agency if company provided
    if (dto.role === 'agent') {
      if (dto.agencyName?.trim()) {
        await this.agencyService.agentRegisterOrJoinAgency(userId, {
          agencyName: dto.agencyName.trim(),
        });
      } else {
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

  /** Update agent company / professional details — merges meta JSON in agentBio */
  async updateAgentCompany(userId: string, dto: {
    agencyName?: string;
    agentLicense?: string;
    agentGstNumber?: string;
    agentExperience?: number;
    phone?: string;
    pan?: string;
    businessType?: string;
    specializations?: string;
    languages?: string;
    officeStart?: string;
    officeEnd?: string;
    workingDays?: string;
    website?: string;
    docRera?: string;
    docGst?: string;
    docPan?: string;
  }) {
    // Read current bio to merge meta (don't overwrite existing keys unless provided)
    const current = await this.userRepository.findOne({
      where: { id: userId },
      select: ['agentBio', 'agentProfileStatus', 'role'],
    });

    let existingMeta: Record<string, string> = {};
    if (current?.agentBio?.startsWith('__meta__:')) {
      try { existingMeta = JSON.parse(current.agentBio.slice(9)); } catch {}
    }

    const newMeta: Record<string, string> = { ...existingMeta };
    if (dto.pan?.trim())             newMeta.pan             = dto.pan.trim().toUpperCase();
    if (dto.businessType?.trim())    newMeta.businessType    = dto.businessType.trim();
    if (dto.specializations?.trim()) newMeta.specializations = dto.specializations.trim();
    if (dto.languages?.trim())       newMeta.languages       = dto.languages.trim();
    if (dto.officeStart?.trim())     newMeta.officeStart     = dto.officeStart.trim();
    if (dto.officeEnd?.trim())       newMeta.officeEnd       = dto.officeEnd.trim();
    if (dto.workingDays?.trim())     newMeta.workingDays     = dto.workingDays.trim();
    if (dto.website?.trim())         newMeta.website         = dto.website.trim();
    if (dto.docRera?.trim())         newMeta.docRera         = dto.docRera.trim();
    if (dto.docGst?.trim())          newMeta.docGst          = dto.docGst.trim();
    if (dto.docPan?.trim())          newMeta.docPan          = dto.docPan.trim();

    const update: any = { agentBio: `__meta__:${JSON.stringify(newMeta)}` };
    if (dto.agencyName?.trim())          update.company          = dto.agencyName.trim();
    if (dto.agentLicense?.trim())        update.agentLicense     = dto.agentLicense.trim();
    if (dto.agentGstNumber?.trim())      update.agentGstNumber   = dto.agentGstNumber.trim();
    if (dto.agentExperience != null)     update.agentExperience  = dto.agentExperience;
    if (dto.phone?.trim())               update.phone            = dto.phone.trim();

    // Set to pending when professional details are updated (so admin re-reviews)
    if (current?.role === UserRole.AGENT && current?.agentProfileStatus !== 'inactive') {
      update.agentProfileStatus = 'pending';
    }

    await this.userRepository.update(userId, update);
    return this.getProfile(userId);
  }

  /** Store a document URL inside the agentBio meta for the given docType key */
  async saveAgentDocument(userId: string, docType: string, fileUrl: string) {
    const current = await this.userRepository.findOne({
      where: { id: userId },
      select: ['agentBio'],
    });
    let meta: Record<string, string> = {};
    if (current?.agentBio?.startsWith('__meta__:')) {
      try { meta = JSON.parse(current.agentBio.slice(9)); } catch {}
    }
    meta[`doc${docType.charAt(0).toUpperCase()}${docType.slice(1)}`] = fileUrl;
    await this.userRepository.update(userId, { agentBio: `__meta__:${JSON.stringify(meta)}` });
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
    // All users: upload goes into pending queue — super admin must approve before it goes live
    await this.userRepository.update(userId, { pendingAvatar: avatarUrl });
    return this.getProfile(userId);
  }

  // ── Auth capability advertisement ─────────────────────────────────────────

  /**
   * What the auth UI is allowed to offer. Read by the /auth page on load so the
   * mobile-number path is never rendered while DLT approval is outstanding —
   * the server-side gate in `sendOtp` is the real enforcement, this just keeps
   * the UI from advertising a door that is locked.
   */
  async getAuthConfig() {
    return {
      mobileOtpEnabled: await this.systemConfig.getBoolean('ENABLE_MOBILE_OTP', false),
      emailOtpEnabled:  await this.systemConfig.getBoolean('ENABLE_EMAIL_OTP', true),
      passwordEnabled:  true,
    };
  }

  // ── OTP ───────────────────────────────────────────────────────────────────

  async sendOtp(dto: SendOtpDto) {
    // Mobile OTP stays dark until the DLT template registration is approved.
    // Flip ENABLE_MOBILE_OTP in system config to switch it on — no redeploy.
    const mobileOtpEnabled = await this.systemConfig.getBoolean('ENABLE_MOBILE_OTP', false);
    if (!mobileOtpEnabled) {
      throw new BadRequestException(
        'Mobile OTP login is currently unavailable. Please continue with your email address.',
      );
    }

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
    await this.otpRepo.delete({ phone: dto.phone, channel: 'sms', purpose: 'login', used: false });

    await this.otpRepo.save(
      this.otpRepo.create({ phone: dto.phone, channel: 'sms', otpHash, purpose: 'login', expiresAt }),
    );

    // Send OTP via SMS if ENABLE_OTP_SMS is toggled on in system config
    const smsEnabled = await this.systemConfig.getBoolean('ENABLE_OTP_SMS', false);
    if (smsEnabled) {
      await this.messagingService.sendOtpSms(dto.phone, plainOtp);
    } else {
      // Dev/fallback: log to console only (OTP visible in server logs + devOtp in response below)
      console.log(`[OTP] Phone: ${dto.phone}  OTP: ${plainOtp}`);
    }

    const isNew = !(await this.userRepository.findOne({ where: { phone: dto.phone } }));
    return {
      message: 'OTP sent successfully',
      isNewUser: isNew,
      ...(process.env.NODE_ENV !== 'production' && { devOtp: plainOtp }),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const entry = await this.otpRepo.findOne({
      where: { phone: dto.phone, channel: 'sms', purpose: 'login', used: false },
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
      await this.walletService.assignDefaultPlan(user.id);
    }

    if (!user.isActive) throw new ForbiddenException('Account is deactivated.');

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    const authResponse = await this.buildAuthResponse(user);
    return { ...authResponse, isNewUser };
  }

  // ── Email OTP ─────────────────────────────────────────────────────────────

  /**
   * Tells the auth page which box to render next for a given address, without
   * requiring a password guess to find out. `exists` is intentionally exposed —
   * a signup form that rejects duplicates already reveals it, so hiding it here
   * would buy nothing while making the flow guess wrong half the time.
   */
  async getEmailStatus(email: string) {
    const normalised = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalised },
      select: ['id', 'name', 'password', 'isVerified', 'isActive', 'lastLoginAt'],
    });

    if (!user) {
      return { exists: false, hasPassword: false, isVerified: false, name: null };
    }

    return {
      exists:      true,
      hasPassword: user.password !== OTP_ONLY_PASSWORD,
      // Mirrors the login gate — lets the page jump straight to the OTP step
      // instead of asking for a password it is about to reject.
      isVerified:  user.isVerified || !!user.lastLoginAt,
      name:        user.name ?? null,
    };
  }

  /**
   * Like `dispatchEmailOtp`, but treats the 60s resend throttle as success.
   *
   * Used by the paths where sending a code is a side effect of another action
   * (registering, or a password login that hits the verify-first gate) rather
   * than something the visitor asked for. There, a cooldown must not become an
   * error: the outstanding code is still live and still the thing they need to
   * enter, so the caller should reach the verify screen either way. Only an
   * explicit "resend" should ever surface the wait.
   */
  private async dispatchEmailOtpTolerant(email: string) {
    try {
      return await this.dispatchEmailOtp(email);
    } catch (err) {
      if (err instanceof BadRequestException) {
        return {
          otpSentTo: this.maskEmail(email.trim().toLowerCase()),
          throttled: true,
        };
      }
      throw err; // a real delivery failure still has to surface
    }
  }

  /**
   * Issues a fresh email OTP for `email`, replacing any outstanding one.
   *
   * Shared by registration, the verify-first login gate, and OTP-only login, so
   * all three paths get identical throttling, storage and delivery semantics.
   * Returns the delivery outcome for the caller to fold into its own response.
   */
  private async dispatchEmailOtp(email: string) {
    const normalised = email.trim().toLowerCase();

    // Rate-limit: block if a live OTP for this address was issued < 60s ago
    const recent = await this.otpRepo.findOne({
      where: { email: normalised, channel: 'email', purpose: 'login', used: false },
      order: { createdAt: 'DESC' },
    });
    if (recent && recent.expiresAt > new Date()) {
      const secondsSince = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (secondsSince < 60) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(60 - secondsSince)}s before requesting a new code.`,
        );
      }
    }

    const plainOtp  = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const otpHash   = await bcrypt.hash(plainOtp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Invalidate previous unused entries for this address
    await this.otpRepo.delete({ email: normalised, channel: 'email', purpose: 'login', used: false });

    await this.otpRepo.save(
      this.otpRepo.create({ email: normalised, channel: 'email', otpHash, purpose: 'login', expiresAt }),
    );

    const emailOtpEnabled = await this.systemConfig.getBoolean('ENABLE_EMAIL_OTP', true);
    const isProd = process.env.NODE_ENV === 'production';

    if (emailOtpEnabled) {
      const result = await this.messagingService.sendOtpEmail(normalised, plainOtp);
      // In production a failed send is a dead end for the user — email is the
      // only channel while mobile OTP is off, so it surfaces rather than
      // reporting a success that never arrives. Outside production the code is
      // returned in `devOtp` below, so the flow stays testable without SMTP.
      if (!result.success && isProd) {
        throw new ServiceUnavailableException(
          'We could not send your verification code right now. Please try again in a moment.',
        );
      }
      if (!result.success) {
        console.log(`[OTP EMAIL] ${normalised}  OTP: ${plainOtp}  (send failed: ${result.error})`);
      }
    } else {
      console.log(`[OTP EMAIL] ${normalised}  OTP: ${plainOtp}  (email OTP disabled)`);
    }

    return {
      otpSentTo: this.maskEmail(normalised),
      ...(!isProd && { devOtp: plainOtp }),
    };
  }

  /** `john.doe@example.com` → `jo****@example.com` — safe to echo back to the client */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const head = local.slice(0, 2);
    return `${head}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
  }

  /** Public entry point for "email me a code" — used for OTP-only login and resends */
  async sendEmailOtp(dto: SendEmailOtpDto) {
    const normalised = dto.email.trim().toLowerCase();
    const existing = await this.userRepository.findOne({ where: { email: normalised } });

    if (existing && !existing.isActive) {
      throw new ForbiddenException('Account is deactivated.');
    }

    const delivery = await this.dispatchEmailOtp(normalised);

    return {
      message: 'Verification code sent to your email',
      isNewUser: !existing,
      ...delivery,
    };
  }

  async verifyEmailOtp(dto: VerifyEmailOtpDto) {
    const normalised = dto.email.trim().toLowerCase();

    const entry = await this.otpRepo.findOne({
      where: { email: normalised, channel: 'email', purpose: 'login', used: false },
      order: { createdAt: 'DESC' },
    });

    if (!entry) {
      throw new BadRequestException('Code not sent or already used. Please request a new one.');
    }

    if (entry.expiresAt < new Date()) {
      await this.otpRepo.delete(entry.id);
      throw new BadRequestException('Code expired. Please request a new one.');
    }

    // Increment attempt counter first (prevents race condition abuse)
    entry.attempts += 1;
    await this.otpRepo.save(entry);

    if (entry.attempts > OTP_MAX_ATTEMPTS) {
      await this.otpRepo.delete(entry.id);
      throw new BadRequestException('Too many attempts. Please request a new code.');
    }

    const isMatch = await bcrypt.compare(dto.otp, entry.otpHash);
    if (!isMatch) throw new BadRequestException('Invalid code. Please try again.');

    // Mark as used (soft-delete — keeps audit trail)
    entry.used = true;
    await this.otpRepo.save(entry);

    let user = await this.userRepository.findOne({ where: { email: normalised } });
    const isNewUser = !user;

    if (!user) {
      // OTP-only signup: no password was ever chosen, so the sentinel goes in
      // and the account is steered through onboarding to pick a role.
      user = this.userRepository.create({
        email:           normalised,
        name:            dto.name?.trim() || normalised.split('@')[0],
        password:        OTP_ONLY_PASSWORD,
        role:            UserRole.BUYER,
        isVerified:      true,
        isActive:        true,
        needsOnboarding: true,
      });
      await this.userRepository.save(user);
      await this.walletService.createWallet(user.id);
      await this.walletService.assignDefaultPlan(user.id);
    }

    if (!user.isActive) throw new ForbiddenException('Account is deactivated.');

    // A verified code clears the login gate and any lockout from earlier
    // password guessing — the address holder has proven control of the account.
    await this.userRepository.update(user.id, {
      isVerified:          true,
      lastLoginAt:         new Date(),
      failedLoginAttempts: 0,
      lockedUntil:         null,
    });
    user.isVerified = true;

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

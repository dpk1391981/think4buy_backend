import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { RegisterDto, LoginDto, SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { WalletService } from '../wallet/wallet.service';

// In-memory OTP store — replace with Redis in production
const otpStore = new Map<string, { otp: string; expiry: Date }>();

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private walletService: WalletService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    // Guard: only OWNER and AGENT roles allowed during self-registration
    const allowedRoles = [UserRole.OWNER, UserRole.AGENT];
    if (dto.role && !allowedRoles.includes(dto.role as UserRole)) {
      throw new BadRequestException('Only "owner" or "agent" roles can be self-registered');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      ...dto,
      role: dto.role ?? UserRole.OWNER,
      password: hashed,
    });
    await this.userRepository.save(user);

    // Create wallet with welcome bonus for new user
    await this.walletService.createWallet(user.id);

    const { password, ...result } = user;
    return { user: result, token: this.generateToken(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email, isActive: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { password, ...result } = user;
    return { user: result, token: this.generateToken(user) };
  }

  async getProfile(userId: string) {
    return this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'name',
        'email',
        'phone',
        'role',
        'avatar',
        'city',
        'company',
        'isVerified',
        'createdAt',
      ],
    });
  }

  async updateProfile(
    userId: string,
    dto: { name?: string; email?: string; city?: string; company?: string },
  ) {
    await this.userRepository.update(userId, dto);
    return this.getProfile(userId);
  }

  async sendOtp(dto: SendOtpDto) {
    const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    otpStore.set(dto.phone, { otp, expiry });

    // In production: send SMS via Twilio / MSG91 / etc.
    console.log(`[OTP] Phone: ${dto.phone}  OTP: ${otp}`);

    const isNew = !(await this.userRepository.findOne({
      where: { phone: dto.phone },
    }));
    return {
      message: 'OTP sent successfully',
      isNewUser: isNew,
      // Return OTP only in development for demo — remove in production
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const entry = otpStore.get(dto.phone);
    if (!entry)
      throw new BadRequestException('OTP not sent or expired. Please request a new OTP.');
    if (entry.expiry < new Date()) {
      otpStore.delete(dto.phone);
      throw new BadRequestException('OTP expired. Please request a new one.');
    }
    if (entry.otp !== dto.otp) throw new BadRequestException('Invalid OTP.');

    otpStore.delete(dto.phone);

    // Find or create user by phone
    let user = await this.userRepository.findOne({ where: { phone: dto.phone } });
    const isNewUser = !user;

    if (!user) {
      // New user registration via OTP
      user = this.userRepository.create({
        phone: dto.phone,
        name: dto.name || `User${dto.phone.slice(-4)}`,
        email: `${dto.phone}@propfinder.local`, // placeholder email
        password: await bcrypt.hash(Math.random().toString(36), 10),
        role: UserRole.BUYER,
        isVerified: true,
        isActive: true,
      });
      await this.userRepository.save(user);

      // Create wallet with welcome bonus for new OTP user
      await this.walletService.createWallet(user.id);
    }

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated.');

    const { password, ...result } = user;
    return { user: result, token: this.generateToken(user) };
  }

  private generateToken(user: User) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}

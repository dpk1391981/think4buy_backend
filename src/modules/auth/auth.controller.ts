import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request as ExpressRequest } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, SendOtpDto, VerifyOtpDto, OnboardingDto } from './dto/auth.dto';

/** Cookie name for the HTTP-only refresh token */
const REFRESH_COOKIE = 'rt';

/** Refresh token cookie options */
const cookieOptions = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === 'production',
  sameSite:  'strict' as const,
  path:      '/api/v1/auth',          // only sent to auth endpoints
  maxAge:    7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Registration — 10 req/min ────────────────────────────────────────────

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, token: result.accessToken, accessToken: result.accessToken };
  }

  // ── Login — 5 req/min (brute-force protection) ───────────────────────────

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'User login' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, token: result.accessToken, accessToken: result.accessToken };
  }

  // ── Refresh access token using HTTP-only cookie ──────────────────────────

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  async refresh(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) throw new BadRequestException('No refresh token provided');

    const result = await this.authService.refreshTokens(refreshToken);
    this.setRefreshCookie(res, result.refreshToken); // rotate the cookie
    return { user: result.user, token: result.accessToken, accessToken: result.accessToken };
  }

  // ── Logout — clears cookie and invalidates DB refresh token ─────────────

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — invalidate refresh token' })
  async logout(@Request() req, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.id);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { message: 'Logged out successfully' };
  }

  // ── OTP — 3 req/min ──────────────────────────────────────────────────────

  @Post('otp/send')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send OTP to mobile number' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('otp/verify')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify OTP and login / register' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return {
      user: result.user,
      token: result.accessToken,
      accessToken: result.accessToken,
      isNewUser: result.isNewUser,
    };
  }

  // ── Onboarding — role selection for new OTP users ────────────────────────

  @Patch('onboarding')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Complete onboarding — select role for new users' })
  async completeOnboarding(
    @Request() req,
    @Body() dto: OnboardingDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.completeOnboarding(req.user.id, dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, token: result.accessToken, accessToken: result.accessToken };
  }

  // ── Role Upgrade (Buyer → Owner or Agent) ────────────────────────────────

  @Patch('upgrade-role')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade buyer role to owner or agent' })
  async upgradeRole(
    @Request() req,
    @Body() body: { role: 'owner' | 'agent' },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.upgradeRole(req.user.id, body.role);
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, token: result.accessToken, accessToken: result.accessToken };
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @Request() req,
    @Body() dto: { name?: string; email?: string; city?: string; company?: string },
  ) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @Post('profile/avatar')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload profile avatar' })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (_req, file, cb) => {
          cb(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = /jpeg|jpg|png|webp/.test(extname(file.originalname).toLowerCase());
        cb(ok ? null : new BadRequestException('Only jpg/png/webp images allowed'), ok);
      },
    }),
  )
  uploadAvatar(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) throw new BadRequestException('No file uploaded');
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.authService.updateAvatar(req.user.id, avatarUrl);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, cookieOptions);
  }
}

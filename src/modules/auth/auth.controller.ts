import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Request,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request as ExpressRequest } from 'express';
import { Throttle } from '@nestjs/throttler';
import { imageMulterOptions } from '../upload/multer.config';
import { ImageUploadService } from '../upload/image-upload.service';
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
  constructor(
    private readonly authService: AuthService,
    private readonly imageUploadService: ImageUploadService,
  ) {}

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
    @Body() dto: {
      name?: string; email?: string; city?: string; company?: string;
      phone?: string; agentLicense?: string; agentGstNumber?: string; agentBio?: string; agentExperience?: number;
    },
  ) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @Patch('profile/company')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update agent company / professional details' })
  updateAgentCompany(
    @Request() req,
    @Body() dto: {
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
    },
  ) {
    return this.authService.updateAgentCompany(req.user.id, dto);
  }

  @Post('profile/documents/:docType')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload agent document image (RERA cert, GST, PAN — max 5 MB)' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', imageMulterOptions(1)))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Param('docType') docType: string,
  ) {
    const allowed = new Set(['rera', 'gst', 'pan']);
    if (!allowed.has(docType)) throw new BadRequestException('docType must be rera, gst, or pan');
    if (!file) throw new BadRequestException('No file uploaded');
    const url = await this.imageUploadService.saveImage(file, 'agent-docs');
    return this.authService.saveAgentDocument(req.user.id, docType, url);
  }

  @Get('profile/documents/:docType')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Serve agent KYC document proxied through the backend' })
  async serveMyDocument(
    @Request() req,
    @Param('docType') docType: string,
    @Res() res: Response,
  ) {
    const allowed = new Set(['rera', 'gst', 'pan']);
    if (!allowed.has(docType)) throw new BadRequestException('docType must be rera, gst, or pan');
    const profile = await this.authService.getProfile(req.user.id);
    let meta: Record<string, string> = {};
    if (profile?.agentBio?.startsWith('__meta__:')) {
      try { meta = JSON.parse(profile.agentBio.slice(9)); } catch {}
    }
    const key = `doc${docType.charAt(0).toUpperCase()}${docType.slice(1)}`;
    const docUrl = meta[key];
    if (!docUrl) throw new NotFoundException('Document not uploaded');
    const { buffer, contentType } = await this.imageUploadService.fetchDocumentBuffer(docUrl);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(buffer);
  }

  @Post('profile/avatar')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload profile avatar (max 5 MB, JPEG/PNG/WebP → stored as WebP)' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('avatar', imageMulterOptions(1)))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) throw new BadRequestException('No file uploaded');
    const avatarUrl = await this.imageUploadService.saveImage(file, 'avatars');
    return this.authService.updateAvatar(req.user.id, avatarUrl);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, cookieOptions);
  }
}

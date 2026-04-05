import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { imageMulterOptions } from '../upload/multer.config';
import { ImageUploadService } from '../upload/image-upload.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import {
  CreateAgentDto,
  UpdateAgentDto,
  UpdateAgentQuotaDto,
  RejectPropertyDto,
  CreateBuilderDto,
  UpdateBuilderDto,
} from './dto/admin.dto';
import { UserRole } from '../users/entities/user.entity';
import { ApprovalStatus } from '../properties/entities/property.entity';
import { AgencyService } from '../agency/agency.service';
import { StorageConfigService } from '../storage-config/storage-config.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly agencyService: AgencyService,
    private readonly imageUploadService: ImageUploadService,
    private readonly storageConfigService: StorageConfigService,
  ) {}

  private assertAdmin(req: any) {
    const role = req.user?.role;
    const isAdmin = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN || req.user?.isSuperAdmin;
    if (!isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard stats' })
  getDashboard(@Request() req) {
    this.assertAdmin(req);
    return this.adminService.getDashboardStats();
  }

  // ── Properties ─────────────────────────────────────────────────────────────
  @Get('properties')
  @ApiOperation({ summary: 'List all properties (admin)' })
  @ApiQuery({ name: 'approvalStatus', enum: ApprovalStatus, required: false })
  @ApiQuery({ name: 'isDraft', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getProperties(
    @Request() req,
    @Query('approvalStatus') approvalStatus?: ApprovalStatus,
    @Query('isDraft') isDraft?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.getProperties({
      approvalStatus,
      isDraft: isDraft === 'true',
      page: +page,
      limit: +limit,
      search,
    });
  }

  @Patch('properties/:id/approve')
  @ApiOperation({ summary: 'Approve a property listing' })
  approveProperty(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.approveProperty(id, req.user?.id);
  }

  @Patch('properties/:id/reject')
  @ApiOperation({ summary: 'Reject a property listing' })
  rejectProperty(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: RejectPropertyDto,
  ) {
    this.assertAdmin(req);
    return this.adminService.rejectProperty(id, dto.reason, req.user?.id);
  }

  @Patch('properties/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a rejected property — sets status back to pending review' })
  reactivateProperty(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.reactivateProperty(id);
  }

  // ── Agents ─────────────────────────────────────────────────────────────────
  @Get('agents')
  @ApiOperation({ summary: 'List all agents' })
  getAgents(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.getAgents(+page, +limit, search);
  }

  @Post('agents')
  @ApiOperation({ summary: 'Create a new agent account' })
  createAgent(@Request() req, @Body() dto: CreateAgentDto) {
    this.assertAdmin(req);
    return this.adminService.createAgent(dto);
  }

  // ── Agent Avatar Approval (static routes BEFORE :id to avoid param capture) ──

  @Get('agents/pending-professional')
  @ApiOperation({ summary: 'List agents with pending professional details awaiting admin approval' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getPendingProfessionalAgents(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    this.assertAdmin(req);
    return this.adminService.getPendingProfessionalAgents(page, limit);
  }

  @Patch('agents/:id/approve-professional')
  @ApiOperation({ summary: 'Approve professional details of an agent, optionally assigning a badge' })
  approveProfessionalDetails(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { badge?: 'none' | 'verified' | 'bronze' | 'silver' | 'gold' },
  ) {
    this.assertAdmin(req);
    return this.adminService.approveProfessionalDetails(id, body?.badge);
  }

  @Patch('agents/:id/reject-professional')
  @ApiOperation({ summary: 'Reject professional details of an agent with optional reason' })
  rejectProfessionalDetails(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    this.assertAdmin(req);
    return this.adminService.rejectProfessionalDetails(id, body?.reason);
  }

  @Patch('agents/:id/set-profile-inactive')
  @ApiOperation({ summary: 'Set agent professional profile as inactive' })
  setAgentProfileInactive(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.setAgentProfileInactive(id);
  }

  @Get('agents/pending-images')
  @ApiOperation({ summary: 'List agents with pending avatar uploads awaiting approval' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getPendingAvatarAgents(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    this.assertAdmin(req);
    return this.adminService.getPendingAvatarAgents(page, limit);
  }

  @Get('agents/:id')
  @ApiOperation({ summary: 'Get single agent (admin)' })
  getAgent(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.getAgentById(id);
  }

  @Patch('agents/:id')
  @ApiOperation({ summary: 'Update agent profile (admin)' })
  updateAgent(@Request() req, @Param('id') id: string, @Body() dto: UpdateAgentDto) {
    this.assertAdmin(req);
    return this.adminService.updateAgent(id, dto);
  }

  @Patch('agents/:id/quota')
  @ApiOperation({ summary: 'Update agent free listing quota' })
  updateQuota(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateAgentQuotaDto,
  ) {
    this.assertAdmin(req);
    return this.adminService.updateAgentQuota(id, dto);
  }

  @Patch('agents/:id/toggle-status')
  @ApiOperation({ summary: 'Activate / deactivate agent account' })
  toggleStatus(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.toggleAgentStatus(id);
  }

  @Patch('agents/:id/approve-avatar')
  @ApiOperation({ summary: 'Approve an agent\'s pending avatar upload' })
  approveAgentAvatar(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.approveAgentAvatar(id);
  }

  @Patch('agents/:id/reject-avatar')
  @ApiOperation({ summary: 'Reject an agent\'s pending avatar upload' })
  rejectAgentAvatar(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.rejectAgentAvatar(id);
  }

  // ── Wallet Management ───────────────────────────────────────────────────────
  @Get('wallets')
  @ApiOperation({ summary: 'List all user wallets' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  getAllWallets(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.getAllWallets(page, limit, search, role);
  }

  @Post('wallets/:userId/top-up')
  @ApiOperation({ summary: 'Top up a user wallet (admin)' })
  topUpWallet(
    @Request() req,
    @Param('userId') userId: string,
    @Body() body: { amount: number; description?: string },
  ) {
    this.assertAdmin(req);
    return this.adminService.topUpWallet(userId, body.amount, body.description);
  }

  @Post('wallets/:userId/deduct')
  @ApiOperation({ summary: 'Deduct tokens from a user wallet (admin)' })
  deductFromWallet(
    @Request() req,
    @Param('userId') userId: string,
    @Body() body: { amount: number; description?: string },
  ) {
    this.assertAdmin(req);
    return this.adminService.deductFromWallet(userId, body.amount, body.description);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List all wallet transactions (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAllTransactions(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    this.assertAdmin(req);
    return this.adminService.getAllTransactions(page, limit);
  }

  // ── Subscription Plans ──────────────────────────────────────────────────────
  @Get('subscription-plans')
  @ApiOperation({ summary: 'List all subscription plans (admin)' })
  getSubscriptionPlans(@Request() req) {
    this.assertAdmin(req);
    return this.adminService.getSubscriptionPlans();
  }

  @Post('subscription-plans')
  @ApiOperation({ summary: 'Create subscription plan' })
  createSubscriptionPlan(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.adminService.createSubscriptionPlan(body);
  }

  @Patch('subscription-plans/:id')
  @ApiOperation({ summary: 'Update subscription plan' })
  updateSubscriptionPlan(
    @Request() req,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.assertAdmin(req);
    return this.adminService.updateSubscriptionPlan(id, body);
  }

  @Delete('subscription-plans/:id')
  @ApiOperation({ summary: 'Delete subscription plan' })
  deleteSubscriptionPlan(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.deleteSubscriptionPlan(id);
  }

  // ── User Subscriptions ───────────────────────────────────────────────────────
  @Get('subscriptions')
  @ApiOperation({ summary: 'List all user subscriptions (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getAllUserSubscriptions(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.getAllUserSubscriptions(+page, +limit, search);
  }

  @Post('subscriptions/assign')
  @ApiOperation({ summary: 'Admin assigns a subscription plan to a user (no payment)' })
  adminAssignPlan(
    @Request() req,
    @Body() body: { userId: string; planId: string },
  ) {
    this.assertAdmin(req);
    return this.adminService.adminAssignPlan(body.userId, body.planId);
  }

  // ── Boost Plans ─────────────────────────────────────────────────────────────
  @Get('boost-plans')
  @ApiOperation({ summary: 'List all boost plans (admin)' })
  getBoostPlans(@Request() req) {
    this.assertAdmin(req);
    return this.adminService.getBoostPlans();
  }

  @Post('boost-plans')
  @ApiOperation({ summary: 'Create boost plan' })
  createBoostPlan(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.adminService.createBoostPlan(body);
  }

  @Patch('boost-plans/:id')
  @ApiOperation({ summary: 'Update boost plan' })
  updateBoostPlan(
    @Request() req,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.assertAdmin(req);
    return this.adminService.updateBoostPlan(id, body);
  }

  @Delete('boost-plans/:id')
  @ApiOperation({ summary: 'Delete boost plan' })
  deleteBoostPlan(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.deleteBoostPlan(id);
  }

  // ── Countries ───────────────────────────────────────────────────────────────
  @Get('countries')
  @ApiOperation({ summary: 'List all countries (admin)' })
  getCountries(@Request() req) {
    this.assertAdmin(req);
    return this.adminService.getCountries();
  }

  @Post('countries')
  @ApiOperation({ summary: 'Create a country' })
  createCountry(
    @Request() req,
    @Body() body: { name: string; code: string; dialCode?: string; flag?: string; isActive?: boolean; sortOrder?: number },
  ) {
    this.assertAdmin(req);
    return this.adminService.createCountry(body);
  }

  @Patch('countries/:id')
  @ApiOperation({ summary: 'Update a country' })
  updateCountry(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.adminService.updateCountry(id, body);
  }

  @Delete('countries/:id')
  @ApiOperation({ summary: 'Delete a country' })
  deleteCountry(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.deleteCountry(id);
  }

  // ── Property Full CRUD (admin) ───────────────────────────────────────────────
  @Patch('properties/:id')
  @ApiOperation({ summary: 'Update property (admin)' })
  updateProperty(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.adminService.updateProperty(id, body);
  }

  @Delete('properties/:id')
  @ApiOperation({ summary: 'Delete property (admin)' })
  deleteProperty(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.deleteProperty(id);
  }

  @Patch('properties/:id/seo')
  @ApiOperation({ summary: 'Update property SEO slug, meta, and indexing flag (admin only)' })
  updatePropertySeo(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { slug?: string; metaTitle?: string; metaDescription?: string; allowIndexing?: boolean },
  ) {
    this.assertAdmin(req);
    return this.adminService.updatePropertySeo(id, body);
  }

  @Patch('properties/:id/toggle-status')
  @ApiOperation({ summary: 'Activate / Deactivate property' })
  togglePropertyStatus(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.togglePropertyStatus(id);
  }

  @Patch('properties/:id/toggle-featured')
  @ApiOperation({ summary: 'Boost / Unboost property (featured)' })
  togglePropertyFeatured(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.togglePropertyFeatured(id);
  }

  @Patch('properties/:id/toggle-premium')
  @ApiOperation({ summary: 'Mark / Unmark property as Premium' })
  togglePropertyPremium(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.togglePropertyPremium(id);
  }

  // ── States ──────────────────────────────────────────────────────────────────
  @Get('states')
  @ApiOperation({ summary: 'List all states (admin)' })
  getStates(@Request() req) {
    this.assertAdmin(req);
    return this.adminService.getStates();
  }

  @Post('states')
  @ApiOperation({ summary: 'Create a state' })
  createState(
    @Request() req,
    @Body() body: { name: string; code: string; isActive?: boolean },
  ) {
    this.assertAdmin(req);
    return this.adminService.createState(body);
  }

  @Patch('states/:id')
  @ApiOperation({ summary: 'Update a state' })
  updateState(
    @Request() req,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.assertAdmin(req);
    return this.adminService.updateState(id, body);
  }

  @Delete('states/:id')
  @ApiOperation({ summary: 'Delete a state' })
  deleteState(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.deleteState(id);
  }

  // ── Cities ──────────────────────────────────────────────────────────────────
  @Get('cities')
  @ApiOperation({ summary: 'List all cities (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'stateId', required: false })
  getAllCities(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('stateId') stateId?: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.getAllCities(page, limit, search, stateId);
  }

  @Post('cities')
  @ApiOperation({ summary: 'Create a city' })
  createCity(
    @Request() req,
    @Body() body: {
      name: string;
      stateId: string;
      isActive?: boolean;
      isFeatured?: boolean;
      imageUrl?: string;
    },
  ) {
    this.assertAdmin(req);
    return this.adminService.createCity(body);
  }

  @Patch('cities/:id')
  @ApiOperation({ summary: 'Update a city' })
  updateCity(
    @Request() req,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.assertAdmin(req);
    return this.adminService.updateCity(id, body);
  }

  @Delete('cities/:id')
  @ApiOperation({ summary: 'Delete a city' })
  deleteCity(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.deleteCity(id);
  }

  // ── Localities ───────────────────────────────────────────────────────────────
  @Get('localities')
  @ApiOperation({ summary: 'List localities (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'search', required: false })
  getLocalities(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.getLocalities({ page: +page, limit: +limit, state, city, search });
  }

  @Post('localities')
  @ApiOperation({ summary: 'Create a locality entry' })
  createLocality(@Request() req, @Body() body: { city: string; state: string; locality?: string; pincode?: string; latitude?: number; longitude?: number }) {
    this.assertAdmin(req);
    return this.adminService.createLocality(body);
  }

  @Patch('localities/:id')
  @ApiOperation({ summary: 'Update a locality entry' })
  updateLocality(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.adminService.updateLocality(id, body);
  }

  @Delete('localities/:id')
  @ApiOperation({ summary: 'Delete a locality entry' })
  deleteLocality(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.deleteLocality(id);
  }

  @Post('localities/bulk-import')
  @ApiOperation({ summary: 'Bulk import localities from a JSON array' })
  bulkImportLocalities(@Request() req, @Body() body: { rows: { city: string; state: string; locality?: string; pincode?: string }[] }) {
    this.assertAdmin(req);
    return this.adminService.bulkImportLocalities(body.rows || []);
  }

  // ── Agency Management ───────────────────────────────────────────────────────
  @Get('agencies')
  @ApiOperation({ summary: 'List all agencies (admin, all statuses)' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getAdminAgencies(
    @Request() req,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    if (status === 'pending') {
      return this.agencyService.getPendingAgencies(+page, +limit);
    }
    return this.agencyService.getAgencies(+page, +limit, search);
  }

  @Patch('agencies/:id/approve')
  @ApiOperation({ summary: 'Approve a pending agency' })
  approveAgency(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.agencyService.approveAgency(id);
  }

  @Patch('agencies/:id/reject')
  @ApiOperation({ summary: 'Reject a pending agency' })
  rejectAgency(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    this.assertAdmin(req);
    return this.agencyService.rejectAgency(id, body.reason ?? 'Rejected by admin');
  }

  // ── Agent KYC Document Upload (admin) ─────────────────────────────────────────
  @Post('agents/:id/documents/:docType')
  @ApiOperation({ summary: 'Admin: Upload KYC document for an agent (rera/gst/pan)' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', imageMulterOptions(1)))
  async uploadAgentDocument(
    @Request() req,
    @Param('id') id: string,
    @Param('docType') docType: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.assertAdmin(req);
    const allowed = new Set(['rera', 'gst', 'pan']);
    if (!allowed.has(docType)) throw new BadRequestException('docType must be rera, gst, or pan');
    if (!file) throw new BadRequestException('No file uploaded');
    const url = await this.imageUploadService.saveImage(file, 'agent-docs');
    return this.adminService.adminSaveAgentDocument(id, docType, url);
  }

  @Get('agents/:id/documents/:docType')
  @ApiOperation({ summary: 'Admin: Serve agent KYC document proxied through the backend' })
  async serveAgentDocument(
    @Request() req,
    @Param('id') id: string,
    @Param('docType') docType: string,
    @Res() res: Response,
  ) {
    this.assertAdmin(req);
    const allowed = new Set(['rera', 'gst', 'pan']);
    if (!allowed.has(docType)) throw new BadRequestException('docType must be rera, gst, or pan');
    const agent = await this.adminService.getAgentById(id);
    let meta: Record<string, string> = {};
    if (agent?.agentBio?.startsWith('__meta__:')) {
      try { meta = JSON.parse(agent.agentBio.slice(9)); } catch {}
    }
    const key = `doc${docType.charAt(0).toUpperCase()}${docType.slice(1)}`;
    const docUrl = meta[key];
    if (!docUrl) throw new NotFoundException('Document not uploaded');
    const { buffer, contentType } = await this.imageUploadService.fetchDocumentBuffer(docUrl);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(buffer);
  }

  // ── Location Image Upload ────────────────────────────────────────────────────
  @Post('locations/upload')
  @ApiOperation({ summary: 'Upload image for a city or state (max 5 MB, JPEG/PNG/WebP → stored as WebP)' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', imageMulterOptions(1)))
  async uploadLocationImage(@Request() req, @UploadedFile() file: Express.Multer.File) {
    this.assertAdmin(req);
    if (!file) throw new BadRequestException('No file uploaded');
    const url = await this.imageUploadService.saveImage(file, 'locations');
    return { url };
  }

  // ── Storage & Watermark Configuration ────────────────────────────────────────
  @Get('storage-config')
  @ApiOperation({ summary: 'Get storage & watermark config (admin)' })
  async getStorageConfig(@Request() req) {
    this.assertAdmin(req);
    const map = await this.storageConfigService.getMap();
    return {
      s3_enabled:        map['s3_enabled']        ?? '0',
      s3_region:         map['s3_region']         ?? 'ap-south-1',
      s3_bucket:         map['s3_bucket']         ?? '',
      s3_access_key:     map['s3_access_key']     ?? '',
      // Never return secret key — send a masked placeholder
      s3_secret_key:     map['s3_secret_key'] ? '••••••••' : '',
      s3_cdn_url:        map['s3_cdn_url']        ?? '',
      watermark_enabled: map['watermark_enabled'] ?? '0',
      watermark_text:    map['watermark_text']    ?? '',
    };
  }

  @Post('storage-config')
  @ApiOperation({ summary: 'Save storage & watermark config (admin)' })
  async saveStorageConfig(
    @Request() req,
    @Body() body: {
      s3_enabled?: string;
      s3_region?: string;
      s3_bucket?: string;
      s3_access_key?: string;
      s3_secret_key?: string;
      s3_cdn_url?: string;
      watermark_enabled?: string;
      watermark_text?: string;
    },
  ) {
    this.assertAdmin(req);
    const entries: { key: string; value: string }[] = [];

    const push = (key: string, val: string | undefined) => {
      if (val !== undefined) entries.push({ key, value: val });
    };

    push('s3_enabled',        body.s3_enabled);
    push('s3_region',         body.s3_region);
    push('s3_bucket',         body.s3_bucket);
    push('s3_access_key',     body.s3_access_key);
    push('s3_cdn_url',        body.s3_cdn_url);
    push('watermark_enabled', body.watermark_enabled);
    push('watermark_text',    body.watermark_text);

    // Only update secret if a real value (not the masked placeholder) is sent
    if (body.s3_secret_key && body.s3_secret_key !== '••••••••') {
      push('s3_secret_key', body.s3_secret_key);
    }

    await this.storageConfigService.bulkUpsert(entries);
    return { success: true };
  }

  // ── User Role Management (super_admin only) ────────────────────────────────
  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change a user\'s role (super_admin only)' })
  changeUserRole(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { role: string },
  ) {
    if (!req.user?.isSuperAdmin && req.user?.role !== UserRole.SUPER_ADMIN) {
      const { ForbiddenException } = require('@nestjs/common');
      throw new ForbiddenException('Super admin access required');
    }
    return this.adminService.changeUserRole(id, body.role);
  }

  // ── Builder Management ──────────────────────────────────────────────────────

  @Get('builders')
  @ApiOperation({ summary: 'List all builder accounts (admin)' })
  @ApiQuery({ name: 'page',   required: false })
  @ApiQuery({ name: 'limit',  required: false })
  @ApiQuery({ name: 'search', required: false })
  getAdminBuilders(
    @Request() req,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.getBuilders(page, limit, search);
  }

  @Post('builders')
  @ApiOperation({ summary: 'Create a builder account (admin)' })
  createBuilder(@Request() req, @Body() dto: CreateBuilderDto) {
    this.assertAdmin(req);
    return this.adminService.createBuilder(dto);
  }

  @Get('builders/:id')
  @ApiOperation({ summary: 'Get single builder (admin)' })
  getAdminBuilder(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.getBuilderById(id);
  }

  @Patch('builders/:id')
  @ApiOperation({ summary: 'Update builder profile (admin)' })
  updateBuilder(@Request() req, @Param('id') id: string, @Body() dto: UpdateBuilderDto) {
    this.assertAdmin(req);
    return this.adminService.updateBuilder(id, dto);
  }

  @Delete('builders/:id')
  @ApiOperation({ summary: 'Delete builder account (admin)' })
  deleteBuilder(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.deleteBuilder(id);
  }

  @Patch('builders/:id/toggle-verify')
  @ApiOperation({ summary: 'Toggle verified status of a builder' })
  toggleBuilderVerified(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.toggleBuilderVerified(id);
  }

  @Post('builders/:id/logo')
  @ApiOperation({ summary: 'Upload brand logo for a builder (max 5 MB, JPEG/PNG/WebP → stored as WebP)' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', imageMulterOptions(1)))
  async uploadBuilderLogo(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.assertAdmin(req);
    if (!file) throw new BadRequestException('No file uploaded');
    const url = await this.imageUploadService.saveImage(file, 'builders');
    return this.adminService.updateBuilderLogo(id, url);
  }

  @Post('storage-config/test-s3')
  @ApiOperation({ summary: 'Test S3 connectivity with current config (admin)' })
  async testS3Connection(@Request() req) {
    this.assertAdmin(req);
    const s3 = await this.storageConfigService.getS3Settings();

    if (!s3.bucket || !s3.accessKey || !s3.secretKey) {
      return { success: false, message: 'S3 credentials are incomplete.' };
    }

    try {
      const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: s3.region,
        credentials: { accessKeyId: s3.accessKey, secretAccessKey: s3.secretKey },
      });
      await client.send(new ListBucketsCommand({}));
      return { success: true, message: 'S3 connection successful.' };
    } catch (err: any) {
      return { success: false, message: err?.message ?? 'S3 connection failed.' };
    }
  }
}

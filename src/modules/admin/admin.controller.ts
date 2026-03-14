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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthGuard } from '@nestjs/passport';
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
} from './dto/admin.dto';
import { UserRole } from '../users/entities/user.entity';
import { ApprovalStatus } from '../properties/entities/property.entity';
import { AgencyService } from '../agency/agency.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly agencyService: AgencyService,
  ) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== UserRole.ADMIN) {
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
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getProperties(
    @Request() req,
    @Query('approvalStatus') approvalStatus?: ApprovalStatus,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.getProperties({
      approvalStatus,
      page: +page,
      limit: +limit,
      search,
    });
  }

  @Patch('properties/:id/approve')
  @ApiOperation({ summary: 'Approve a property listing' })
  approveProperty(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.adminService.approveProperty(id);
  }

  @Patch('properties/:id/reject')
  @ApiOperation({ summary: 'Reject a property listing' })
  rejectProperty(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: RejectPropertyDto,
  ) {
    this.assertAdmin(req);
    return this.adminService.rejectProperty(id, dto.reason);
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

  // ── Wallet Management ───────────────────────────────────────────────────────
  @Get('wallets')
  @ApiOperation({ summary: 'List all user wallets' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getAllWallets(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.getAllWallets(page, limit, search);
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
  @ApiOperation({ summary: 'Update property SEO slug and meta (admin only)' })
  updatePropertySeo(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { slug?: string; metaTitle?: string; metaDescription?: string },
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

  // ── Location Image Upload ────────────────────────────────────────────────────
  @Post('locations/upload')
  @ApiOperation({ summary: 'Upload image for a city or state' })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/locations',
      filename: (req, file, cb) => {
        const ext = extname(file.originalname);
        cb(null, `location-${Date.now()}${ext}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) cb(null, true);
      else cb(new Error('Only image files allowed'), false);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadLocationImage(@Request() req, @UploadedFile() file: Express.Multer.File) {
    this.assertAdmin(req);
    if (!file) throw new BadRequestException('No file uploaded');
    const url = `/uploads/locations/${file.filename}`;
    return { url };
  }
}

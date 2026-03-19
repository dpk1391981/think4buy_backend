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
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { AgencyService } from './agency.service';
import {
  CreateAgencyDto,
  UpdateAgencyDto,
  CreateAgentProfileDto,
  UpdateAgentProfileDto,
  AssignPropertyToAgentDto,
  ReassignPropertyDto,
  AssignAgentLocationDto,
} from './dto/agency.dto';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('agency')
@Controller('agency')
export class AgencyController {
  constructor(private readonly agencyService: AgencyService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  // ─── Public: Agency List & Detail ─────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all active agencies (public)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'cityId', required: false })
  getAgencies(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('cityId') cityId?: string,
  ) {
    return this.agencyService.getAgencies(page, limit, search, cityId);
  }

  // ─── Public: Premium Agent Slots (must be before :id to avoid capture) ──────

  @Get('premium-agents')
  @ApiOperation({ summary: 'Get active premium-slot agents for a city (public)' })
  @ApiQuery({ name: 'city', required: true })
  getPremiumAgentsByCity(@Query('city') city: string) {
    return this.agencyService.getPremiumAgentsByCity(city || '');
  }

  @Get('top-agents')
  @ApiOperation({ summary: 'Top agents by authority score for a city (public)' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getTopAgentsByCity(
    @Query('city') city?: string,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit?: number,
  ) {
    return this.agencyService.getTopAgentsByCity(city || '', limit);
  }

  @Get('diamond-agents')
  @ApiOperation({ summary: 'Diamond agents matching a locality/city/state (public)' })
  @ApiQuery({ name: 'locality', required: false })
  @ApiQuery({ name: 'city',     required: false })
  @ApiQuery({ name: 'state',    required: false })
  @ApiQuery({ name: 'limit',    required: false })
  getDiamondAgentsByCoverage(
    @Query('locality') locality?: string,
    @Query('city')     city?: string,
    @Query('state')    state?: string,
    @Query('limit', new DefaultValuePipe(6), ParseIntPipe) limit?: number,
  ) {
    return this.agencyService.getDiamondAgentsByCoverage(locality, city, state, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agency details (public)' })
  getAgency(@Param('id') id: string) {
    return this.agencyService.getAgencyById(id);
  }

  @Get(':id/agents')
  @ApiOperation({ summary: 'Get agents of an agency (public)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAgencyAgents(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.agencyService.getAgencyAgents(id, page, limit);
  }

  // ─── Public: Agent Queries ────────────────────────────────────────────────────

  @Get('agents/by-city/:cityId')
  @ApiOperation({ summary: 'Get agents by city (public)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAgentsByCity(
    @Param('cityId') cityId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.agencyService.getAgentsByCity(cityId, page, limit);
  }

  @Get('agent/:agentId/properties')
  @ApiOperation({ summary: 'Get properties by agent (public)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getPropertiesByAgent(
    @Param('agentId') agentId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.agencyService.getPropertiesByAgent(agentId, page, limit);
  }

  // ─── Admin: Agency Management ─────────────────────────────────────────────────

  @Post('admin/agencies')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create agency (admin)' })
  createAgency(@Request() req, @Body() dto: CreateAgencyDto) {
    this.assertAdmin(req);
    return this.agencyService.createAgency(dto);
  }

  @Patch('admin/agencies/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update agency (admin)' })
  updateAgency(@Request() req, @Param('id') id: string, @Body() dto: UpdateAgencyDto) {
    this.assertAdmin(req);
    return this.agencyService.updateAgency(id, dto);
  }

  @Delete('admin/agencies/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete agency (admin)' })
  deleteAgency(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.agencyService.deleteAgency(id);
  }

  // ─── Admin: Agent Profile Management ─────────────────────────────────────────

  @Get('admin/agent-profiles')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search / list agent profiles (admin)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'unassigned', required: false })
  listAgentProfiles(
    @Request() req,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('unassigned') unassigned?: string,
  ) {
    this.assertAdmin(req);
    return this.agencyService.searchAgentProfiles(
      search,
      page,
      limit,
      unassigned === 'true',
    );
  }

  @Post('admin/agent-profiles')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create agent profile (admin)' })
  createAgentProfile(@Request() req, @Body() dto: CreateAgentProfileDto) {
    this.assertAdmin(req);
    return this.agencyService.createAgentProfile(dto);
  }

  @Patch('admin/agent-profiles/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update agent profile (admin)' })
  updateAgentProfile(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateAgentProfileDto,
  ) {
    this.assertAdmin(req);
    return this.agencyService.updateAgentProfile(id, dto);
  }

  @Patch('admin/agent-profiles/:id/assign-agency')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign / unassign agent to/from agency (admin). Pass agencyId=null to unassign.' })
  assignAgentToAgency(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { agencyId?: string | null },
  ) {
    this.assertAdmin(req);
    return this.agencyService.assignAgentToAgency(id, body.agencyId ?? null);
  }

  @Get('admin/agent-profiles/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get agent profile by ID (admin)' })
  getAgentProfile(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.agencyService.getAgentProfileById(id);
  }

  // ─── Admin: Property Assignment ───────────────────────────────────────────────

  @Post('admin/property-assignments')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign property to agent (admin)' })
  assignProperty(@Request() req, @Body() dto: AssignPropertyToAgentDto) {
    this.assertAdmin(req);
    return this.agencyService.assignPropertyToAgent(dto);
  }

  @Patch('admin/property-assignments/:propertyId/reassign')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reassign property to another agent (admin)' })
  reassignProperty(
    @Request() req,
    @Param('propertyId') propertyId: string,
    @Body() dto: ReassignPropertyDto,
  ) {
    this.assertAdmin(req);
    return this.agencyService.reassignProperty(propertyId, dto.newAgentId);
  }

  @Get('admin/property-assignments/:propertyId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get assigned agent for a property (admin)' })
  getPropertyAgent(@Request() req, @Param('propertyId') propertyId: string) {
    this.assertAdmin(req);
    return this.agencyService.getPropertyAgent(propertyId);
  }

  // ─── Admin: Agent Location Mapping ───────────────────────────────────────────

  @Post('admin/agent-profiles/:id/locations')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add location mapping to agent (admin)' })
  addAgentLocation(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AssignAgentLocationDto,
  ) {
    this.assertAdmin(req);
    return this.agencyService.addAgentLocation(id, dto);
  }

  @Delete('admin/agent-locations/:locationMapId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove agent location mapping (admin)' })
  removeAgentLocation(@Request() req, @Param('locationMapId') id: string) {
    this.assertAdmin(req);
    return this.agencyService.removeAgentLocation(id);
  }

  // ─── Admin: Agency Approval ───────────────────────────────────────────────────

  @Get('admin/agencies/pending')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List agencies pending approval (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getPendingAgencies(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    this.assertAdmin(req);
    return this.agencyService.getPendingAgencies(page, limit);
  }

  @Patch('admin/agencies/:id/approve')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a pending agency (admin)' })
  approveAgency(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.agencyService.approveAgency(id);
  }

  @Patch('admin/agencies/:id/reject')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a pending agency (admin)' })
  rejectAgency(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    this.assertAdmin(req);
    return this.agencyService.rejectAgency(id, body.reason ?? 'Rejected by admin');
  }

  // ─── Agent: Self-register or Join Agency ──────────────────────────────────────

  @Post('self/register-or-join')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agent self-registers a new agency or joins an existing one by name' })
  registerOrJoinAgency(
    @Request() req,
    @Body() body: {
      agencyName: string;
      contactPhone?: string;
      address?: string;
      city?: string;
      cityId?: string;
    },
  ) {
    return this.agencyService.agentRegisterOrJoinAgency(req.user.id, body);
  }

  // ─── Agent: My Dashboard ──────────────────────────────────────────────────────

  @Get('me/dashboard')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agent dashboard — my agency, listings, performance' })
  getMyDashboard(@Request() req) {
    return this.agencyService.getAgentDashboard(req.user.id);
  }

  @Get('me/agency')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my agency info' })
  async getMyAgency(@Request() req) {
    const profile = await this.agencyService.getAgentProfileByUserId(req.user.id);
    return profile.agency ?? { message: 'Not assigned to any agency' };
  }

  @Get('me/properties')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my assigned properties' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getMyProperties(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const profile = await this.agencyService.getAgentProfileByUserId(req.user.id);
    return this.agencyService.getAgentProperties(profile.id, page, limit);
  }

  @Get('me/locations')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my location mappings' })
  async getMyLocations(@Request() req) {
    const profile = await this.agencyService.getAgentProfileByUserId(req.user.id);
    return this.agencyService.getAgentLocations(profile.id);
  }

  @Post('me/locations')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agent: Add a coverage area to own profile' })
  async addMyLocation(@Request() req, @Body() dto: AssignAgentLocationDto) {
    const profile = await this.agencyService.getAgentProfileByUserId(req.user.id);
    return this.agencyService.addAgentLocation(profile.id, dto);
  }

  @Delete('me/locations/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agent: Remove one of own coverage areas' })
  async removeMyLocation(@Request() req, @Param('id') id: string) {
    // Verify ownership before removing
    const profile = await this.agencyService.getAgentProfileByUserId(req.user.id);
    const locations = await this.agencyService.getAgentLocations(profile.id);
    const owned = locations.find((l: any) => l.id === id);
    if (!owned) throw new ForbiddenException('Location not found or not owned by you');
    return this.agencyService.removeAgentLocation(id);
  }

  // ─── Admin: Premium Slot Management ──────────────────────────────────────────

  @Get('admin/premium-slots')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List all premium slots' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  adminListSlots(
    @Request() req,
    @Query('city') city?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    this.assertAdmin(req);
    return this.agencyService.listPremiumSlots(city, page, limit);
  }

  @Post('admin/premium-slots')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create/replace a premium slot' })
  adminCreateSlot(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.agencyService.upsertPremiumSlot(body);
  }

  @Delete('admin/premium-slots/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Deactivate a premium slot' })
  adminDeactivateSlot(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.agencyService.deactivatePremiumSlot(id);
  }

  // ─── Admin: Diamond Coverage Area Management ──────────────────────────────────

  @Get('admin/coverage')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List all agent coverage areas' })
  @ApiQuery({ name: 'agentProfileId', required: false })
  @ApiQuery({ name: 'tick',           required: false })
  @ApiQuery({ name: 'city',           required: false })
  @ApiQuery({ name: 'page',           required: false })
  @ApiQuery({ name: 'limit',          required: false })
  adminListCoverage(
    @Request() req,
    @Query('agentProfileId') agentProfileId?: string,
    @Query('tick')           tick?: string,
    @Query('city')           city?: string,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    this.assertAdmin(req);
    return this.agencyService.listAdminCoverage(agentProfileId, tick, city, page, limit);
  }

  @Post('admin/coverage')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Add coverage area to an agent profile' })
  adminAddCoverage(
    @Request() req,
    @Body() body: { agentProfileId: string } & any,
  ) {
    this.assertAdmin(req);
    const { agentProfileId, ...dto } = body;
    return this.agencyService.addAgentLocation(agentProfileId, dto);
  }

  @Patch('admin/coverage/:id/approve')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Approve a coverage area' })
  adminApproveCoverage(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.agencyService.approveCoverage(id, req.user.id);
  }

  @Patch('admin/coverage/:id/deactivate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Deactivate a coverage area' })
  adminDeactivateCoverage(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.agencyService.deactivateCoverage(id);
  }

  @Delete('admin/coverage/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Remove a coverage area entirely' })
  adminRemoveCoverage(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.agencyService.removeAgentLocation(id);
  }
}

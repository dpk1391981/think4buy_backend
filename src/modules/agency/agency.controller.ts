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
}

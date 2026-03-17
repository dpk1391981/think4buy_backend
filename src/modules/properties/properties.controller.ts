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
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { imageMulterOptions } from '../upload/multer.config';
import { ImageUploadService } from '../upload/image-upload.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { FilterPropertyDto } from './dto/filter-property.dto';
import { PropertyStatus, ApprovalStatus } from './entities/property.entity';

@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List properties with filters' })
  findAll(@Query() filters: FilterPropertyDto) {
    return this.propertiesService.findAll(filters);
  }

  @Get('search/suggestions')
  @ApiOperation({ summary: 'Get search suggestions (cities, localities, builders, projects)' })
  getSearchSuggestions(@Query('q') q: string) {
    return this.propertiesService.getSearchSuggestions(q);
  }

  @Get('map')
  @ApiOperation({ summary: 'Get properties with lat/lng for map view' })
  getForMap(@Query() filters: FilterPropertyDto) {
    return this.propertiesService.findForMap(filters);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured properties' })
  getFeatured(@Query('limit') limit?: number) {
    return this.propertiesService.findFeatured(limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get property statistics' })
  getStats() {
    return this.propertiesService.getStats();
  }

  @Get('cities')
  @ApiOperation({ summary: 'Get cities with property count' })
  getCities() {
    return this.propertiesService.getCitiesWithCount();
  }

  @Get('amenities')
  @ApiOperation({ summary: 'Get all amenities' })
  getAmenities() {
    return this.propertiesService.getAmenities();
  }

  @Get('my-listings')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's own property listings" })
  getMyListings(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('status') status?: PropertyStatus,
    @Query('approvalStatus') approvalStatus?: ApprovalStatus,
  ) {
    return this.propertiesService.findMyListings(req.user.id, {
      page,
      limit,
      status,
      approvalStatus,
    });
  }

  @Get('id/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get property by ID (for editing)' })
  findById(@Param('id') id: string) {
    return this.propertiesService.findById(id);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get property by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.propertiesService.findBySlug(slug);
  }

  /**
   * Track a unique property view.
   * Works for both guests (keyed by IP) and logged-in users (keyed by userId).
   * Idempotent within a 24-hour window — safe to call on every page load.
   */
  @Post(':id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Record a unique property view' })
  async trackView(
    @Param('id') propertyId: string,
    @Body() body: {
      sessionId?: string;
      source?: string;
      referrer?: string;
      deviceType?: string;
    },
    @Request() req,
  ) {
    const ip = (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] as string ||
      req.socket?.remoteAddress ||
      '0.0.0.0'
    );

    await this.propertiesService.trackView(propertyId, {
      userId:     req.user?.id ?? undefined,
      ipAddress:  ip,
      userAgent:  req.headers['user-agent'],
      sessionId:  body?.sessionId,
      source:     body?.source,
      referrer:   body?.referrer ?? req.headers['referer'],
      deviceType: body?.deviceType,
    });
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new property listing' })
  create(@Body() dto: CreatePropertyDto, @Request() req) {
    return this.propertiesService.create(dto, req.user);
  }

  @Patch(':id/publish')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a draft property (submit for admin approval)' })
  publishDraft(@Param('id') id: string, @Request() req) {
    return this.propertiesService.publishDraft(id, req.user);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update property listing' })
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePropertyDto>,
    @Request() req,
  ) {
    return this.propertiesService.update(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete property listing' })
  remove(@Param('id') id: string, @Request() req) {
    return this.propertiesService.remove(id, req.user);
  }

  @Post(':id/images')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload property images (max 20, 5 MB each, JPEG/PNG/WebP)' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FilesInterceptor('images', 20, imageMulterOptions(20)))
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    if (!files?.length) throw new BadRequestException('No images uploaded');
    const urls = await this.imageUploadService.saveImages(files, 'properties', id);
    return this.propertiesService.addImages(id, urls, req.user);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a property image' })
  deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Request() req,
  ) {
    return this.propertiesService.deleteImage(id, imageId, req.user);
  }

  @Get(':id/similar')
  @ApiOperation({ summary: 'Get similar properties' })
  async getSimilar(@Param('id') id: string) {
    const property = await this.propertiesService.findById(id);
    return this.propertiesService.getSimilarProperties(property);
  }

  @Post(':id/boost')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Boost a property listing using wallet tokens' })
  boostProperty(
    @Param('id') id: string,
    @Body() body: { boostPlanId: string },
    @Request() req,
  ) {
    return this.propertiesService.boostProperty(id, body.boostPlanId, req.user);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update property status (active/under_deal/sold/rented/inactive)' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: PropertyStatus; note?: string },
    @Request() req,
  ) {
    return this.propertiesService.updatePropertyStatus(id, body.status, req.user, body.note);
  }

  @Get(':id/status-history')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get status change history for a property' })
  getStatusHistory(@Param('id') id: string, @Request() req) {
    return this.propertiesService.getPropertyStatusHistory(id, req.user);
  }
}

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
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
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
  constructor(private readonly propertiesService: PropertiesService) {}

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
  @ApiOperation({ summary: 'Upload property images and videos' })
  @UseInterceptors(
    FilesInterceptor('images', 11, {
      storage: diskStorage({
        destination: './uploads/properties',
        filename: (_req, file, cb) => {
          cb(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for videos
      fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp|mp4|mov|avi|webm/;
        const ok = allowed.test(extname(file.originalname).toLowerCase());
        cb(null, ok);
      },
    }),
  )
  uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    return this.propertiesService.addImages(id, files, req.user);
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
}

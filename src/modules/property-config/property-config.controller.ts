import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PropertyConfigService } from './property-config.service';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('property-config')
@Controller('property-config')
export class PropertyConfigController {
  constructor(private readonly svc: PropertyConfigService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
  }

  // ── Public endpoints ────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'Get active property categories (public)' })
  getCategories() {
    return this.svc.getActiveCategories();
  }

  @Get('types')
  @ApiOperation({ summary: 'Get active property types for a category (public)' })
  getTypes(@Query('categoryId') categoryId: string, @Query('categorySlug') categorySlug?: string) {
    return this.svc.getTypesByCategory(categoryId, categorySlug);
  }

  @Get('amenities')
  @ApiOperation({ summary: 'Get amenities for a property type (public)' })
  getAmenities(@Query('typeId') typeId: string) {
    return this.svc.getAmenitiesByType(typeId);
  }

  @Get('fields')
  @ApiOperation({ summary: 'Get dynamic fields for a property type (public)' })
  getFields(@Query('typeId') typeId: string) {
    return this.svc.getFieldsByType(typeId);
  }

  // ── Admin: Categories ───────────────────────────────────────────────────────

  @Get('admin/categories')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminGetCategories(@Request() req) {
    this.assertAdmin(req);
    return this.svc.getAdminCategories();
  }

  @Post('admin/categories')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminCreateCategory(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.svc.createCategory(body);
  }

  @Patch('admin/categories/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminUpdateCategory(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.svc.updateCategory(id, body);
  }

  @Delete('admin/categories/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminDeleteCategory(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.svc.deleteCategory(id);
  }

  // ── Admin: Property Types ───────────────────────────────────────────────────

  @Get('admin/types')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminGetTypes(@Request() req, @Query('categoryId') categoryId?: string) {
    this.assertAdmin(req);
    return this.svc.getAdminTypes(categoryId);
  }

  @Post('admin/types')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminCreateType(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.svc.createType(body);
  }

  @Patch('admin/types/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminUpdateType(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.svc.updateType(id, body);
  }

  @Delete('admin/types/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminDeleteType(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.svc.deleteType(id);
  }

  // ── Admin: Amenities ────────────────────────────────────────────────────────

  @Get('admin/amenities')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminGetAmenities(@Request() req) {
    this.assertAdmin(req);
    return this.svc.getAdminAmenities();
  }

  @Post('admin/amenities')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminCreateAmenity(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.svc.createAmenity(body);
  }

  @Patch('admin/amenities/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminUpdateAmenity(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.svc.updateAmenity(id, body);
  }

  @Delete('admin/amenities/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminDeleteAmenity(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.svc.deleteAmenity(id);
  }

  // ── Admin: Type-Amenity Mapping ─────────────────────────────────────────────

  @Get('admin/types/:typeId/amenities')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminGetTypeAmenities(@Request() req, @Param('typeId') typeId: string) {
    this.assertAdmin(req);
    return this.svc.getTypeAmenities(typeId);
  }

  @Post('admin/types/:typeId/amenities')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminSetTypeAmenities(
    @Request() req,
    @Param('typeId') typeId: string,
    @Body() body: { amenityIds: string[] },
  ) {
    this.assertAdmin(req);
    return this.svc.setTypeAmenities(typeId, body.amenityIds);
  }

  // ── Admin: Type Fields ──────────────────────────────────────────────────────

  @Get('admin/types/:typeId/fields')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminGetFields(@Request() req, @Param('typeId') typeId: string) {
    this.assertAdmin(req);
    return this.svc.getAdminFields(typeId);
  }

  @Post('admin/types/:typeId/fields')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminCreateField(
    @Request() req,
    @Param('typeId') typeId: string,
    @Body() body: any,
  ) {
    this.assertAdmin(req);
    return this.svc.createField({ ...body, propTypeId: typeId });
  }

  @Patch('admin/fields/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminUpdateField(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.svc.updateField(id, body);
  }

  @Delete('admin/fields/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminDeleteField(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.svc.deleteField(id);
  }

  @Post('admin/types/:typeId/fields/reorder')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminReorderFields(
    @Request() req,
    @Param('typeId') typeId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    this.assertAdmin(req);
    return this.svc.reorderFields(typeId, body.orderedIds);
  }

  // ── Public: Listing Filter Configs ──────────────────────────────────────────

  @Get('listing-filters')
  @ApiOperation({ summary: 'Get active listing sidebar filters (public)' })
  getListingFilters(@Query('category') category?: string) {
    return this.svc.getListingFilters(category);
  }

  // ── Admin: Listing Filter Configs ────────────────────────────────────────────

  @Get('admin/listing-filters')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminGetListingFilters(@Request() req) {
    this.assertAdmin(req);
    return this.svc.getAdminListingFilters();
  }

  @Post('admin/listing-filters')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminCreateListingFilter(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.svc.createListingFilter(body);
  }

  @Patch('admin/listing-filters/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminUpdateListingFilter(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.svc.updateListingFilter(id, body);
  }

  @Delete('admin/listing-filters/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminDeleteListingFilter(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.svc.deleteListingFilter(id);
  }

  @Post('admin/listing-filters/reorder')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  adminReorderListingFilters(@Request() req, @Body() body: { orderedIds: string[] }) {
    this.assertAdmin(req);
    return this.svc.reorderListingFilters(body.orderedIds);
  }
}

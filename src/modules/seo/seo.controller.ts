import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, ForbiddenException, DefaultValuePipe,
  ParseIntPipe, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SeoService } from './seo.service';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('seo')
@Controller('seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  private assertAdmin(req: any) {
    const role = req.user?.role;
    const isAdmin = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN || req.user?.isSuperAdmin;
    if (!isAdmin) throw new ForbiddenException('Admin access required');
  }

  // ── Public: Listing Page SEO Resolver ────────────────────────────────────

  @Get('listing-page')
  @ApiOperation({ summary: 'Resolve SEO config for a listing page (priority-based)' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'locality', required: false })
  @ApiQuery({ name: 'url', required: false, description: 'Raw URL slug for footer-link SEO lookup (Priority 0)' })
  async resolveListingPage(
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('locality') locality?: string,
    @Query('url') url?: string,
  ) {
    const config = await this.seoService.resolveListingPageSeo({
      categorySlug: category,
      citySlug: city,
      localitySlug: locality,
      urlSlug: url,
    });
    if (!config) throw new NotFoundException('No SEO configuration found for this page');
    return config;
  }

  // ── Public: Categories SEO ────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'Get all active categories with SEO content (public)' })
  getCategoriesSeo() {
    return this.seoService.getCategoriesSeo();
  }

  @Get('categories/:slug')
  @ApiOperation({ summary: 'Get category SEO content by slug (public)' })
  getCategorySeoBySlug(@Param('slug') slug: string) {
    return this.seoService.getCategorySeoBySlug(slug);
  }

  // ── Public: Legacy City Pages ─────────────────────────────────────────────

  @Get('city-pages/:slug')
  @ApiOperation({ summary: 'Get city SEO page by slug (public)' })
  getCityPageBySlug(@Param('slug') slug: string) {
    return this.seoService.getCityPageBySlug(slug);
  }

  // ── Public: Locality SEO ──────────────────────────────────────────────────

  @Get('locality-pages/:slug')
  @ApiOperation({ summary: 'Get locality SEO page by slug (public)' })
  getLocalitySeoBySlug(@Param('slug') slug: string) {
    return this.seoService.getLocalitySeoBySlug(slug);
  }

  // ── Public: Category+City SEO ─────────────────────────────────────────────

  @Get('category-city-pages/:slug')
  @ApiOperation({ summary: 'Get category+city SEO page by slug (public)' })
  getCategoryCitySeoBySlug(@Param('slug') slug: string) {
    return this.seoService.getCategoryCitySeoBySlug(slug);
  }

  // ── Public: Category+Locality SEO ─────────────────────────────────────────

  @Get('category-locality-pages/:slug')
  @ApiOperation({ summary: 'Get category+locality SEO page by slug (public)' })
  getCategoryLocalitySeoBySlug(@Param('slug') slug: string) {
    return this.seoService.getCategoryLocalitySeoBySlug(slug);
  }

  // ── Public: Footer Links ──────────────────────────────────────────────────

  @Get('footer-links')
  @ApiOperation({ summary: 'Get active footer SEO links (public)' })
  getActiveFooterLinks() {
    return this.seoService.getActiveFooterLinksWithGroups();
  }

  @Get('config')
  @ApiOperation({ summary: 'Get SEO config as key-value map (public)' })
  getSeoConfigMap() {
    return this.seoService.getSeoConfigAsMap();
  }

  // ── Admin: Legacy City Pages ──────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('admin/city-pages')
  @ApiOperation({ summary: 'List all city SEO pages (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getCityPages(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.seoService.getCityPages(page, limit, search);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('admin/city-pages')
  @ApiOperation({ summary: 'Create city SEO page (admin)' })
  createCityPage(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.createCityPage(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('admin/city-pages/:id')
  @ApiOperation({ summary: 'Update city SEO page (admin)' })
  updateCityPage(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.updateCityPage(id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('admin/city-pages/:id')
  @ApiOperation({ summary: 'Delete city SEO page (admin)' })
  deleteCityPage(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.seoService.deleteCityPage(id);
  }

  // ── Admin: Locality SEO ───────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('admin/locality-pages')
  @ApiOperation({ summary: 'List all locality SEO pages (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getLocalitySeoPages(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.seoService.getLocalitySeoPages(page, limit, search);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('admin/locality-pages')
  @ApiOperation({ summary: 'Create locality SEO page (admin)' })
  createLocalitySeo(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.createLocalitySeo(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('admin/locality-pages/:id')
  @ApiOperation({ summary: 'Update locality SEO page (admin)' })
  updateLocalitySeo(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.updateLocalitySeo(id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('admin/locality-pages/:id')
  @ApiOperation({ summary: 'Delete locality SEO page (admin)' })
  deleteLocalitySeo(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.seoService.deleteLocalitySeo(id);
  }

  // ── Admin: Category+City SEO ──────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('admin/category-city-pages')
  @ApiOperation({ summary: 'List all category+city SEO pages (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getCategoryCitySeoPages(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.seoService.getCategoryCitySeoPages(page, limit, search);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('admin/category-city-pages')
  @ApiOperation({ summary: 'Create category+city SEO page (admin)' })
  createCategoryCitySeo(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.createCategoryCitySeo(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('admin/category-city-pages/:id')
  @ApiOperation({ summary: 'Update category+city SEO page (admin)' })
  updateCategoryCitySeo(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.updateCategoryCitySeo(id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('admin/category-city-pages/:id')
  @ApiOperation({ summary: 'Delete category+city SEO page (admin)' })
  deleteCategoryCitySeo(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.seoService.deleteCategoryCitySeo(id);
  }

  // ── Admin: Category+Locality SEO ──────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('admin/category-locality-pages')
  @ApiOperation({ summary: 'List all category+locality SEO pages (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getCategoryLocalitySeoPages(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.seoService.getCategoryLocalitySeoPages(page, limit, search);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('admin/category-locality-pages')
  @ApiOperation({ summary: 'Create category+locality SEO page (admin)' })
  createCategoryLocalitySeo(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.createCategoryLocalitySeo(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('admin/category-locality-pages/:id')
  @ApiOperation({ summary: 'Update category+locality SEO page (admin)' })
  updateCategoryLocalitySeo(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.updateCategoryLocalitySeo(id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('admin/category-locality-pages/:id')
  @ApiOperation({ summary: 'Delete category+locality SEO page (admin)' })
  deleteCategoryLocalitySeo(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.seoService.deleteCategoryLocalitySeo(id);
  }

  // ── Admin: SEO Config ─────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('admin/configs')
  @ApiOperation({ summary: 'Get all SEO configs (admin)' })
  getAllConfigs(@Request() req) {
    this.assertAdmin(req);
    return this.seoService.getAllSeoConfigs();
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('admin/configs/bulk')
  @ApiOperation({ summary: 'Bulk upsert SEO configs (admin)' })
  bulkUpsertConfigs(@Request() req, @Body() body: { configs: { key: string; value: string; label?: string; description?: string }[] }) {
    this.assertAdmin(req);
    return this.seoService.bulkUpsertSeoConfig(body.configs);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('admin/configs/:key')
  @ApiOperation({ summary: 'Update single SEO config by key (admin)' })
  upsertConfig(@Request() req, @Param('key') key: string, @Body() body: { value: string }) {
    this.assertAdmin(req);
    return this.seoService.upsertSeoConfig(key, body.value);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('admin/configs/:id')
  @ApiOperation({ summary: 'Delete SEO config (admin)' })
  deleteConfig(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.seoService.deleteSeoConfig(id);
  }

  // ── Admin: Footer Groups ──────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('admin/footer-groups')
  @ApiOperation({ summary: 'List all footer link groups with links (admin)' })
  getFooterGroups(@Request() req) {
    this.assertAdmin(req);
    return this.seoService.getFooterLinksWithGroups();
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('admin/footer-groups')
  @ApiOperation({ summary: 'Create footer link group (admin)' })
  createFooterGroup(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.createFooterGroup(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('admin/footer-groups/:id')
  @ApiOperation({ summary: 'Update footer link group (admin)' })
  updateFooterGroup(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.updateFooterGroup(id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('admin/footer-groups/:id')
  @ApiOperation({ summary: 'Delete footer link group (admin)' })
  deleteFooterGroup(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.seoService.deleteFooterGroup(id);
  }

  // ── Admin: Footer Links ───────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('admin/footer-links')
  @ApiOperation({ summary: 'Create footer link (admin)' })
  createFooterLink(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.createFooterLink(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('admin/footer-links/:id')
  @ApiOperation({ summary: 'Update footer link (admin)' })
  updateFooterLink(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.seoService.updateFooterLink(id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('admin/footer-links/:id')
  @ApiOperation({ summary: 'Delete footer link (admin)' })
  deleteFooterLink(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.seoService.deleteFooterLink(id);
  }
}

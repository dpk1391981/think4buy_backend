import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, ForbiddenException, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SeoService } from './seo.service';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('seo')
@Controller('seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== UserRole.ADMIN) throw new ForbiddenException('Admin access required');
  }

  // ── Public endpoints ─────────────────────────────────────────────────────────

  @Get('city-pages/:slug')
  @ApiOperation({ summary: 'Get city SEO page by slug (public)' })
  getCityPageBySlug(@Param('slug') slug: string) {
    return this.seoService.getCityPageBySlug(slug);
  }

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

  // ── Admin endpoints ──────────────────────────────────────────────────────────

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

  // ── SEO Config ──────────────────────────────────────────────────────────────

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

  // ── Footer Link Groups ──────────────────────────────────────────────────────

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

  // ── Footer Links ─────────────────────────────────────────────────────────────

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

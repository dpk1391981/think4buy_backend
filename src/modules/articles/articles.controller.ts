import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, Req, UseGuards,
  ParseIntPipe, DefaultValuePipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ArticlesService } from './articles.service';
import { CreateArticleDto, UpdateArticleDto } from './dto/create-article.dto';
import { UserRole } from '../users/entities/user.entity';

function assertAdmin(req: any) {
  if (req.user?.role !== UserRole.ADMIN) {
    const { ForbiddenException } = require('@nestjs/common');
    throw new ForbiddenException('Admin access required');
  }
}

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  // ── Public endpoints ──────────────────────────────────────────────────────

  @Get()
  findPublished(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('featured') featured?: string,
  ) {
    return this.articlesService.findPublished({
      page, limit, category, search,
      featured: featured === 'true',
    });
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.articlesService.findBySlug(slug);
  }

  // ── Admin endpoints ───────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/list')
  adminList(
    @Req() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    assertAdmin(req);
    return this.articlesService.adminFindAll({ page, limit, status, category, search });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/:id')
  adminGetOne(@Req() req: any, @Param('id') id: string) {
    assertAdmin(req);
    return this.articlesService.adminFindOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('admin')
  @HttpCode(HttpStatus.CREATED)
  adminCreate(@Req() req: any, @Body() dto: CreateArticleDto) {
    assertAdmin(req);
    return this.articlesService.create(dto, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:id')
  adminUpdate(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateArticleDto) {
    assertAdmin(req);
    return this.articlesService.update(id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('admin/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  adminDelete(@Req() req: any, @Param('id') id: string) {
    assertAdmin(req);
    return this.articlesService.delete(id);
  }
}

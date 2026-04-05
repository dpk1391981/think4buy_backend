import { Controller, Get, Param, Query, ParseIntPipe, DefaultValuePipe, Optional } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BuildersService } from './builders.service';

@ApiTags('builders')
@Controller('builders')
export class BuildersController {
  constructor(private readonly buildersService: BuildersService) {}

  /**
   * GET /api/v1/builders
   * Returns top builders grouped with their project stats and a preview of top projects.
   * ?city=Noida  → city-scoped  (for city pages)
   * (no city)    → all-India    (for homepage)
   * ?limit=6     → max builders to return (default 6)
   */
  @Get()
  @ApiOperation({ summary: 'Get top builders with project summaries' })
  @ApiQuery({ name: 'city',  required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getBuilders(
    @Query('city')  city?: string,
    @Query('limit', new DefaultValuePipe(6), ParseIntPipe) limit?: number,
  ) {
    return this.buildersService.getBuilders(city, limit);
  }

  /**
   * GET /api/v1/builders/:slug
   * Builder detail page: summary + paginated project list.
   * Slug format:  "godrej"  or  "godrej-in-noida"
   * ?page=1 &limit=12 &status=ready_to_move &city=Noida
   */
  @Get(':slug')
  @ApiOperation({ summary: 'Get builder detail with paginated projects' })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'city',   required: false })
  getBuilderDetail(
    @Param('slug') slug: string,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit?: number,
    @Query('status') status?: string,
    @Query('city')   city?: string,
  ) {
    return this.buildersService.getBuilderDetail(slug, page, limit, status, city);
  }
}

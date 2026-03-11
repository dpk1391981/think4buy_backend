import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ServicesCatalogService } from './services-catalog.service';

@ApiTags('services')
@Controller('services')
export class ServicesCatalogController {
  constructor(private readonly servicesCatalogService: ServicesCatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active platform services' })
  findAll() {
    return this.servicesCatalogService.findAll();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get service by slug' })
  findOne(@Param('slug') slug: string) {
    return this.servicesCatalogService.findBySlug(slug);
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search locations' })
  search(@Query('q') query: string) {
    return this.locationsService.search(query || '');
  }

  @Get('cities')
  @ApiOperation({ summary: 'Get cities — optional ?search=&limit= for async typeahead' })
  getCities(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.locationsService.getCities(search, limit ? Math.min(parseInt(limit, 10), 200) : 50);
  }

  @Get('localities')
  @ApiOperation({ summary: 'Get localities by city — optional ?search= for typeahead' })
  getLocalities(
    @Query('city') city: string,
    @Query('state') state?: string,
    @Query('search') search?: string,
  ) {
    return this.locationsService.getLocalitiesByCityName(city, state, search);
  }

  @Get('states')
  @ApiOperation({ summary: 'Get all active states (public)' })
  getStates() {
    return this.locationsService.getStates(true);
  }

  @Get('states-with-stats')
  @SkipThrottle()
  @ApiOperation({ summary: 'All active states with city count + property category breakdown' })
  getStatesWithStats() {
    return this.locationsService.getStatesWithStats();
  }

  @Get('states/by-slug/:slug')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get state details + cities by state slug (public)' })
  getStateBySlug(@Param('slug') slug: string) {
    return this.locationsService.getStateBySlug(slug);
  }

  @Get('states/:stateId/cities')
  @ApiOperation({ summary: 'Get cities for a given state (public)' })
  getCitiesByState(@Param('stateId') stateId: string) {
    return this.locationsService.getCitiesByState(stateId, true);
  }

  @Get('top-cities')
  @SkipThrottle()
  @ApiOperation({ summary: 'Top 12 cities by active property count with type breakdown' })
  getTopCities() {
    return this.locationsService.getTopCities();
  }

  @Get('seo')
  @ApiOperation({ summary: 'Get SEO content for a city or state (public)' })
  getLocationSeoContent(
    @Query('city') city?: string,
    @Query('state') state?: string,
  ) {
    return this.locationsService.getLocationSeoContent(city, state);
  }
}

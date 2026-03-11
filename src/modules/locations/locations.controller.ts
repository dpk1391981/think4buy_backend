import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get all cities' })
  getCities() {
    return this.locationsService.getCities();
  }

  @Get('localities')
  @ApiOperation({ summary: 'Get localities by city' })
  getLocalities(@Query('city') city: string) {
    return this.locationsService.getLocalitiesByCity(city);
  }

  @Get('states')
  @ApiOperation({ summary: 'Get all active states (public)' })
  getStates() {
    return this.locationsService.getStates(true);
  }

  @Get('states/:stateId/cities')
  @ApiOperation({ summary: 'Get cities for a given state (public)' })
  getCitiesByState(@Param('stateId') stateId: string) {
    return this.locationsService.getCitiesByState(stateId, true);
  }
}

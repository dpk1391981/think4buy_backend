import { Controller, Get, Patch, Body, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform user stats' })
  getStats() {
    return this.usersService.getStats();
  }

  @Get('agents')
  @ApiOperation({ summary: 'Get all active agents' })
  getAgents(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('city') city?: string,
    @Query('cityId') cityId?: string,
    @Query('state') state?: string,
    @Query('stateId') stateId?: string,
    @Query('locality') locality?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.getAgents(page, limit, { city, cityId, state, stateId, locality, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  update(@Request() req, @Body() dto: any) {
    return this.usersService.update(req.user.id, dto);
  }

  @Get('me/listings')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user property listings' })
  getMyListings(@Request() req) {
    return this.usersService.getUserListings(req.user.id);
  }
}

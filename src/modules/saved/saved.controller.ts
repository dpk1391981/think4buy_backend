import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SavedService } from './saved.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('saved')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('saved')
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @Get('properties')
  @ApiOperation({ summary: 'Get user saved properties' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSaved(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.savedService.getSavedProperties(req.user.id, page, limit);
  }

  @Get('properties/ids')
  @ApiOperation({ summary: 'Get IDs of all saved properties' })
  getSavedIds(@Request() req) {
    return this.savedService.getSavedIds(req.user.id);
  }

  @Post('properties/:propertyId')
  @ApiOperation({ summary: 'Save a property' })
  save(@Request() req, @Param('propertyId') propertyId: string) {
    return this.savedService.saveProperty(req.user.id, propertyId);
  }

  @Delete('properties/:propertyId')
  @ApiOperation({ summary: 'Remove property from saved' })
  unsave(@Request() req, @Param('propertyId') propertyId: string) {
    return this.savedService.unsaveProperty(req.user.id, propertyId);
  }
}

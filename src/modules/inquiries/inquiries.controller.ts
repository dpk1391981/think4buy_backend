import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InquiriesService, CreateInquiryDto } from './inquiries.service';

@ApiTags('inquiries')
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post('property/:propertyId')
  @ApiOperation({ summary: 'Send inquiry for a property' })
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateInquiryDto,
  ) {
    return this.inquiriesService.create(propertyId, dto);
  }

  @Post('agent/:agentId')
  @ApiOperation({ summary: 'Send a direct inquiry to an agent — public, no login required' })
  contactAgent(
    @Param('agentId') agentId: string,
    @Body() dto: CreateInquiryDto,
  ) {
    return this.inquiriesService.contactAgent(agentId, dto);
  }

  @Get('property/:propertyId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get inquiries for a property' })
  findByProperty(@Param('propertyId') propertyId: string) {
    return this.inquiriesService.findByProperty(propertyId);
  }

  @Get('my-inquiries')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get inquiries received on my properties' })
  getMyInquiries(@Request() req) {
    return this.inquiriesService.findByOwner(req.user.id);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated inquiries received on my properties' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMyInquiriesPaginated(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.inquiriesService.findByOwnerPaginated(req.user.id, page, limit);
  }
}

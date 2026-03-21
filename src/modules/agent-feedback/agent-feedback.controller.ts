import {
  Controller, Post, Get, Param, Body, Query,
  UseGuards, Request, HttpCode, HttpStatus, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsInt, IsString, IsOptional, Min, Max, MaxLength } from 'class-validator';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { AgentFeedbackService } from './agent-feedback.service';

class SubmitFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

@ApiTags('agent-feedback')
@Controller('agent-feedback')
export class AgentFeedbackController {
  constructor(private readonly feedbackService: AgentFeedbackService) {}

  /** POST /agent-feedback/:agentId — submit a review (auth required) */
  @Post(':agentId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a review for an agent' })
  submit(
    @Param('agentId') agentId: string,
    @Request() req: any,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.feedbackService.submit(agentId, req.user.id, dto);
  }

  /** GET /agent-feedback/:agentId — list reviews (public) */
  @Get(':agentId')
  @ApiOperation({ summary: 'List reviews for an agent' })
  list(
    @Param('agentId') agentId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.feedbackService.list(agentId, page, limit);
  }

  /** GET /agent-feedback/:agentId/has-reviewed — check if current user already reviewed */
  @Get(':agentId/has-reviewed')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Check if current user has already reviewed this agent' })
  async hasReviewed(
    @Param('agentId') agentId: string,
    @Request() req: any,
  ) {
    if (!req.user) return { hasReviewed: false };
    const result = await this.feedbackService.hasReviewed(agentId, req.user.id);
    return { hasReviewed: result };
  }
}

import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AgentService } from './agent.service';

@ApiTags('agent')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get agent dashboard stats' })
  getDashboard(@Request() req) {
    return this.agentService.getDashboardStats(req.user.id);
  }
}

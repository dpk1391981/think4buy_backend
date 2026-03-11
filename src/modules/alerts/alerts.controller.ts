import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AlertsService, CreateAlertDto } from './alerts.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all alerts for current user' })
  getAlerts(@Request() req) {
    return this.alertsService.getUserAlerts(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new property alert' })
  createAlert(@Request() req, @Body() dto: CreateAlertDto) {
    return this.alertsService.createAlert(req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an alert' })
  updateAlert(@Request() req, @Param('id') id: string, @Body() dto: Partial<CreateAlertDto>) {
    return this.alertsService.updateAlert(req.user.id, id, dto);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle alert active/inactive' })
  toggleAlert(@Request() req, @Param('id') id: string) {
    return this.alertsService.toggleAlert(req.user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an alert' })
  deleteAlert(@Request() req, @Param('id') id: string) {
    return this.alertsService.deleteAlert(req.user.id, id);
  }
}

import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../users/entities/user.entity';
import { SystemConfigService } from './system-config.service';
import { ConfigValueType } from './entities/system-config.entity';

class UpsertConfigDto {
  value: any;
  valueType?: ConfigValueType;
  description?: string;
  group?: string;
}

/**
 * GET  /config/public          — public feature flags (non-secret)
 * GET  /admin/config           — all configs (admin only)
 * PUT  /admin/config/:key      — upsert config value
 * DELETE /admin/config/:key    — remove config
 */
@Controller()
export class SystemConfigController {
  constructor(private readonly svc: SystemConfigService) {}

  private assertAdmin(req: any) {
    const role = req.user?.role;
    if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN && !req.user?.isSuperAdmin) {
      throw new ForbiddenException('Admin access required');
    }
  }

  /**
   * Public endpoint — returns boolean feature flags safe to expose to frontend.
   * Only non-secret configs from the 'feature' and 'media' groups.
   */
  @Get('config/public')
  async getPublicFlags() {
    const all = await this.svc.getAll();
    const flags: Record<string, any> = {};
    for (const c of all) {
      if (c.isSecret) continue;
      if (!['feature', 'media', 'general'].includes(c.group)) continue;
      flags[c.key] = this.parseValue(c.value, c.valueType);
    }
    return flags;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/config')
  async getAll(@Request() req: any, @Query('group') group?: string) {
    this.assertAdmin(req);
    return this.svc.getAll(group);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('admin/config/:key')
  async upsert(@Request() req: any, @Param('key') key: string, @Body() body: UpsertConfigDto) {
    this.assertAdmin(req);
    return this.svc.set(key, body.value, {
      valueType:   body.valueType,
      description: body.description,
      group:       body.group,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('admin/config/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req: any, @Param('key') key: string) {
    this.assertAdmin(req);
    await this.svc.delete(key);
  }

  private parseValue(raw: string, type: ConfigValueType): any {
    switch (type) {
      case ConfigValueType.BOOLEAN: return raw === 'true' || raw === '1';
      case ConfigValueType.NUMBER:  return Number(raw);
      case ConfigValueType.JSON:    try { return JSON.parse(raw); } catch { return raw; }
      default: return raw;
    }
  }
}

import {
  Controller, Get, Post, Patch, Delete, Put,
  Body, Param, Query, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  CreateRoleDto, UpdateRoleDto, SetRolePermissionsDto,
  CreatePermissionDto, UpdatePermissionDto,
  AssignUserRoleDto, AuditLogQueryDto,
} from './dto/rbac.dto';

const JwtAuth  = () => UseGuards(AuthGuard('jwt'));
const PermAuth = (...p: string[]) => UseGuards(AuthGuard('jwt'), PermissionGuard);

function actorMeta(req: any) {
  return { name: req.user?.name, role: req.user?.role };
}

function actorLevel(req: any): number {
  // Super admin → level 101 (above everything)
  if (req.user?.isSuperAdmin) return 101;
  // Map role to level for privilege-escalation checks
  const levelMap: Record<string, number> = {
    admin: 80, broker: 60, agent: 50, owner: 40, buyer: 20,
  };
  return levelMap[req.user?.role] ?? 0;
}

@ApiTags('RBAC')
@ApiBearerAuth()
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  // ── Current user's permissions ─────────────────────────────────────────────

  @Get('my-permissions')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get all permissions held by the authenticated user' })
  async myPermissions(@Request() req: any) {
    if (req.user.isSuperAdmin) {
      return {
        isSuperAdmin: true,
        permissions: Array.from(await this.rbac.getUserPermissions(req.user.id, true)),
      };
    }
    const perms = await this.rbac.getUserPermissions(req.user.id);
    return { isSuperAdmin: false, permissions: Array.from(perms) };
  }

  // ── Roles ──────────────────────────────────────────────────────────────────

  @Get('roles')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('role.view')
  @ApiOperation({ summary: 'List all roles with their permissions' })
  async listRoles() {
    return { success: true, data: await this.rbac.getRoles() };
  }

  @Get('roles/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('role.view')
  @ApiOperation({ summary: 'Get a single role with permissions' })
  async getRole(@Param('id') id: string) {
    return { success: true, data: await this.rbac.getRole(id) };
  }

  @Post('roles')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('role.create')
  @ApiOperation({ summary: 'Create a new role' })
  async createRole(@Body() dto: CreateRoleDto, @Request() req: any) {
    const data = await this.rbac.createRole(dto, req.user.id, actorMeta(req));
    return { success: true, data };
  }

  @Patch('roles/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('role.edit')
  @ApiOperation({ summary: 'Update role metadata' })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto, @Request() req: any) {
    const data = await this.rbac.updateRole(id, dto, req.user.id, actorMeta(req));
    return { success: true, data };
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('role.delete')
  @ApiOperation({ summary: 'Delete a non-system role' })
  async deleteRole(@Param('id') id: string, @Request() req: any) {
    await this.rbac.deleteRole(id, req.user.id, actorMeta(req));
    return { success: true };
  }

  @Put('roles/:id/permissions')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('role.assign_permissions')
  @ApiOperation({ summary: 'Replace all permissions for a role (bulk set)' })
  async setRolePermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
    @Request() req: any,
  ) {
    const data = await this.rbac.setRolePermissions(id, dto, req.user.id, actorLevel(req), actorMeta(req));
    return { success: true, data };
  }

  // ── Permissions ────────────────────────────────────────────────────────────

  @Get('permissions')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('permission.view')
  @ApiOperation({ summary: 'List all system permissions grouped by module' })
  async listPermissions() {
    const all = await this.rbac.getPermissions();
    // Group by module for UI convenience
    const grouped: Record<string, typeof all> = {};
    for (const p of all) {
      (grouped[p.module] ??= []).push(p);
    }
    return { success: true, data: all, grouped };
  }

  @Post('permissions')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('permission.create')
  @ApiOperation({ summary: 'Create a new permission key' })
  async createPermission(@Body() dto: CreatePermissionDto, @Request() req: any) {
    const data = await this.rbac.createPermission(dto, req.user.id, actorMeta(req));
    return { success: true, data };
  }

  @Patch('permissions/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('permission.edit')
  @ApiOperation({ summary: 'Update permission metadata' })
  async updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
    @Request() req: any,
  ) {
    const data = await this.rbac.updatePermission(id, dto, req.user.id, actorMeta(req));
    return { success: true, data };
  }

  @Delete('permissions/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('permission.delete')
  @ApiOperation({ summary: 'Delete an unused permission' })
  async deletePermission(@Param('id') id: string, @Request() req: any) {
    await this.rbac.deletePermission(id, req.user.id, actorMeta(req));
    return { success: true };
  }

  // ── User ↔ Role ────────────────────────────────────────────────────────────

  @Post('users/:userId/role')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('role.assign_permissions')
  @ApiOperation({ summary: 'Assign a dynamic role to a user' })
  async assignRole(
    @Param('userId') userId: string,
    @Body() dto: AssignUserRoleDto,
    @Request() req: any,
  ) {
    await this.rbac.assignRoleToUser(userId, dto.roleId, req.user.id, actorLevel(req), actorMeta(req));
    return { success: true };
  }

  @Delete('users/:userId/role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('role.assign_permissions')
  @ApiOperation({ summary: 'Remove the dynamic role from a user' })
  async removeRole(@Param('userId') userId: string, @Request() req: any) {
    await this.rbac.removeRoleFromUser(userId, req.user.id, actorMeta(req));
    return { success: true };
  }

  // ── Audit Logs ─────────────────────────────────────────────────────────────

  @Get('audit-logs')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('audit.view')
  @ApiOperation({ summary: 'Paginated, filterable audit log' })
  async auditLogs(@Query() query: AuditLogQueryDto) {
    return { success: true, ...(await this.rbac.getAuditLogs(query)) };
  }
}

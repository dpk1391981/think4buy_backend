import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MenusService } from './menus.service';
import { UserRole } from '../users/entities/user.entity';

function requireAdmin(user: any) {
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.isSuperAdmin;
  if (!isAdmin) {
    throw new ForbiddenException('Admin access required');
  }
}

@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  /** GET /api/v1/menus/me — returns menus for the authenticated user's role */
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMyMenus(@Request() req: any) {
    return this.menusService.getMenusForRole(req.user.role);
  }

  /** GET /api/v1/menus/by-role/:role — returns menus for a given role (admin only) */
  @UseGuards(AuthGuard('jwt'))
  @Get('by-role/:role')
  getMenusByRole(@Request() req: any, @Param('role') role: string) {
    requireAdmin(req.user);
    return this.menusService.getMenusForRole(role);
  }

  /** GET /api/v1/menus/admin/all — list all menus */
  @UseGuards(AuthGuard('jwt'))
  @Get('admin/all')
  getAllMenus(@Request() req: any) {
    requireAdmin(req.user);
    return this.menusService.getAllMenus();
  }

  /** GET /api/v1/menus/admin/matrix — full role × menu permissions matrix */
  @UseGuards(AuthGuard('jwt'))
  @Get('admin/matrix')
  getMatrix(@Request() req: any) {
    requireAdmin(req.user);
    return this.menusService.getPermissionsMatrix();
  }

  /** GET /api/v1/menus/admin/role/:role — permissions for a specific role */
  @UseGuards(AuthGuard('jwt'))
  @Get('admin/role/:role')
  getRolePermissions(@Request() req: any, @Param('role') role: UserRole) {
    requireAdmin(req.user);
    return this.menusService.getPermissionsForRole(role);
  }

  /** PATCH /api/v1/menus/admin/permission — toggle menu visibility for a role */
  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/permission')
  togglePermission(
    @Request() req: any,
    @Body() body: { role: UserRole; menuId: number; isVisible: boolean },
  ) {
    requireAdmin(req.user);
    return this.menusService.togglePermission(body.role, body.menuId, body.isVisible);
  }

  /** PATCH /api/v1/menus/admin/:id/order — update sort order */
  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:id/order')
  updateOrder(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { sortOrder: number },
  ) {
    requireAdmin(req.user);
    return this.menusService.updateMenuOrder(+id, body.sortOrder);
  }

  /** GET /api/v1/menus/admin/seed — re-run seed (admin only) */
  @UseGuards(AuthGuard('jwt'))
  @Get('admin/seed')
  runSeed(@Request() req: any) {
    requireAdmin(req.user);
    return this.menusService.seed().then(() => ({ message: 'Seed complete' }));
  }
}

import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permissions';

/**
 * Declares the permission key(s) required to access a route.
 * Use alongside AuthGuard('jwt') and PermissionGuard.
 *
 * @example
 * @UseGuards(AuthGuard('jwt'), PermissionGuard)
 * @RequirePermission('property.approve')
 * @Patch(':id/approve')
 * approveProperty() { ... }
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSION_KEY, permissions);

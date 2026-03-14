import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';

export const ROLES_KEY = 'roles';

/** Attach required roles to a route: @Roles(UserRole.ADMIN, UserRole.AGENT) */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

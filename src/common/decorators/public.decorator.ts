import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public (no JWT required).
 * Works together with JwtAuthGuard — if the route has @Public(),
 * the guard skips token validation.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

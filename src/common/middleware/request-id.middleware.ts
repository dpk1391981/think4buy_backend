import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

/**
 * Attaches a unique request ID to every request.
 * Used for log correlation and API tracing.
 * Forwarded in the X-Request-ID response header.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const reqId = (req.headers['x-request-id'] as string) || randomBytes(8).toString('hex');
    req['requestId'] = reqId;
    res.setHeader('X-Request-ID', reqId);
    next();
  }
}

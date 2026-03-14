import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * Global exception filter — normalises all errors into a consistent shape.
 * Strips internal stack traces and DB details from production responses.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx     = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code    = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && (body as any).message) {
        message = (body as any).message;
      }
      code = this.statusToCode(status);
    } else if (exception instanceof QueryFailedError) {
      // Never expose raw SQL errors to clients
      status  = HttpStatus.BAD_REQUEST;
      message = 'Database operation failed';
      code    = 'DB_ERROR';
      this.logger.error(`QueryFailedError: ${(exception as any).message}`, (exception as any).stack);
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled Error: ${exception.message}`, exception.stack);
    }

    // Only log 5xx in production
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} — ${status}: ${JSON.stringify(message)}`,
      );
    } else if (status >= 400 && process.env.NODE_ENV !== 'production') {
      this.logger.warn(
        `[${request.method}] ${request.url} — ${status}: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      // Include requestId if set by middleware
      ...(request['requestId'] && { requestId: request['requestId'] }),
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? 'UNKNOWN_ERROR';
  }
}

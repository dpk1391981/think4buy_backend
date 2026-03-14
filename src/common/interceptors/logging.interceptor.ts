import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Logs every inbound request with method, URL, IP, user, and response time.
 * In production this feeds into your log aggregator (Elastic/Datadog/CloudWatch).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx      = context.switchToHttp();
    const request  = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const start    = Date.now();

    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'] ?? '';
    const userId    = (request as any).user?.id ?? 'anonymous';
    const reqId     = request['requestId'] ?? '-';

    return next.handle().pipe(
      tap({
        next: () => {
          const ms     = Date.now() - start;
          const status = response.statusCode;

          if (process.env.NODE_ENV !== 'production') {
            this.logger.log(
              `[${reqId}] ${method} ${url} ${status} ${ms}ms — uid:${userId} ip:${ip}`,
            );
          } else {
            // Structured JSON for log aggregator
            this.logger.log(
              JSON.stringify({
                reqId, method, url, status, ms,
                userId, ip,
                ua: userAgent.slice(0, 120),
              }),
            );
          }
        },
        error: (err) => {
          const ms = Date.now() - start;
          this.logger.warn(
            `[${reqId}] ${method} ${url} ERROR ${ms}ms — ${err?.message}`,
          );
        },
      }),
    );
  }
}

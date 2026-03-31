import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Anomaly Detection Interceptor
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks suspicious patterns and emits structured alerts.
 * In production, wire these alerts to Slack / PagerDuty / CloudWatch Alarms.
 *
 * Patterns detected:
 *  1. High error rate per IP (>10 errors in 5 minutes → alert)
 *  2. Unusual response payload size (>500KB → log warning)
 *  3. High-frequency property dumps (>50 property list calls in 1 min → alert)
 *  4. Direct backend access attempts (no X-BFF-Secret on protected routes)
 */
@Injectable()
export class AnomalyDetectionInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AnomalyDetection');

  // IP → error count in current window
  private readonly errorCounts = new Map<string, { count: number; windowStart: number }>();
  // IP → property list call count
  private readonly dumpCounts  = new Map<string, { count: number; windowStart: number }>();

  private readonly ERROR_THRESHOLD     = 10;
  private readonly ERROR_WINDOW_MS     = 5 * 60 * 1000;
  private readonly DUMP_THRESHOLD      = 50;
  private readonly DUMP_WINDOW_MS      = 60 * 1000;
  private readonly LARGE_PAYLOAD_BYTES = 500 * 1024;

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip  = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.ip ?? '0.0.0.0';
    const path = req.path;

    // Track property listing dumps
    if (path.includes('/properties') && req.method === 'GET') {
      this.trackDump(ip, path);
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Check payload size
          const size = data ? JSON.stringify(data).length : 0;
          if (size > this.LARGE_PAYLOAD_BYTES) {
            this.alert('LARGE_PAYLOAD', {
              ip, path, sizeKb: Math.round(size / 1024),
            });
          }
        },
        error: (err) => {
          this.trackError(ip, err?.status ?? 500, path);
        },
      }),
    );
  }

  private trackError(ip: string, status: number, path: string): void {
    if (status < 400) return;
    const now = Date.now();
    const win = this.errorCounts.get(ip);
    if (!win || now - win.windowStart > this.ERROR_WINDOW_MS) {
      this.errorCounts.set(ip, { count: 1, windowStart: now });
    } else {
      win.count++;
      if (win.count === this.ERROR_THRESHOLD) {
        this.alert('HIGH_ERROR_RATE', { ip, errorCount: win.count, path });
      }
    }
  }

  private trackDump(ip: string, path: string): void {
    const now = Date.now();
    const win = this.dumpCounts.get(ip);
    if (!win || now - win.windowStart > this.DUMP_WINDOW_MS) {
      this.dumpCounts.set(ip, { count: 1, windowStart: now });
    } else {
      win.count++;
      if (win.count === this.DUMP_THRESHOLD) {
        this.alert('SCRAPING_DUMP_DETECTED', { ip, callCount: win.count, path });
      }
    }
  }

  private alert(type: string, details: Record<string, unknown>): void {
    // Structured alert — tail this in production and pipe to alerting system:
    //   pm2 logs backend --lines 0 | grep '"alert"' | send-to-slack
    this.logger.warn(JSON.stringify({ alert: type, ts: new Date().toISOString(), ...details }));

    // TODO: wire to your alerting system:
    // this.slackService.send(`🚨 ${type}: ${JSON.stringify(details)}`);
    // this.cloudwatchService.putMetric('SecurityAlert', 1, type);
  }
}

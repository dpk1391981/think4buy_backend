import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  Sse,
  MessageEvent,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  /** SSE real-time stream — token passed as ?token=xxx because EventSource can't set headers */
  @Sse('stream')
  stream(@Req() req: any): Observable<MessageEvent> {
    const userId: string = req.user.id;
    req.on('close', () => this.svc.removeStream(userId));
    return this.svc.getStream(userId);
  }

  /** Paginated notification history */
  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('isRead') isRead?: string,
  ) {
    return this.svc.findAll(req.user.id, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      type,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
    });
  }

  /** Recent 10 for the bell dropdown */
  @Get('recent')
  getRecent(@Req() req: any) {
    return this.svc.getRecent(req.user.id, 10);
  }

  /** Unread count badge */
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.svc.getUnreadCount(req.user.id);
    return { count };
  }

  /** Mark a single notification read */
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.svc.markRead(id, req.user.id);
  }

  /** Mark all notifications read */
  @Patch('mark-all-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@Req() req: any) {
    return this.svc.markAllRead(req.user.id);
  }
}

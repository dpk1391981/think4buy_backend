import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Notification, NotificationType } from './entities/notification.entity';

export interface CreateNotificationDto {
  userId: string;
  role?: string;
  title: string;
  message?: string;
  type?: NotificationType;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  // Map of userId → RxJS Subject for SSE push
  private readonly streams = new Map<string, Subject<Notification>>();

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  /** Get or create an SSE observable stream for a user */
  getStream(userId: string): Observable<MessageEvent> {
    if (!this.streams.has(userId)) {
      this.streams.set(userId, new Subject<Notification>());
    }
    return this.streams.get(userId)!.asObservable().pipe(
      map(
        (n) =>
          ({
            data: JSON.stringify(n),
            type: 'notification',
            id: n.id,
          } as MessageEvent),
      ),
    );
  }

  /** Remove SSE stream when client disconnects */
  removeStream(userId: string): void {
    const subject = this.streams.get(userId);
    if (subject) {
      subject.complete();
      this.streams.delete(userId);
    }
  }

  /** Create a notification and push to connected SSE client */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId: dto.userId,
      role: dto.role,
      title: dto.title,
      message: dto.message,
      type: dto.type ?? NotificationType.SYSTEM,
      entityType: dto.entityType,
      entityId: dto.entityId,
      isRead: false,
    });
    const saved = await this.notificationRepo.save(notification);

    // Push to SSE stream if user is currently connected
    const subject = this.streams.get(dto.userId);
    if (subject && !subject.closed) {
      subject.next(saved);
    }

    return saved;
  }

  /** Fire-and-forget notification create (no await needed) */
  createSilent(dto: CreateNotificationDto): void {
    this.create(dto).catch(() => {});
  }

  async findAll(
    userId: string,
    query: { page?: number; limit?: number; type?: string; isRead?: boolean },
  ) {
    const { page = 1, limit = 20, type, isRead } = query;
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC');

    if (type) qb.andWhere('n.type = :type', { type });
    if (isRead !== undefined) qb.andWhere('n.isRead = :isRead', { isRead });

    const total = await qb.getCount();
    const items = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRecent(userId: string, limit = 10): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.notificationRepo.update({ id, userId }, { isRead: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
  }
}

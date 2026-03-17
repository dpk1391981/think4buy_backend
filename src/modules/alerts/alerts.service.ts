import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyAlert } from './entities/property-alert.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

export interface CreateAlertDto {
  alertName: string;
  category?: string;
  city?: string;
  locality?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  frequency?: string;
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(PropertyAlert)
    private alertRepo: Repository<PropertyAlert>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Called after a property goes live (admin approval).
   * Matches the property against all active user alerts and fires notifications.
   */
  async checkAlertsForProperty(property: {
    id: string;
    title?: string;
    city?: string;
    locality?: string;
    category?: string; // buy | rent | pg | commercial
    price?: number;
  }): Promise<void> {
    const alerts = await this.alertRepo.find({ where: { isActive: true } });
    for (const alert of alerts) {
      if (alert.city && property.city &&
          !property.city.toLowerCase().includes(alert.city.toLowerCase())) continue;
      if (alert.locality && property.locality &&
          !property.locality.toLowerCase().includes(alert.locality.toLowerCase())) continue;
      if (alert.category && property.category &&
          property.category.toLowerCase() !== alert.category.toLowerCase()) continue;
      if (alert.minPrice && property.price && property.price < alert.minPrice) continue;
      if (alert.maxPrice && property.price && property.price > alert.maxPrice) continue;

      const location = [property.locality, property.city].filter(Boolean).join(', ');
      this.notificationsService.createSilent({
        userId: alert.userId,
        title: 'New property matches your alert',
        message: `A new property is now available${location ? ` in ${location}` : ''}${property.title ? `: "${property.title}"` : ''}.`,
        type: NotificationType.PROPERTY,
        entityType: 'property',
        entityId: property.id,
      });
    }
  }

  async getUserAlerts(userId: string) {
    return this.alertRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createAlert(userId: string, dto: CreateAlertDto) {
    const alert = this.alertRepo.create({ ...dto, userId });
    return this.alertRepo.save(alert);
  }

  async updateAlert(userId: string, id: string, dto: Partial<CreateAlertDto>) {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    if (alert.userId !== userId) throw new ForbiddenException();
    Object.assign(alert, dto);
    return this.alertRepo.save(alert);
  }

  async toggleAlert(userId: string, id: string) {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    if (alert.userId !== userId) throw new ForbiddenException();
    alert.isActive = !alert.isActive;
    return this.alertRepo.save(alert);
  }

  async deleteAlert(userId: string, id: string) {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    if (alert.userId !== userId) throw new ForbiddenException();
    await this.alertRepo.remove(alert);
    return { message: 'Alert deleted' };
  }
}

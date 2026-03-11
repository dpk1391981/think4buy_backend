import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyAlert } from './entities/property-alert.entity';

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
  ) {}

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

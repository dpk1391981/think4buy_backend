import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedProperty } from './entities/saved-property.entity';

@Injectable()
export class SavedService {
  constructor(
    @InjectRepository(SavedProperty)
    private savedRepo: Repository<SavedProperty>,
  ) {}

  async getSavedProperties(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.savedRepo.findAndCount({
      where: { userId },
      relations: ['property', 'property.images'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: items.map((s) => s.property).filter(Boolean), total, page, limit };
  }

  async saveProperty(userId: string, propertyId: string) {
    const existing = await this.savedRepo.findOne({ where: { userId, propertyId } });
    if (existing) throw new ConflictException('Property already saved');
    try {
      const saved = this.savedRepo.create({ userId, propertyId });
      await this.savedRepo.save(saved);
      return { message: 'Property saved' };
    } catch (e: any) {
      // Duplicate entry (race condition)
      if (e?.code === 'ER_DUP_ENTRY' || e?.code === '23505') {
        throw new ConflictException('Property already saved');
      }
      // FK violation — property doesn't exist
      if (e?.code === 'ER_NO_REFERENCED_ROW_2' || e?.code === '23503') {
        throw new NotFoundException('Property not found');
      }
      throw e;
    }
  }

  async unsaveProperty(userId: string, propertyId: string) {
    const saved = await this.savedRepo.findOne({ where: { userId, propertyId } });
    if (!saved) throw new NotFoundException('Saved property not found');
    await this.savedRepo.remove(saved);
    return { message: 'Property removed from saved' };
  }

  async isSaved(userId: string, propertyId: string): Promise<boolean> {
    const count = await this.savedRepo.count({ where: { userId, propertyId } });
    return count > 0;
  }

  async getSavedIds(userId: string): Promise<string[]> {
    const saved = await this.savedRepo.find({
      where: { userId },
      select: ['propertyId'],
    });
    return saved.map((s) => s.propertyId);
  }
}

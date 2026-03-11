import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceCatalog } from './entities/service-catalog.entity';

@Injectable()
export class ServicesCatalogService {
  constructor(
    @InjectRepository(ServiceCatalog)
    private serviceRepo: Repository<ServiceCatalog>,
  ) {}

  async findAll(): Promise<ServiceCatalog[]> {
    return this.serviceRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<ServiceCatalog> {
    return this.serviceRepo.findOne({ where: { slug, isActive: true } });
  }
}

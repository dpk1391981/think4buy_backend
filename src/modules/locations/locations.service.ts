import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Location } from './entities/location.entity';
import { State } from './entities/state.entity';
import { City } from './entities/city.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(State)
    private stateRepository: Repository<State>,
    @InjectRepository(City)
    private cityRepository: Repository<City>,
  ) {}

  async search(query: string): Promise<Location[]> {
    return this.locationRepo.find({
      where: [
        { city: Like(`%${query}%`), isActive: true },
        { locality: Like(`%${query}%`), isActive: true },
        { pincode: Like(`%${query}%`), isActive: true },
      ],
      take: 10,
      order: { propertyCount: 'DESC' },
    });
  }

  async getCities(): Promise<Location[]> {
    return this.locationRepo
      .createQueryBuilder('location')
      .select(['location.city', 'location.state'])
      .addSelect('SUM(location.propertyCount)', 'totalCount')
      .where('location.isActive = true')
      .groupBy('location.city')
      .addGroupBy('location.state')
      .orderBy('totalCount', 'DESC')
      .limit(20)
      .getMany();
  }

  async getLocalitiesByCity(city: string): Promise<Location[]> {
    return this.locationRepo.find({
      where: { city, isActive: true },
      order: { propertyCount: 'DESC' },
      take: 30,
    });
  }

  // ── States ──────────────────────────────────────────────────────────────────

  async getStates(onlyActive = true) {
    const where = onlyActive ? { isActive: true } : {};
    return this.stateRepository.find({ where, order: { name: 'ASC' }, relations: ['country'] });
  }

  async createState(data: { name: string; code: string; isActive?: boolean; imageUrl?: string }) {
    const state = this.stateRepository.create(data);
    return this.stateRepository.save(state);
  }

  async updateState(id: string, data: Partial<State>) {
    await this.stateRepository.update(id, data);
    return this.stateRepository.findOne({ where: { id } });
  }

  async deleteState(id: string) {
    return this.stateRepository.delete(id);
  }

  // ── Cities ──────────────────────────────────────────────────────────────────

  async getCitiesByState(stateId: string, onlyActive = true) {
    const where: any = { stateId };
    if (onlyActive) where.isActive = true;
    return this.cityRepository.find({ where, order: { name: 'ASC' } });
  }

  async getAllCities(page = 1, limit = 50, search?: string, stateId?: string) {
    const qb = this.cityRepository
      .createQueryBuilder('city')
      .leftJoinAndSelect('city.state', 'state');

    if (search) qb.where('city.name LIKE :search', { search: `%${search}%` });
    if (stateId) qb.andWhere('city.stateId = :stateId', { stateId });

    qb.orderBy('city.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [cities, total] = await qb.getManyAndCount();
    return { cities, total, page, limit };
  }

  async createCity(data: {
    name: string;
    stateId: string;
    isActive?: boolean;
    isFeatured?: boolean;
    imageUrl?: string;
  }) {
    const city = this.cityRepository.create(data);
    return this.cityRepository.save(city);
  }

  async updateCity(id: string, data: Partial<City>) {
    await this.cityRepository.update(id, data);
    return this.cityRepository.findOne({ where: { id }, relations: ['state'] });
  }

  async deleteCity(id: string) {
    return this.cityRepository.delete(id);
  }

  // ── SEO content lookup ────────────────────────────────────────────────────

  /**
   * Returns SEO content for a city (preferred) or state.
   * Matched case-insensitively by name. Returns null if neither found.
   */
  async getLocationSeoContent(cityName?: string, stateName?: string) {
    if (cityName) {
      const city = await this.cityRepository
        .createQueryBuilder('c')
        .where('LOWER(c.name) = LOWER(:name)', { name: cityName.trim() })
        .andWhere('c.isActive = true')
        .getOne();

      if (city && (city.seoContent || city.introContent || city.faqs?.length)) {
        return {
          type: 'city' as const,
          name: city.name,
          h1: city.h1 || null,
          introContent: city.introContent || null,
          seoContent: city.seoContent || null,
          faqs: city.faqs || [],
        };
      }
    }

    if (stateName) {
      const state = await this.stateRepository
        .createQueryBuilder('s')
        .where('LOWER(s.name) = LOWER(:name)', { name: stateName.trim() })
        .andWhere('s.isActive = true')
        .getOne();

      if (state && state.seoContent) {
        return {
          type: 'state' as const,
          name: state.name,
          h1: state.h1 || null,
          introContent: null,
          seoContent: state.seoContent,
          faqs: [] as { question: string; answer: string }[],
        };
      }
    }

    return null;
  }
}

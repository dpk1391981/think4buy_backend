import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Not, IsNull } from 'typeorm';
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
    return this.cityRepository.find({ where, order: { propertyCount: 'DESC', name: 'ASC' } });
  }

  async getStateBySlug(slug: string) {
    // Match by slug field, or by name lowercased+hyphenated as fallback
    const state = await this.stateRepository
      .createQueryBuilder('s')
      .where('s.isActive = true')
      .andWhere(
        '(s.slug = :slug OR LOWER(REPLACE(s.name, " ", "-")) = :slug)',
        { slug: slug.toLowerCase() },
      )
      .getOne();

    if (!state) return null;

    const cities = await this.cityRepository.find({
      where: { stateId: state.id, isActive: true },
      order: { propertyCount: 'DESC', name: 'ASC' },
    });

    return { ...state, cities };
  }

  async getLocalitiesByCityName(city: string, state?: string): Promise<Location[]> {
    const where: any = { city, isActive: true, locality: Not(IsNull()) };
    if (state) where.state = state;
    return this.locationRepo.find({
      where,
      order: { propertyCount: 'DESC' },
      take: 50,
    });
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

  // ── Localities (admin CRUD) ───────────────────────────────────────────────

  async getLocalities(params: { page?: number; limit?: number; city?: string; state?: string; search?: string }) {
    const { page = 1, limit = 50, city, state, search } = params;
    const qb = this.locationRepo.createQueryBuilder('l');
    if (state) qb.where('l.state = :state', { state });
    if (city) qb.andWhere('l.city = :city', { city });
    if (search) qb.andWhere('(l.locality LIKE :s OR l.city LIKE :s OR l.pincode LIKE :s)', { s: `%${search}%` });
    qb.orderBy('l.propertyCount', 'DESC').addOrderBy('l.locality', 'ASC').skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async createLocality(data: {
    city: string;
    state: string;
    locality?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
    isActive?: boolean;
  }) {
    const loc = this.locationRepo.create({ ...data, isActive: data.isActive ?? true });
    return this.locationRepo.save(loc);
  }

  async updateLocality(id: string, data: Partial<Location>) {
    await this.locationRepo.update(id, data);
    return this.locationRepo.findOne({ where: { id } });
  }

  async deleteLocality(id: string) {
    return this.locationRepo.delete(id);
  }

  async bulkImportLocalities(rows: { city: string; state: string; locality?: string; pincode?: string }[]) {
    const entities = rows.map(r => this.locationRepo.create({ ...r, isActive: true }));
    return this.locationRepo.save(entities);
  }

  // ── States with stats ────────────────────────────────────────────────────

  async getStatesWithStats() {
    const rows: any[] = await this.stateRepository.manager.query(
      `SELECT
        s.id,
        s.name,
        s.slug,
        s.code,
        s.imageUrl                         AS imageUrl,
        s.propertyCount                    AS propertyCount,
        (SELECT COUNT(*) FROM cities c WHERE c.state_id = s.id AND c.isActive = 1) AS cityCount,
        COUNT(DISTINCT p.id)               AS totalListings,
        COALESCE(SUM(CASE WHEN p.category = 'buy'        THEN 1 ELSE 0 END), 0) AS buyCount,
        COALESCE(SUM(CASE WHEN p.category = 'rent'       THEN 1 ELSE 0 END), 0) AS rentCount,
        COALESCE(SUM(CASE WHEN p.category = 'commercial' THEN 1 ELSE 0 END), 0) AS commercialCount
       FROM states s
       LEFT JOIN properties p
         ON LOWER(p.state) = LOWER(s.name)
        AND p.status = 'active'
       WHERE s.isActive = 1
       GROUP BY s.id, s.name, s.slug, s.code, s.imageUrl, s.propertyCount
       ORDER BY totalListings DESC, s.propertyCount DESC`,
    );

    return rows.map(r => ({
      id:              r.id,
      name:            r.name,
      slug:            r.slug || r.name.toLowerCase().replace(/\s+/g, '-'),
      code:            r.code,
      imageUrl:        r.imageUrl || null,
      cityCount:       Number(r.cityCount),
      // Fall back to denormalized propertyCount when no properties are joined yet
      totalListings:   Number(r.totalListings) || Number(r.propertyCount) || 0,
      buyCount:        Number(r.buyCount),
      rentCount:       Number(r.rentCount),
      commercialCount: Number(r.commercialCount),
    }));
  }

  // ── Top Cities ───────────────────────────────────────────────────────────

  async getTopCities(limit = 12) {
    const rows: any[] = await this.cityRepository.manager.query(
      `SELECT
        c.id,
        c.name        AS cityName,
        c.slug,
        c.imageUrl    AS image,
        COUNT(p.id)   AS total,
        SUM(CASE WHEN p.type IN ('plot','land')                                          THEN 1 ELSE 0 END) AS plots,
        SUM(CASE WHEN p.type IN ('apartment','studio','penthouse','builder_floor','co_living') THEN 1 ELSE 0 END) AS flats,
        SUM(CASE WHEN p.type IN ('house','villa','farm_house')                           THEN 1 ELSE 0 END) AS independentHouse
       FROM cities c
       INNER JOIN properties p
         ON LOWER(p.city) = LOWER(c.name)
        AND p.status = 'active'
       WHERE c.isActive = 1
       GROUP BY c.id, c.name, c.slug, c.imageUrl
       ORDER BY total DESC
       LIMIT ?`,
      [limit],
    );

    return rows.map(r => ({
      id:       r.id,
      cityName: r.cityName,
      slug:     r.slug || r.cityName.toLowerCase().replace(/\s+/g, '-'),
      image:    r.image || null,
      counts: {
        plots:           Number(r.plots),
        flats:           Number(r.flats),
        independentHouse: Number(r.independentHouse),
        total:           Number(r.total),
      },
    }));
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

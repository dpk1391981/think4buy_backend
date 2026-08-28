import { BadRequestException, Injectable } from '@nestjs/common';
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

  async search(query: string): Promise<(Location & { liveCount: number })[]> {
    // Return locations (cities and localities) that have live active+approved properties.
    // For locality records: match both city AND locality in properties.
    // For city-only records: match just city.
    const rows: any[] = await this.locationRepo.manager.query(`
      SELECT
        l.*,
        CAST(COALESCE(SUM(CASE
          WHEN LOWER(p.city) = LOWER(l.city)
            AND (l.locality IS NULL OR l.locality = '' OR LOWER(p.locality) = LOWER(l.locality))
            AND p.status = 'active'
            AND p.approvalStatus = 'approved'
            AND p.isDraft = 0
          THEN 1 ELSE 0
        END), 0) AS UNSIGNED) AS liveCount
      FROM locations l
      LEFT JOIN properties p ON LOWER(p.city) = LOWER(l.city)
      WHERE l.isActive = 1
        AND (l.city LIKE ? OR l.locality LIKE ? OR l.pincode LIKE ?)
      GROUP BY l.id
      HAVING liveCount > 0
      ORDER BY liveCount DESC
      LIMIT 10
    `, [`%${query}%`, `%${query}%`, `%${query}%`]);

    return rows;
  }

  async getCities(search?: string, limit = 50): Promise<{ id: string; name: string; slug: string | null; stateName?: string; stateId?: string }[]> {
    // Returns all active cities from the cities table — used by navbar and post-property form.
    // No property-existence filter: cities are valid destinations regardless of current listings.
    const qb = this.cityRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.state', 'state')
      .where('c.isActive = true');
    if (search?.trim()) qb.andWhere('c.name LIKE :search', { search: `%${search.trim()}%` });
    qb.orderBy('c.name', 'ASC').take(limit);
    const cities = await qb.getMany();
    return cities.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug ?? null,
      stateName: c.state?.name,
      stateId: c.stateId,
    }));
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

  /**
   * Cities in a state that are worth linking to from the public site.
   *
   * The EXISTS clause is deliberate here — a city landing page with no listings
   * is a dead end — but it makes this the wrong source for any admin picker:
   * with an empty catalogue it returns nothing for every state. The admin
   * screens must use `getAllCities` (GET /admin/cities) instead, which lists the
   * cities table as it is.
   */
  async getCitiesByState(stateId: string, onlyActive = true) {
    const where: any = { stateId };
    if (onlyActive) where.isActive = true;
    // Only return cities that have at least one active+approved non-draft property
    return this.cityRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.state', 'state')
      .where('c.stateId = :stateId', { stateId })
      .andWhere(onlyActive ? 'c.isActive = true' : '1=1')
      .andWhere(`EXISTS (
        SELECT 1 FROM properties p
        WHERE LOWER(p.city) = LOWER(c.name)
          AND p.status = 'active'
          AND p.approvalStatus = 'approved'
          AND p.isDraft = 0
      )`)
      .orderBy('c.propertyCount', 'DESC')
      .addOrderBy('c.name', 'ASC')
      .getMany();
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

  async getLocalitiesByCityName(
    city: string,
    state?: string,
    search?: string,
    onlyWithActiveProps = false,
  ): Promise<any[]> {
    const params: any[] = [`%${city}%`, city];
    let stateClause = '';
    if (state) { stateClause = 'AND LOWER(l.state) = LOWER(?)'; params.push(state); }
    let searchClause = '';
    if (search?.trim()) { searchClause = 'AND l.locality LIKE ?'; params.push(`%${search.trim()}%`); }

    if (onlyWithActiveProps) {
      // Used by TopCitiesSection locality mode: only localities with active+approved properties,
      // with a live count from the properties table.
      const rows: any[] = await this.locationRepo.manager.query(`
        SELECT
          l.id, l.city, l.state, l.locality, l.pincode,
          l.latitude, l.longitude, l.isActive,
          CAST(COALESCE(SUM(CASE
            WHEN LOWER(p.city) = LOWER(l.city)
              AND LOWER(p.locality) = LOWER(l.locality)
              AND p.status = 'active'
              AND p.approvalStatus = 'approved'
              AND p.isDraft = 0
            THEN 1 ELSE 0
          END), 0) AS UNSIGNED) AS propertyCount
        FROM locations l
        LEFT JOIN properties p ON LOWER(p.city) = LOWER(l.city)
        WHERE l.isActive = 1
          AND l.locality IS NOT NULL AND l.locality != ''
          AND (l.city LIKE ? OR LOWER(l.city) = LOWER(?))
          ${stateClause}
          ${searchClause}
        GROUP BY l.id
        HAVING propertyCount > 0
        ORDER BY propertyCount DESC, l.locality ASC
        LIMIT 200
      `, params);
      return rows;
    }

    // Default: return all localities from the table (for post-property form and similar)
    const qb = this.locationRepo
      .createQueryBuilder('l')
      .where('(l.city LIKE :cityLike OR LOWER(l.city) = LOWER(:city))', { cityLike: `%${city}%`, city })
      .andWhere('l.isActive = true')
      .andWhere('l.locality IS NOT NULL')
      .andWhere("l.locality != ''");
    if (state) qb.andWhere('LOWER(l.state) = LOWER(:state)', { state });
    if (search?.trim()) qb.andWhere('l.locality LIKE :search', { search: `%${search.trim()}%` });
    qb.orderBy('l.propertyCount', 'DESC').addOrderBy('l.locality', 'ASC').take(200);
    return qb.getMany();
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

  /**
   * Resolves a locality's city/state from a real `cities` row.
   *
   * `locations` stores city and state as plain strings, so the admin form used
   * to post whatever text it had. When the city dropdown came back empty — see
   * getCitiesByState — the only way forward was to go and create cities, which
   * is how "Delhi Central/East/North/South/West" ended up in the cities table as
   * peers of Delhi. Pinning to a cityId makes that impossible: the names written
   * here are always the canonical ones, so `toSlug(city)` matches a real city
   * slug and the SEO/URL layer can resolve the locality page it generates.
   *
   * The `{ city, state }` string form still works for CSV bulk import.
   */
  private async resolveCity(data: { cityId?: string; city?: string; state?: string }) {
    if (data.cityId) {
      const city = await this.cityRepository.findOne({
        where: { id: data.cityId },
        relations: ['state'],
      });
      if (!city) throw new BadRequestException('Selected city no longer exists.');
      return { city: city.name.trim(), state: (city.state?.name ?? data.state ?? '').trim() };
    }

    const city = data.city?.trim();
    if (!city) throw new BadRequestException('A city is required.');
    return { city, state: (data.state ?? '').trim() };
  }

  async createLocality(data: {
    cityId?: string;
    city?: string;
    state?: string;
    locality?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
    isActive?: boolean;
  }) {
    const { city, state } = await this.resolveCity(data);
    const locality = data.locality?.trim() || null;

    // Adding the same locality twice is always a mistake, and a duplicate row
    // silently doubles the locality in every SEO and typeahead list built off
    // this table.
    const existing = await this.locationRepo
      .createQueryBuilder('l')
      .where('LOWER(l.city) = LOWER(:city)', { city })
      .andWhere(
        locality ? 'LOWER(l.locality) = LOWER(:locality)' : "(l.locality IS NULL OR l.locality = '')",
        locality ? { locality } : {},
      )
      .getOne();
    if (existing) {
      throw new BadRequestException(
        locality
          ? `"${locality}" already exists under ${city}.`
          : `${city} already has an entry.`,
      );
    }

    const loc = this.locationRepo.create({
      city,
      state,
      locality,
      pincode:   data.pincode?.trim() || null,
      latitude:  data.latitude,
      longitude: data.longitude,
      isActive:  data.isActive ?? true,
    });
    return this.locationRepo.save(loc);
  }

  async updateLocality(id: string, data: Partial<Location> & { cityId?: string }) {
    const { cityId, ...rest } = data as any;
    const patch: Partial<Location> = { ...rest };

    // Only re-resolve when the form actually sent a city — a partial patch
    // (toggling isActive, say) must not blank the city out.
    if (cityId || rest.city) {
      const resolved = await this.resolveCity({ cityId, city: rest.city, state: rest.state });
      patch.city  = resolved.city;
      patch.state = resolved.state;
    }

    await this.locationRepo.update(id, patch);
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
        c.isActive
       FROM cities c where c.isActive = 1
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

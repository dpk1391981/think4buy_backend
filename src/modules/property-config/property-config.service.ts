import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { PropCategory } from './entities/prop-category.entity';
import { PropType } from './entities/prop-type.entity';
import { PropTypeAmenity } from './entities/prop-type-amenity.entity';
import { PropTypeField } from './entities/prop-type-field.entity';
import { Amenity } from '../properties/entities/amenity.entity';
import { ListingFilterConfig, FilterWidgetType } from './entities/listing-filter-config.entity';
import { SearchKeywordMapping } from './entities/search-keyword-mapping.entity';

const DEFAULT_FILTERS = [
  {
    filterKey: 'budget', label: 'Budget', icon: '₹',
    widgetType: FilterWidgetType.PRICE_RANGE,
    optionsJson: null, categories: [], defaultOpen: true, showOnMobile: true, sortOrder: 1,
  },
  {
    filterKey: 'bedrooms', label: 'BHK / Bedrooms', icon: '🛏️',
    widgetType: FilterWidgetType.BEDROOM_SELECT,
    optionsJson: null, categories: ['buy', 'rent', 'pg'], defaultOpen: true, showOnMobile: true, sortOrder: 2,
  },
  {
    filterKey: 'type', label: 'Property Type', icon: '🏠',
    widgetType: FilterWidgetType.PROPERTY_TYPE,
    optionsJson: null, categories: [], defaultOpen: true, showOnMobile: true, sortOrder: 3,
  },
  {
    filterKey: 'area', label: 'Area (sqft)', icon: '📐',
    widgetType: FilterWidgetType.AREA_RANGE,
    optionsJson: null, categories: [], defaultOpen: false, showOnMobile: true, sortOrder: 4,
  },
  {
    filterKey: 'furnishingStatus', label: 'Furnishing', icon: '🛋️',
    widgetType: FilterWidgetType.OPTION_SELECT,
    optionsJson: [
      { value: 'furnished',      label: 'Furnished' },
      { value: 'semi_furnished', label: 'Semi-Furnished' },
      { value: 'unfurnished',    label: 'Unfurnished' },
    ],
    categories: ['buy', 'rent', 'pg'], defaultOpen: false, showOnMobile: true, sortOrder: 5,
  },
  {
    filterKey: 'possessionStatus', label: 'Possession', icon: '🔑',
    widgetType: FilterWidgetType.OPTION_SELECT,
    optionsJson: [
      { value: 'ready_to_move',      label: 'Ready to Move' },
      { value: 'under_construction', label: 'Under Construction' },
    ],
    categories: ['buy', 'builder_project', 'investment'], defaultOpen: false, showOnMobile: true, sortOrder: 6,
  },
  {
    filterKey: 'listedBy', label: 'Posted By', icon: '👤',
    widgetType: FilterWidgetType.OPTION_SELECT,
    optionsJson: [
      { value: 'owner',   label: 'Owner' },
      { value: 'agent',   label: 'Agent' },
      { value: 'builder', label: 'Builder' },
    ],
    categories: [], defaultOpen: false, showOnMobile: true, sortOrder: 7,
  },
  {
    filterKey: 'amenityIds', label: 'Amenities', icon: '✨',
    widgetType: FilterWidgetType.AMENITY_PICKER,
    optionsJson: null, categories: [], defaultOpen: false, showOnMobile: true, sortOrder: 8,
  },
  {
    filterKey: 'builderName', label: 'Builder / Developer', icon: '🏗️',
    widgetType: FilterWidgetType.TEXT_INPUT,
    optionsJson: null, categories: ['buy', 'builder_project', 'investment'], defaultOpen: false, showOnMobile: false, sortOrder: 9,
  },
  {
    filterKey: 'isVerified', label: 'Verified Only', icon: '✅',
    widgetType: FilterWidgetType.TOGGLE_BOOLEAN,
    optionsJson: null, categories: [], defaultOpen: false, showOnMobile: true, sortOrder: 10,
  },
  {
    filterKey: 'isNewProject', label: 'New Projects', icon: '⭐',
    widgetType: FilterWidgetType.TOGGLE_BOOLEAN,
    optionsJson: null, categories: ['buy', 'builder_project', 'investment'], defaultOpen: false, showOnMobile: true, sortOrder: 11,
  },
];

// ─── Default search keyword mappings (seeded once on first API call) ─────────
// sortOrder < 50 = multi-word (must be evaluated before single-word fallbacks)
const DEFAULT_KEYWORD_MAPPINGS: Array<Omit<SearchKeywordMapping, 'id' | 'createdAt' | 'updatedAt'>> = [
  // ── Multi-word patterns first (order matters) ────────────────────────────
  { keyword: 'service[\\s\\-]apartment',    mapsToType: 'apartment',           mapsToCategory: null,         label: 'Service Apartment', sortOrder: 1,  isActive: true },
  { keyword: 'commercial[\\s\\-]warehouse', mapsToType: 'commercial_warehouse', mapsToCategory: 'commercial', label: 'Warehouse',          sortOrder: 2,  isActive: true },
  { keyword: 'commercial[\\s\\-]office',    mapsToType: 'commercial_office',    mapsToCategory: 'commercial', label: 'Commercial Office',  sortOrder: 3,  isActive: true },
  { keyword: 'commercial[\\s\\-]shop',      mapsToType: 'commercial_shop',      mapsToCategory: 'commercial', label: 'Commercial Shop',    sortOrder: 4,  isActive: true },
  { keyword: 'industrial[\\s\\-]shed',      mapsToType: 'industrial_shed',      mapsToCategory: 'industrial', label: 'Industrial Shed',    sortOrder: 5,  isActive: true },
  { keyword: 'builder[\\s\\-]floor',        mapsToType: 'builder_floor',        mapsToCategory: null,         label: 'Builder Floor',      sortOrder: 6,  isActive: true },
  { keyword: 'independent[\\s\\-]floor',    mapsToType: 'builder_floor',        mapsToCategory: null,         label: 'Builder Floor',      sortOrder: 7,  isActive: true },
  { keyword: 'office[\\s\\-]space',         mapsToType: 'commercial_office',    mapsToCategory: 'commercial', label: 'Office Space',       sortOrder: 8,  isActive: true },
  { keyword: 'farm[\\s\\-]house',           mapsToType: 'farm_house',           mapsToCategory: null,         label: 'Farmhouse',          sortOrder: 9,  isActive: true },
  { keyword: 'paying[\\s\\-]guest',         mapsToType: 'pg',                   mapsToCategory: 'pg',         label: 'PG',                 sortOrder: 10, isActive: true },
  { keyword: 'co[\\s\\-]?living',           mapsToType: 'co_living',            mapsToCategory: 'pg',         label: 'Co-Living',          sortOrder: 11, isActive: true },
  // ── Single-word patterns ─────────────────────────────────────────────────
  { keyword: 'apartment',      mapsToType: 'apartment',           mapsToCategory: null,         label: 'Apartment',          sortOrder: 20, isActive: true },
  { keyword: 'flat(?:s)?',     mapsToType: 'flat',                mapsToCategory: null,         label: 'Flat',               sortOrder: 21, isActive: true },
  { keyword: 'unit',           mapsToType: 'apartment',           mapsToCategory: null,         label: 'Apartment',          sortOrder: 22, isActive: true },
  { keyword: 'villa(?:s)?',    mapsToType: 'villa',               mapsToCategory: null,         label: 'Villa',              sortOrder: 23, isActive: true },
  { keyword: 'bungalow',       mapsToType: 'villa',               mapsToCategory: null,         label: 'Bungalow/Villa',     sortOrder: 24, isActive: true },
  { keyword: 'penthouse',      mapsToType: 'penthouse',           mapsToCategory: null,         label: 'Penthouse',          sortOrder: 25, isActive: true },
  { keyword: 'studio',         mapsToType: 'studio',              mapsToCategory: null,         label: 'Studio',             sortOrder: 26, isActive: true },
  { keyword: '1\\s*rk',        mapsToType: 'studio',              mapsToCategory: null,         label: '1 RK / Studio',      sortOrder: 27, isActive: true },
  { keyword: 'farmhouse',      mapsToType: 'farm_house',          mapsToCategory: null,         label: 'Farmhouse',          sortOrder: 28, isActive: true },
  { keyword: 'warehouse',      mapsToType: 'commercial_warehouse', mapsToCategory: 'commercial', label: 'Warehouse',          sortOrder: 29, isActive: true },
  { keyword: 'showroom',       mapsToType: 'showroom',            mapsToCategory: 'commercial', label: 'Showroom',           sortOrder: 30, isActive: true },
  { keyword: 'factory',        mapsToType: 'factory',             mapsToCategory: 'industrial', label: 'Factory',            sortOrder: 31, isActive: true },
  { keyword: 'plot(?:s)?',     mapsToType: 'plot',                mapsToCategory: null,         label: 'Plot',               sortOrder: 32, isActive: true },
  { keyword: 'land',           mapsToType: 'plot',                mapsToCategory: null,         label: 'Land/Plot',          sortOrder: 33, isActive: true },
  { keyword: 'independent',    mapsToType: 'house',               mapsToCategory: null,         label: 'Independent House',  sortOrder: 34, isActive: true },
  { keyword: 'house(?:s)?',    mapsToType: 'house',               mapsToCategory: null,         label: 'House',              sortOrder: 35, isActive: true },
  { keyword: 'home',           mapsToType: 'house',               mapsToCategory: null,         label: 'House/Home',         sortOrder: 36, isActive: true },
  { keyword: 'pg',             mapsToType: 'pg',                  mapsToCategory: 'pg',         label: 'PG',                 sortOrder: 37, isActive: true },
  { keyword: 'hostel',         mapsToType: 'pg',                  mapsToCategory: 'pg',         label: 'Hostel/PG',          sortOrder: 38, isActive: true },
  { keyword: 'office',         mapsToType: 'commercial_office',   mapsToCategory: 'commercial', label: 'Office',             sortOrder: 39, isActive: true },
  { keyword: 'shop(?:s)?',     mapsToType: 'commercial_shop',     mapsToCategory: 'commercial', label: 'Shop',               sortOrder: 40, isActive: true },
  { keyword: 'industrial',     mapsToType: 'factory',             mapsToCategory: 'industrial', label: 'Industrial',         sortOrder: 41, isActive: true },
  // ── New: Hotel ───────────────────────────────────────────────────────────
  { keyword: 'hotel(?:s)?',    mapsToType: 'hotel',               mapsToCategory: 'commercial', label: 'Hotel',              sortOrder: 42, isActive: true },
];

@Injectable()
export class PropertyConfigService {
  constructor(
    @InjectRepository(PropCategory)  private catRepo: Repository<PropCategory>,
    @InjectRepository(PropType)      private typeRepo: Repository<PropType>,
    @InjectRepository(PropTypeAmenity) private ptaRepo: Repository<PropTypeAmenity>,
    @InjectRepository(PropTypeField) private fieldRepo: Repository<PropTypeField>,
    @InjectRepository(Amenity)       private amenityRepo: Repository<Amenity>,
    @InjectRepository(ListingFilterConfig) private lfcRepo: Repository<ListingFilterConfig>,
    @InjectRepository(SearchKeywordMapping) private skwRepo: Repository<SearchKeywordMapping>,
  ) {}

  // ─── Public read endpoints ──────────────────────────────────────────────────

  async getActiveCategories() {
    const [cats, counts] = await Promise.all([
      this.catRepo.find({ where: { status: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.catRepo.manager.query(`
        SELECT p.category AS slug, COUNT(*) AS cnt
        FROM properties p
        WHERE p.approvalStatus = 'approved' AND p.status = 'active' AND p.isDraft = 0
          AND p.category != '' AND p.category IS NOT NULL
        GROUP BY p.category
      `),
    ]);
    const countMap = new Map<string, number>(
      (counts as { slug: string; cnt: string }[]).map(r => [r.slug, parseInt(r.cnt)]),
    );
    return cats.map(c => ({ ...c, totalListings: countMap.get(c.slug) ?? 0 }));
  }

  async getTypesByCategory(categoryId: string, categorySlug?: string) {
    let cat: PropCategory | null = null;
    if (categorySlug) {
      cat = await this.catRepo.findOne({ where: { slug: categorySlug } });
    } else if (categoryId) {
      cat = await this.catRepo.findOne({ where: { id: categoryId } });
    }
    if (!cat) return [];
    return this.typeRepo.find({
      where: { categoryId: cat.id, status: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async getAmenitiesByType(propTypeId: string) {
    const rows = await this.ptaRepo.find({
      where: { propTypeId },
      relations: ['amenity'],
      order: { amenity: { name: 'ASC' } } as any,
    });
    return rows
      .filter(r => r.amenity?.status)
      .map(r => r.amenity);
  }

  async getFieldsByType(propTypeId: string) {
    return this.fieldRepo.find({
      where: { propTypeId },
      order: { sortOrder: 'ASC' },
    });
  }

  // ─── Admin: Categories ──────────────────────────────────────────────────────

  getAdminCategories() {
    return this.catRepo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async createCategory(dto: {
    name: string; slug: string; icon?: string;
    description?: string; status?: boolean; sortOrder?: number;
  }) {
    const existing = await this.catRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    const cat = this.catRepo.create({ ...dto, status: dto.status ?? true, sortOrder: dto.sortOrder ?? 0 });
    return this.catRepo.save(cat);
  }

  async updateCategory(id: string, dto: Partial<{
    name: string; slug: string; icon: string;
    description: string; status: boolean; sortOrder: number;
  }>) {
    const cat = await this.catRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    if (dto.slug && dto.slug !== cat.slug) {
      const dup = await this.catRepo.findOne({ where: { slug: dto.slug } });
      if (dup) throw new ConflictException('Slug already exists');
    }
    Object.assign(cat, dto);
    return this.catRepo.save(cat);
  }

  async deleteCategory(id: string) {
    const cat = await this.catRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    await this.catRepo.remove(cat);
    return { success: true };
  }

  // ─── Admin: Property Types ───────────────────────────────────────────────────

  getAdminTypes(categoryId?: string) {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    return this.typeRepo.find({
      where,
      relations: ['category'],
      order: { category: { sortOrder: 'ASC' }, sortOrder: 'ASC', name: 'ASC' } as any,
    });
  }

  async createType(dto: {
    name: string; slug: string; categoryId: string;
    icon?: string; status?: boolean; sortOrder?: number; aliasOf?: string | null;
  }) {
    const cat = await this.catRepo.findOne({ where: { id: dto.categoryId } });
    if (!cat) throw new NotFoundException('Category not found');
    const pt = this.typeRepo.create({ ...dto, status: dto.status ?? true, sortOrder: dto.sortOrder ?? 0 });
    return this.typeRepo.save(pt);
  }

  async updateType(id: string, dto: Partial<{
    name: string; slug: string; categoryId: string;
    icon: string; status: boolean; sortOrder: number; aliasOf: string | null;
  }>) {
    const pt = await this.typeRepo.findOne({ where: { id } });
    if (!pt) throw new NotFoundException('Property type not found');
    Object.assign(pt, dto);
    return this.typeRepo.save(pt);
  }

  async deleteType(id: string) {
    const pt = await this.typeRepo.findOne({ where: { id } });
    if (!pt) throw new NotFoundException('Property type not found');
    await this.typeRepo.remove(pt);
    return { success: true };
  }

  // ─── Admin: Amenities ────────────────────────────────────────────────────────

  getAdminAmenities() {
    return this.amenityRepo.find({ order: { name: 'ASC' } });
  }

  createAmenity(dto: { name: string; icon?: string; category?: any; status?: boolean }) {
    const a = this.amenityRepo.create({ ...dto, status: dto.status ?? true });
    return this.amenityRepo.save(a);
  }

  async updateAmenity(id: string, dto: Partial<{ name: string; icon: string; category: any; status: boolean }>) {
    const a = await this.amenityRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Amenity not found');
    Object.assign(a, dto);
    return this.amenityRepo.save(a);
  }

  async deleteAmenity(id: string) {
    const a = await this.amenityRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Amenity not found');
    await this.amenityRepo.remove(a);
    return { success: true };
  }

  // ─── Admin: Type-Amenity Mapping ─────────────────────────────────────────────

  async getTypeAmenities(propTypeId: string) {
    return this.ptaRepo.find({
      where: { propTypeId },
      relations: ['amenity'],
    });
  }

  async setTypeAmenities(propTypeId: string, amenityIds: string[]) {
    const pt = await this.typeRepo.findOne({ where: { id: propTypeId } });
    if (!pt) throw new NotFoundException('Property type not found');
    await this.ptaRepo.delete({ propTypeId });
    if (!amenityIds.length) return [];
    const rows = amenityIds.map(amenityId => this.ptaRepo.create({ propTypeId, amenityId }));
    return this.ptaRepo.save(rows);
  }

  // ─── Admin: Type Fields ──────────────────────────────────────────────────────

  async getAdminFields(propTypeId: string) {
    return this.fieldRepo.find({
      where: { propTypeId },
      order: { sortOrder: 'ASC' },
    });
  }

  async createField(dto: {
    propTypeId: string; fieldName: string; fieldLabel: string;
    fieldType: any; optionsJson?: string[]; placeholder?: string;
    isRequired?: boolean; sortOrder?: number;
  }) {
    const pt = await this.typeRepo.findOne({ where: { id: dto.propTypeId } });
    if (!pt) throw new NotFoundException('Property type not found');
    const f = this.fieldRepo.create({ ...dto, isRequired: dto.isRequired ?? false, sortOrder: dto.sortOrder ?? 0 });
    return this.fieldRepo.save(f);
  }

  async updateField(id: string, dto: Partial<{
    fieldName: string; fieldLabel: string; fieldType: any;
    optionsJson: string[]; placeholder: string; isRequired: boolean; sortOrder: number;
  }>) {
    const f = await this.fieldRepo.findOne({ where: { id } });
    if (!f) throw new NotFoundException('Field not found');
    Object.assign(f, dto);
    return this.fieldRepo.save(f);
  }

  async deleteField(id: string) {
    const f = await this.fieldRepo.findOne({ where: { id } });
    if (!f) throw new NotFoundException('Field not found');
    await this.fieldRepo.remove(f);
    return { success: true };
  }

  async reorderFields(propTypeId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, idx) =>
      this.fieldRepo.update(id, { sortOrder: idx }),
    );
    await Promise.all(updates);
    return this.getAdminFields(propTypeId);
  }

  // ─── Listing Filter Configs ──────────────────────────────────────────────────

  /** Returns active filters for the given category (or all if category is absent). Seeds defaults on first use. */
  async getListingFilters(category?: string): Promise<ListingFilterConfig[]> {
    const count = await this.lfcRepo.count();
    if (count === 0) {
      const rows = DEFAULT_FILTERS.map(f => this.lfcRepo.create({ ...f, isActive: true }));
      await this.lfcRepo.save(rows);
    }
    const all = await this.lfcRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
    if (!category) return all;

    // Collect all category slugs that have explicit filter restrictions
    const knownCategories = new Set<string>();
    all.forEach(f => (f.categories || []).forEach(c => knownCategories.add(c)));

    // Dynamic/admin-created categories not in any filter's list → show all filters
    if (!knownCategories.has(category)) return all;

    return all.filter(f => !f.categories?.length || f.categories.includes(category));
  }

  getAdminListingFilters(): Promise<ListingFilterConfig[]> {
    return this.lfcRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async createListingFilter(dto: Partial<ListingFilterConfig>): Promise<ListingFilterConfig> {
    const row = this.lfcRepo.create({ ...dto, isActive: dto.isActive ?? true });
    return this.lfcRepo.save(row);
  }

  async updateListingFilter(id: string, dto: Partial<ListingFilterConfig>): Promise<ListingFilterConfig> {
    const row = await this.lfcRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Filter config not found');
    Object.assign(row, dto);
    return this.lfcRepo.save(row);
  }

  async deleteListingFilter(id: string): Promise<{ success: boolean }> {
    const row = await this.lfcRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Filter config not found');
    await this.lfcRepo.remove(row);
    return { success: true };
  }

  async reorderListingFilters(orderedIds: string[]): Promise<void> {
    await Promise.all(orderedIds.map((id, idx) => this.lfcRepo.update(id, { sortOrder: idx })));
  }

  // ─── Search Keyword Mappings ─────────────────────────────────────────────────

  /** Returns all active mappings sorted by evaluation order. Seeds defaults on first use. */
  async getSearchKeywordMappings(): Promise<SearchKeywordMapping[]> {
    const count = await this.skwRepo.count();
    if (count === 0) {
      const rows = DEFAULT_KEYWORD_MAPPINGS.map(d => this.skwRepo.create(d));
      await this.skwRepo.save(rows);
    }
    return this.skwRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  getAdminSearchKeywordMappings(): Promise<SearchKeywordMapping[]> {
    return this.skwRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async createSearchKeywordMapping(dto: {
    keyword: string; mapsToType?: string; mapsToCategory?: string;
    label: string; sortOrder?: number; isActive?: boolean;
  }): Promise<SearchKeywordMapping> {
    const row = this.skwRepo.create({
      ...dto,
      mapsToType: dto.mapsToType || null,
      mapsToCategory: dto.mapsToCategory || null,
      sortOrder: dto.sortOrder ?? 100,
      isActive: dto.isActive ?? true,
    });
    return this.skwRepo.save(row);
  }

  async updateSearchKeywordMapping(id: string, dto: Partial<{
    keyword: string; mapsToType: string | null; mapsToCategory: string | null;
    label: string; sortOrder: number; isActive: boolean;
  }>): Promise<SearchKeywordMapping> {
    const row = await this.skwRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Search keyword mapping not found');
    Object.assign(row, dto);
    return this.skwRepo.save(row);
  }

  async deleteSearchKeywordMapping(id: string): Promise<{ success: boolean }> {
    const row = await this.skwRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Search keyword mapping not found');
    await this.skwRepo.remove(row);
    return { success: true };
  }

  async seedDefaultKeywordMappings(): Promise<{ seeded: number }> {
    const count = await this.skwRepo.count();
    if (count > 0) return { seeded: 0 };
    const rows = DEFAULT_KEYWORD_MAPPINGS.map(d => this.skwRepo.create(d));
    await this.skwRepo.save(rows);
    return { seeded: rows.length };
  }
}

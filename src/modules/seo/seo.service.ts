import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CityPage } from './entities/city-page.entity';
import { SeoConfig } from './entities/seo-config.entity';
import { FooterSeoLink, FooterSeoLinkGroup } from './entities/footer-seo-link.entity';
import { LocalitySeo } from './entities/locality-seo.entity';
import { CategoryCitySeo } from './entities/category-city-seo.entity';
import { CategoryLocalitySeo } from './entities/category-locality-seo.entity';
import { PropCategory } from '../property-config/entities/prop-category.entity';
import { City } from '../locations/entities/city.entity';

// ── Normalized SEO config returned by the resolver ───────────────────────────

export interface SeoPageConfig {
  /** Which table was the winning match */
  source: 'footer_link' | 'category_locality' | 'category_city' | 'locality' | 'city' | 'category';
  h1Title: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  canonicalUrl: string | null;
  introContent: string | null;
  bottomContent: string | null;
  faqJson: { question: string; answer: string }[] | null;
  internalLinks: { label: string; url: string }[] | null;
  /** e.g. 'index,follow' | 'noindex,nofollow' */
  robots: string;
  context: {
    categorySlug?: string;
    categoryName?: string;
    citySlug?: string;
    cityName?: string;
    localitySlug?: string;
    localityName?: string;
  };
}

// ── Placeholder replacement ───────────────────────────────────────────────────

function replacePlaceholders(
  text: string | null | undefined,
  ctx: { city?: string; locality?: string; category?: string },
): string | null {
  if (!text) return null;
  return text
    .replace(/\{city\}/gi, ctx.city || '')
    .replace(/\{locality\}/gi, ctx.locality || '')
    .replace(/\{category\}/gi, ctx.category || '');
}

function applyPlaceholders(config: SeoPageConfig, ctx: { city?: string; locality?: string; category?: string }): SeoPageConfig {
  return {
    ...config,
    h1Title: replacePlaceholders(config.h1Title, ctx),
    metaTitle: replacePlaceholders(config.metaTitle, ctx),
    metaDescription: replacePlaceholders(config.metaDescription, ctx),
    metaKeywords: replacePlaceholders(config.metaKeywords, ctx),
    introContent: replacePlaceholders(config.introContent, ctx),
    bottomContent: replacePlaceholders(config.bottomContent, ctx),
    faqJson: config.faqJson?.map(faq => ({
      question: replacePlaceholders(faq.question, ctx) ?? faq.question,
      answer: replacePlaceholders(faq.answer, ctx) ?? faq.answer,
    })) ?? null,
  };
}

// ── Normalization from old entities (h1 / seoContent / faqs) ─────────────────

function normalizeOldFields(raw: {
  h1?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  introContent?: string | null;
  seoContent?: string | null;
  faqs?: { question: string; answer: string }[] | null;
}): Pick<SeoPageConfig, 'h1Title' | 'metaTitle' | 'metaDescription' | 'metaKeywords' | 'canonicalUrl' | 'introContent' | 'bottomContent' | 'faqJson' | 'internalLinks' | 'robots'> {
  return {
    h1Title: raw.h1 ?? null,
    metaTitle: raw.metaTitle ?? null,
    metaDescription: raw.metaDescription ?? null,
    metaKeywords: raw.metaKeywords ?? null,
    canonicalUrl: null,
    introContent: raw.introContent ?? null,
    bottomContent: raw.seoContent ?? null,
    faqJson: raw.faqs ?? null,
    internalLinks: null,
    robots: 'index,follow',
  };
}

@Injectable()
export class SeoService {
  constructor(
    @InjectRepository(CityPage) private cityPageRepo: Repository<CityPage>,
    @InjectRepository(SeoConfig) private seoConfigRepo: Repository<SeoConfig>,
    @InjectRepository(FooterSeoLink) private footerLinkRepo: Repository<FooterSeoLink>,
    @InjectRepository(FooterSeoLinkGroup) private footerGroupRepo: Repository<FooterSeoLinkGroup>,
    @InjectRepository(PropCategory) private propCategoryRepo: Repository<PropCategory>,
    @InjectRepository(City) private cityRepo: Repository<City>,
    @InjectRepository(LocalitySeo) private localitySeoRepo: Repository<LocalitySeo>,
    @InjectRepository(CategoryCitySeo) private categoryCitySeoRepo: Repository<CategoryCitySeo>,
    @InjectRepository(CategoryLocalitySeo) private categoryLocalitySeoRepo: Repository<CategoryLocalitySeo>,
  ) {}

  // ── SEO Listing Page Resolver ─────────────────────────────────────────────

  /**
   * Resolves the correct SEO config for a listing page using priority order:
   * 1. Category + Locality  (category_locality_seo)
   * 2. Category + City      (category_city_seo)
   * 3. Locality             (locality_seo)
   * 4. City                 (cities)
   * 5. Category             (prop_categories)
   *
   * Returns null if no config is found at any level.
   * No fallback content is generated — admin must configure SEO data.
   */
  async resolveListingPageSeo(params: {
    categorySlug?: string;
    citySlug?: string;
    localitySlug?: string;
    /** Raw URL slug — used to match footer link SEO (highest priority) */
    urlSlug?: string;
  }): Promise<SeoPageConfig | null> {
    const { categorySlug, citySlug, localitySlug, urlSlug } = params;

    // ── Priority 0: Footer Link SEO ───────────────────────────────────────
    // Exact URL match against footer_seo_links — takes precedence over all
    // other levels so admins can fully control programmatic SEO pages.
    if (urlSlug) {
      const normalized = urlSlug.replace(/^\/+|\/+$/g, '').toLowerCase();
      const footerLink = await this.footerLinkRepo
        .createQueryBuilder('fl')
        .where('fl.isActive = 1')
        .andWhere(
          "(LOWER(TRIM(BOTH '/' FROM fl.url)) = :slug OR LOWER(TRIM(BOTH '/' FROM fl.url)) = :slashSlug)",
          { slug: normalized, slashSlug: '/' + normalized },
        )
        .andWhere(
          '(fl.metaTitle IS NOT NULL OR fl.h1Title IS NOT NULL OR fl.introContent IS NOT NULL)',
        )
        .getOne();

      if (footerLink) {
        return {
          source: 'footer_link',
          h1Title: footerLink.h1Title ?? null,
          metaTitle: footerLink.metaTitle ?? null,
          metaDescription: footerLink.metaDescription ?? null,
          metaKeywords: footerLink.metaKeywords ?? null,
          canonicalUrl: footerLink.canonicalUrl ?? null,
          introContent: footerLink.introContent ?? null,
          bottomContent: footerLink.bottomContent ?? null,
          faqJson: footerLink.faqJson ?? null,
          internalLinks: null,
          robots: footerLink.robots ?? 'index,follow',
          context: { citySlug, cityName: citySlug, localitySlug, categorySlug },
        };
      }
    }

    // ── Priority 1: Category + Locality ──────────────────────────────────
    if (categorySlug && citySlug && localitySlug) {
      const row = await this.categoryLocalitySeoRepo.findOne({
        where: { categorySlug, citySlug, localitySlug, isActive: true },
      });
      if (row) {
        const ctx = { city: row.cityName, locality: row.localityName, category: categorySlug };
        return applyPlaceholders(
          {
            source: 'category_locality',
            h1Title: row.h1Title ?? null,
            metaTitle: row.metaTitle ?? null,
            metaDescription: row.metaDescription ?? null,
            metaKeywords: row.metaKeywords ?? null,
            canonicalUrl: row.canonicalUrl ?? null,
            introContent: row.introContent ?? null,
            bottomContent: row.bottomContent ?? null,
            faqJson: row.faqJson ?? null,
            internalLinks: row.internalLinks ?? null,
            robots: row.robots ?? 'index,follow',
            context: {
              categorySlug,
              citySlug,
              cityName: row.cityName,
              localitySlug,
              localityName: row.localityName,
            },
          },
          ctx,
        );
      }
    }

    // ── Priority 2: Category + City ───────────────────────────────────────
    if (categorySlug && citySlug) {
      const row = await this.categoryCitySeoRepo.findOne({
        where: { categorySlug, citySlug, isActive: true },
      });
      if (row) {
        const ctx = { city: row.cityName, locality: localitySlug ?? '', category: categorySlug };
        return applyPlaceholders(
          {
            source: 'category_city',
            h1Title: row.h1Title ?? null,
            metaTitle: row.metaTitle ?? null,
            metaDescription: row.metaDescription ?? null,
            metaKeywords: row.metaKeywords ?? null,
            canonicalUrl: row.canonicalUrl ?? null,
            introContent: row.introContent ?? null,
            bottomContent: row.bottomContent ?? null,
            faqJson: row.faqJson ?? null,
            internalLinks: row.internalLinks ?? null,
            robots: row.robots ?? 'index,follow',
            context: {
              categorySlug,
              citySlug,
              cityName: row.cityName,
            },
          },
          ctx,
        );
      }
    }

    // ── Priority 3: Locality ──────────────────────────────────────────────
    if (citySlug && localitySlug) {
      const row = await this.localitySeoRepo.findOne({
        where: { citySlug, localitySlug, isActive: true },
      });
      if (row) {
        const ctx = { city: row.cityName, locality: row.localityName, category: categorySlug ?? '' };
        return applyPlaceholders(
          {
            source: 'locality',
            h1Title: row.h1Title ?? null,
            metaTitle: row.metaTitle ?? null,
            metaDescription: row.metaDescription ?? null,
            metaKeywords: row.metaKeywords ?? null,
            canonicalUrl: row.canonicalUrl ?? null,
            introContent: row.introContent ?? null,
            bottomContent: row.bottomContent ?? null,
            faqJson: row.faqJson ?? null,
            internalLinks: row.internalLinks ?? null,
            robots: row.robots ?? 'index,follow',
            context: {
              citySlug,
              cityName: row.cityName,
              localitySlug,
              localityName: row.localityName,
            },
          },
          ctx,
        );
      }
    }

    // ── Priority 4: City ──────────────────────────────────────────────────
    if (citySlug) {
      const row = await this.cityRepo.findOne({ where: { slug: citySlug, isActive: true } });
      if (row && (row.metaTitle || row.h1)) {
        const fields = normalizeOldFields(row);
        const ctx = { city: row.name, locality: localitySlug ?? '', category: categorySlug ?? '' };
        return applyPlaceholders(
          {
            source: 'city',
            ...fields,
            context: { citySlug, cityName: row.name },
          },
          ctx,
        );
      }
    }

    // ── Priority 5: Category ──────────────────────────────────────────────
    if (categorySlug) {
      const row = await this.propCategoryRepo.findOne({ where: { slug: categorySlug, status: true } });
      if (row && (row.metaTitle || row.h1)) {
        const fields = normalizeOldFields(row);
        const ctx = { city: citySlug ?? '', locality: localitySlug ?? '', category: row.name };
        return applyPlaceholders(
          {
            source: 'category',
            ...fields,
            context: { categorySlug, categoryName: row.name },
          },
          ctx,
        );
      }
    }

    return null;
  }

  // ── Locality SEO CRUD ─────────────────────────────────────────────────────

  async getLocalitySeoPages(page = 1, limit = 20, search?: string) {
    const qb = this.localitySeoRepo.createQueryBuilder('l').orderBy('l.citySlug').addOrderBy('l.localitySlug');
    if (search) {
      qb.where('(l.citySlug LIKE :s OR l.localitySlug LIKE :s OR l.slug LIKE :s)', { s: `%${search}%` });
    }
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getLocalitySeoBySlug(slug: string): Promise<LocalitySeo> {
    const row = await this.localitySeoRepo.findOne({ where: { slug, isActive: true } });
    if (!row) throw new NotFoundException('Locality SEO page not found');
    return row;
  }

  async createLocalitySeo(data: Partial<LocalitySeo>): Promise<LocalitySeo> {
    const existing = await this.localitySeoRepo.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    return this.localitySeoRepo.save(this.localitySeoRepo.create(data));
  }

  async updateLocalitySeo(id: string, data: Partial<LocalitySeo>): Promise<LocalitySeo> {
    const row = await this.localitySeoRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Locality SEO page not found');
    if (data.slug && data.slug !== row.slug) {
      const exists = await this.localitySeoRepo.findOne({ where: { slug: data.slug } });
      if (exists) throw new ConflictException('Slug already exists');
    }
    Object.assign(row, data);
    return this.localitySeoRepo.save(row);
  }

  async deleteLocalitySeo(id: string): Promise<{ message: string }> {
    const row = await this.localitySeoRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Locality SEO page not found');
    await this.localitySeoRepo.remove(row);
    return { message: 'Locality SEO page deleted' };
  }

  // ── Category+City SEO CRUD ────────────────────────────────────────────────

  async getCategoryCitySeoPages(page = 1, limit = 20, search?: string) {
    const qb = this.categoryCitySeoRepo.createQueryBuilder('c').orderBy('c.categorySlug').addOrderBy('c.citySlug');
    if (search) {
      qb.where('(c.categorySlug LIKE :s OR c.citySlug LIKE :s OR c.slug LIKE :s)', { s: `%${search}%` });
    }
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCategoryCitySeoBySlug(slug: string): Promise<CategoryCitySeo> {
    const row = await this.categoryCitySeoRepo.findOne({ where: { slug, isActive: true } });
    if (!row) throw new NotFoundException('Category+City SEO page not found');
    return row;
  }

  async createCategoryCitySeo(data: Partial<CategoryCitySeo>): Promise<CategoryCitySeo> {
    const existing = await this.categoryCitySeoRepo.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    return this.categoryCitySeoRepo.save(this.categoryCitySeoRepo.create(data));
  }

  async updateCategoryCitySeo(id: string, data: Partial<CategoryCitySeo>): Promise<CategoryCitySeo> {
    const row = await this.categoryCitySeoRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Category+City SEO page not found');
    if (data.slug && data.slug !== row.slug) {
      const exists = await this.categoryCitySeoRepo.findOne({ where: { slug: data.slug } });
      if (exists) throw new ConflictException('Slug already exists');
    }
    Object.assign(row, data);
    return this.categoryCitySeoRepo.save(row);
  }

  async deleteCategoryCitySeo(id: string): Promise<{ message: string }> {
    const row = await this.categoryCitySeoRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Category+City SEO page not found');
    await this.categoryCitySeoRepo.remove(row);
    return { message: 'Category+City SEO page deleted' };
  }

  // ── Category+Locality SEO CRUD ────────────────────────────────────────────

  async getCategoryLocalitySeoPages(page = 1, limit = 20, search?: string) {
    const qb = this.categoryLocalitySeoRepo.createQueryBuilder('cl').orderBy('cl.categorySlug').addOrderBy('cl.citySlug').addOrderBy('cl.localitySlug');
    if (search) {
      qb.where('(cl.categorySlug LIKE :s OR cl.citySlug LIKE :s OR cl.localitySlug LIKE :s OR cl.slug LIKE :s)', { s: `%${search}%` });
    }
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCategoryLocalitySeoBySlug(slug: string): Promise<CategoryLocalitySeo> {
    const row = await this.categoryLocalitySeoRepo.findOne({ where: { slug, isActive: true } });
    if (!row) throw new NotFoundException('Category+Locality SEO page not found');
    return row;
  }

  async createCategoryLocalitySeo(data: Partial<CategoryLocalitySeo>): Promise<CategoryLocalitySeo> {
    const existing = await this.categoryLocalitySeoRepo.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    return this.categoryLocalitySeoRepo.save(this.categoryLocalitySeoRepo.create(data));
  }

  async updateCategoryLocalitySeo(id: string, data: Partial<CategoryLocalitySeo>): Promise<CategoryLocalitySeo> {
    const row = await this.categoryLocalitySeoRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Category+Locality SEO page not found');
    if (data.slug && data.slug !== row.slug) {
      const exists = await this.categoryLocalitySeoRepo.findOne({ where: { slug: data.slug } });
      if (exists) throw new ConflictException('Slug already exists');
    }
    Object.assign(row, data);
    return this.categoryLocalitySeoRepo.save(row);
  }

  async deleteCategoryLocalitySeo(id: string): Promise<{ message: string }> {
    const row = await this.categoryLocalitySeoRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Category+Locality SEO page not found');
    await this.categoryLocalitySeoRepo.remove(row);
    return { message: 'Category+Locality SEO page deleted' };
  }

  // ── Categories SEO ────────────────────────────────────────────────────────

  async getCategoriesSeo() {
    return this.propCategoryRepo.find({ where: { status: true }, order: { sortOrder: 'ASC' } });
  }

  async getCategorySeoBySlug(slug: string) {
    const cat = await this.propCategoryRepo.findOne({ where: { slug, status: true } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  // ── City Pages (legacy) ───────────────────────────────────────────────────

  async getCityPages(page = 1, limit = 20, search?: string) {
    const qb = this.cityPageRepo.createQueryBuilder('p').orderBy('p.cityName', 'ASC').addOrderBy('p.pageType', 'ASC');
    if (search) {
      qb.where('(p.cityName LIKE :s OR p.slug LIKE :s)', { s: `%${search}%` });
    }
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCityPageBySlug(slug: string): Promise<CityPage> {
    const page = await this.cityPageRepo.findOne({ where: { slug, isActive: true } });
    if (!page) throw new NotFoundException('City page not found');
    return page;
  }

  async createCityPage(data: Partial<CityPage>): Promise<CityPage> {
    const existing = await this.cityPageRepo.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    return this.cityPageRepo.save(this.cityPageRepo.create(data));
  }

  async updateCityPage(id: string, data: Partial<CityPage>): Promise<CityPage> {
    const page = await this.cityPageRepo.findOne({ where: { id } });
    if (!page) throw new NotFoundException('City page not found');
    if (data.slug && data.slug !== page.slug) {
      const exists = await this.cityPageRepo.findOne({ where: { slug: data.slug } });
      if (exists) throw new ConflictException('Slug already exists');
    }
    Object.assign(page, data);
    return this.cityPageRepo.save(page);
  }

  async deleteCityPage(id: string): Promise<{ message: string }> {
    const page = await this.cityPageRepo.findOne({ where: { id } });
    if (!page) throw new NotFoundException('City page not found');
    await this.cityPageRepo.remove(page);
    return { message: 'City page deleted' };
  }

  // ── SEO Config ────────────────────────────────────────────────────────────

  async getAllSeoConfigs(): Promise<SeoConfig[]> {
    return this.seoConfigRepo.find({ order: { key: 'ASC' } });
  }

  async getSeoConfigAsMap(): Promise<Record<string, string>> {
    const configs = await this.seoConfigRepo.find();
    return configs.reduce((acc, c) => ({ ...acc, [c.key]: c.value }), {});
  }

  async upsertSeoConfig(key: string, value: string): Promise<SeoConfig> {
    let config = await this.seoConfigRepo.findOne({ where: { key } });
    if (!config) {
      config = this.seoConfigRepo.create({ key, value });
    } else {
      config.value = value;
    }
    return this.seoConfigRepo.save(config);
  }

  async bulkUpsertSeoConfig(data: { key: string; value: string; label?: string; description?: string }[]): Promise<SeoConfig[]> {
    const results: SeoConfig[] = [];
    for (const item of data) {
      let config = await this.seoConfigRepo.findOne({ where: { key: item.key } });
      if (!config) {
        config = this.seoConfigRepo.create(item);
      } else {
        Object.assign(config, item);
      }
      results.push(await this.seoConfigRepo.save(config));
    }
    return results;
  }

  async deleteSeoConfig(id: string): Promise<{ message: string }> {
    const config = await this.seoConfigRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException('SEO config not found');
    await this.seoConfigRepo.remove(config);
    return { message: 'Config deleted' };
  }

  // ── Footer SEO Links ──────────────────────────────────────────────────────

  async getFooterLinkGroups(): Promise<FooterSeoLinkGroup[]> {
    return this.footerGroupRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async getAllFooterLinkGroups(): Promise<FooterSeoLinkGroup[]> {
    return this.footerGroupRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async getFooterLinksWithGroups() {
    const groups = await this.footerGroupRepo.find({ order: { sortOrder: 'ASC' } });
    const links = await this.footerLinkRepo.find({ order: { groupId: 'ASC', sortOrder: 'ASC' } });
    return groups.map(g => ({
      ...g,
      links: links.filter(l => l.groupId === g.id),
    }));
  }

  async getActiveFooterLinksWithGroups() {
    const groups = await this.footerGroupRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
    const links = await this.footerLinkRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
    return groups.map(g => ({
      ...g,
      links: links.filter(l => l.groupId === g.id),
    }));
  }

  async createFooterGroup(data: Partial<FooterSeoLinkGroup>): Promise<FooterSeoLinkGroup> {
    return this.footerGroupRepo.save(this.footerGroupRepo.create(data));
  }

  async updateFooterGroup(id: string, data: Partial<FooterSeoLinkGroup>): Promise<FooterSeoLinkGroup> {
    const group = await this.footerGroupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');
    Object.assign(group, data);
    return this.footerGroupRepo.save(group);
  }

  async deleteFooterGroup(id: string): Promise<{ message: string }> {
    const group = await this.footerGroupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');
    await this.footerGroupRepo.remove(group);
    return { message: 'Group deleted' };
  }

  async getFooterLinksByGroup(groupId: string): Promise<FooterSeoLink[]> {
    return this.footerLinkRepo.find({ where: { groupId }, order: { sortOrder: 'ASC' } });
  }

  async createFooterLink(data: Partial<FooterSeoLink>): Promise<FooterSeoLink> {
    return this.footerLinkRepo.save(this.footerLinkRepo.create(data));
  }

  async updateFooterLink(id: string, data: Partial<FooterSeoLink>): Promise<FooterSeoLink> {
    const link = await this.footerLinkRepo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    Object.assign(link, data);
    return this.footerLinkRepo.save(link);
  }

  async deleteFooterLink(id: string): Promise<{ message: string }> {
    const link = await this.footerLinkRepo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    await this.footerLinkRepo.remove(link);
    return { message: 'Link deleted' };
  }
}

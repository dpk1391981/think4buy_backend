import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CityPage } from './entities/city-page.entity';
import { SeoConfig } from './entities/seo-config.entity';
import { FooterSeoLink, FooterSeoLinkGroup, FooterSeoCategory } from './entities/footer-seo-link.entity';
import { LocalitySeo } from './entities/locality-seo.entity';
import { CategoryCitySeo } from './entities/category-city-seo.entity';
import { CategoryLocalitySeo } from './entities/category-locality-seo.entity';
import { AgentCitySeo } from './entities/agent-city-seo.entity';
import { PropertyCitySeo } from './entities/property-city-seo.entity';
import { QuickSeoTemplate } from './entities/quick-seo-template.entity';
import { PropCategory } from '../property-config/entities/prop-category.entity';
import { City } from '../locations/entities/city.entity';
import { Location } from '../locations/entities/location.entity';

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

/**
 * Static-asset paths reach the resolver whenever a browser asks for something
 * Next.js doesn't serve — /apple-touch-icon.png is a constant in the logs. No
 * SEO row can ever match one, so don't spend queries on them.
 */
function isAssetPath(slug: string): boolean {
  const last = slug.replace(/^\/+|\/+$/g, '').split('/').pop() ?? '';
  return /\.[a-z0-9]{2,5}$/i.test(last);
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
    @InjectRepository(FooterSeoCategory) private footerCategoryRepo: Repository<FooterSeoCategory>,
    @InjectRepository(PropCategory) private propCategoryRepo: Repository<PropCategory>,
    @InjectRepository(City) private cityRepo: Repository<City>,
    @InjectRepository(LocalitySeo) private localitySeoRepo: Repository<LocalitySeo>,
    @InjectRepository(CategoryCitySeo) private categoryCitySeoRepo: Repository<CategoryCitySeo>,
    @InjectRepository(CategoryLocalitySeo) private categoryLocalitySeoRepo: Repository<CategoryLocalitySeo>,
    @InjectRepository(AgentCitySeo) private agentCitySeoRepo: Repository<AgentCitySeo>,
    @InjectRepository(PropertyCitySeo) private propertyCitySeoRepo: Repository<PropertyCitySeo>,
    @InjectRepository(Location) private locationRepo: Repository<Location>,
    @InjectRepository(QuickSeoTemplate) private quickSeoTemplateRepo: Repository<QuickSeoTemplate>,
  ) {}

  // ── Public footer cache ───────────────────────────────────────────────────
  // The footer is on every page, and its content changes only when an admin
  // edits it. Held in process (one API instance per PM2 worker) and dropped on
  // every footer write, so an edit shows up on the next request, not in 5 min.

  private footerCache: { at: number; data: any } | null = null;
  private static readonly FOOTER_CACHE_TTL_MS = 5 * 60 * 1000;

  private readFooterCache(): any | null {
    if (!this.footerCache) return null;
    if (Date.now() - this.footerCache.at > SeoService.FOOTER_CACHE_TTL_MS) {
      this.footerCache = null;
      return null;
    }
    return this.footerCache.data;
  }

  private invalidateFooterCache(): void {
    this.footerCache = null;
  }

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

    // Normalised once. Null for asset paths, which can never match a row and
    // otherwise cost a query on every 404'd icon or map file.
    const lookupSlug = urlSlug && !isAssetPath(urlSlug)
      ? urlSlug.replace(/^\/+|\/+$/g, '').toLowerCase()
      : null;

    // ── Priority 0: Footer Link SEO ───────────────────────────────────────
    // Exact URL match against footer_seo_links — takes precedence over all
    // other levels so admins can fully control programmatic SEO pages.
    // Quick SEO always writes records here, so every Quick-SEO-generated page
    // automatically gets highest-priority content resolution.
    //
    // NOTE: isActive is NOT checked here — showInFooter only controls footer-nav
    // visibility; the SEO content of a footer link is always authoritative
    // regardless of whether it is visible in the site footer.
    //
    // If the footer link has full page content (h1/intro/bottom/faq) it returns
    // immediately.  If it only carries meta tags (metaTitle / metaDescription /
    // metaKeywords / canonicalUrl), we save those overrides and continue
    // checking lower-priority sources for actual page content, then merge.
    let footerMetaOverride: Partial<SeoPageConfig> | null = null;
    if (lookupSlug) {
      const normalized = lookupSlug;
      const footerLink = await this.footerLinkRepo
        .createQueryBuilder('fl')
        // NOTE: intentionally no isActive filter — content is served even when
        // the link is hidden from the footer nav (showInFooter=false → isActive=false).
        //
        // Matched against the raw column, never LOWER(TRIM(...)): a function
        // around `url` makes IDX_footer_seo_links_url unusable and turns every
        // listing-page render into a full scan of the table. Rows are written
        // as '/slug'; the bare form covers older hand-entered rows. Case is
        // already handled — the column collates utf8mb4_0900_ai_ci.
        .where('fl.url IN (:...urls)', { urls: ['/' + normalized, normalized] })
        .andWhere(
          '(fl.metaTitle IS NOT NULL OR fl.h1Title IS NOT NULL OR fl.introContent IS NOT NULL OR fl.bottomContent IS NOT NULL OR fl.faqJson IS NOT NULL)',
        )
        .getOne();

      if (footerLink) {
        const hasContent =
          footerLink.h1Title || footerLink.introContent || footerLink.bottomContent || footerLink.faqJson?.length;

        if (hasContent) {
          // Full override — return immediately
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

        // Meta-only override — save and fall through for page content
        footerMetaOverride = {
          source: 'footer_link',
          metaTitle: footerLink.metaTitle ?? null,
          metaDescription: footerLink.metaDescription ?? null,
          metaKeywords: footerLink.metaKeywords ?? null,
          canonicalUrl: footerLink.canonicalUrl ?? null,
          robots: footerLink.robots ?? 'index,follow',
        };
      }
    }

    // ── Priority 0.5: City SEO Pages (exact slug match) ───────────────────
    // city_seo_pages stores rich content for city-level category pages
    // (buy/rent/pg/commercial/new_projects per city). Match by exact slug.
    if (lookupSlug) {
      const cityPage = await this.cityPageRepo.findOne({
        where: { slug: lookupSlug, isActive: true },
      });
      if (cityPage && (cityPage.h1 || cityPage.introContent || cityPage.seoContent || cityPage.faqs?.length)) {
        const fields = normalizeOldFields(cityPage);
        const ctx = { city: cityPage.cityName, locality: localitySlug ?? '', category: categorySlug ?? '' };
        const resolved = applyPlaceholders(
          {
            source: 'city' as const,
            ...fields,
            context: { citySlug, cityName: cityPage.cityName, categorySlug },
          },
          ctx,
        );
        // Merge footer meta override on top if present
        return footerMetaOverride ? { ...resolved, ...footerMetaOverride } : resolved;
      }
    }

    // ── Priority 0.7: Category+Locality SEO by URL slug ──────────────────
    // Quick SEO creates records whose slug field IS the canonical URL.
    // Doing a slug-based lookup here means the resolver works regardless of
    // whether the category slug stored in the record matches what the URL
    // parser emitted (e.g. "flats" stored vs "buy" parsed from LISTING_PREFIXES).
    if (lookupSlug) {
      const row = await this.categoryLocalitySeoRepo.findOne({
        where: { slug: lookupSlug, isActive: true },
      });
      if (row) {
        const ctx = { city: row.cityName, locality: row.localityName, category: row.categorySlug };
        const resolved = applyPlaceholders(
          {
            source: 'category_locality' as const,
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
              categorySlug: row.categorySlug,
              citySlug: row.citySlug,
              cityName: row.cityName,
              localitySlug: row.localitySlug,
              localityName: row.localityName,
            },
          },
          ctx,
        );
        return footerMetaOverride ? { ...resolved, ...footerMetaOverride } : resolved;
      }
    }

    // ── Priority 0.8: Category+City SEO by URL slug ───────────────────────
    if (lookupSlug) {
      const row = await this.categoryCitySeoRepo.findOne({
        where: { slug: lookupSlug, isActive: true },
      });
      if (row) {
        const ctx = { city: row.cityName, locality: localitySlug ?? '', category: row.categorySlug };
        const resolved = applyPlaceholders(
          {
            source: 'category_city' as const,
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
              categorySlug: row.categorySlug,
              citySlug: row.citySlug,
              cityName: row.cityName,
            },
          },
          ctx,
        );
        return footerMetaOverride ? { ...resolved, ...footerMetaOverride } : resolved;
      }
    }

    // ── Priority 1: Category + Locality ──────────────────────────────────
    if (categorySlug && citySlug && localitySlug) {
      const row = await this.categoryLocalitySeoRepo.findOne({
        where: { categorySlug, citySlug, localitySlug, isActive: true },
      });
      if (row) {
        const ctx = { city: row.cityName, locality: row.localityName, category: categorySlug };
        const resolved = applyPlaceholders(
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
        return footerMetaOverride ? { ...resolved, ...footerMetaOverride } : resolved;
      }
    }

    // ── Priority 2: Category + City ───────────────────────────────────────
    if (categorySlug && citySlug) {
      const row = await this.categoryCitySeoRepo.findOne({
        where: { categorySlug, citySlug, isActive: true },
      });
      if (row) {
        const ctx = { city: row.cityName, locality: localitySlug ?? '', category: categorySlug };
        const resolved = applyPlaceholders(
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
        return footerMetaOverride ? { ...resolved, ...footerMetaOverride } : resolved;
      }
    }

    // ── Priority 3: Locality ──────────────────────────────────────────────
    if (citySlug && localitySlug) {
      const row = await this.localitySeoRepo.findOne({
        where: { citySlug, localitySlug, isActive: true },
      });
      if (row) {
        const ctx = { city: row.cityName, locality: row.localityName, category: categorySlug ?? '' };
        const resolved = applyPlaceholders(
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
        return footerMetaOverride ? { ...resolved, ...footerMetaOverride } : resolved;
      }
    }

    // ── Priority 4: City ──────────────────────────────────────────────────
    if (citySlug) {
      const row = await this.cityRepo.findOne({ where: { slug: citySlug, isActive: true } });
      if (row && (row.metaTitle || row.h1)) {
        const fields = normalizeOldFields(row);
        const ctx = { city: row.name, locality: localitySlug ?? '', category: categorySlug ?? '' };
        const resolved = applyPlaceholders(
          {
            source: 'city',
            ...fields,
            context: { citySlug, cityName: row.name },
          },
          ctx,
        );
        return footerMetaOverride ? { ...resolved, ...footerMetaOverride } : resolved;
      }
    }

    // ── Priority 5: Category ──────────────────────────────────────────────
    if (categorySlug) {
      const row = await this.propCategoryRepo.findOne({ where: { slug: categorySlug, status: true } });
      if (row && (row.metaTitle || row.h1)) {
        const fields = normalizeOldFields(row);
        const ctx = { city: citySlug ?? '', locality: localitySlug ?? '', category: row.name };
        const resolved = applyPlaceholders(
          {
            source: 'category',
            ...fields,
            context: { categorySlug, categoryName: row.name },
          },
          ctx,
        );
        return footerMetaOverride ? { ...resolved, ...footerMetaOverride } : resolved;
      }
    }

    // If we have a footer meta override but no content from any priority,
    // return the footer link data as-is (meta only, no page content shown)
    if (footerMetaOverride) {
      return {
        source: 'footer_link',
        h1Title: null,
        introContent: null,
        bottomContent: null,
        faqJson: null,
        internalLinks: null,
        context: { citySlug, localitySlug, categorySlug },
        ...footerMetaOverride,
      } as SeoPageConfig;
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

  // ── Footer link listings ──────────────────────────────────────────────────
  //
  // Neither listing may select introContent / bottomContent / faqJson. Every
  // Quick SEO page carries HTML in those columns, and there are tens of
  // thousands of pages: loading them all and serialising them to JSON is what
  // took the footer request to 13s and then killed the API process with
  // "Reached heap limit Allocation failed - JavaScript heap out of memory".
  // The list views only need enough to draw a link; the editor fetches the one
  // row it is about to edit through getFooterLinkById().

  /** Columns the public footer renders. Nothing else may be added here. */
  private static readonly FOOTER_LINK_LIST_COLUMNS = [
    'id', 'groupId', 'label', 'url', 'localityId', 'localityName', 'isActive', 'sortOrder',
  ] as const;

  private groupLinks<T extends { groupId: string }>(
    groups: FooterSeoLinkGroup[],
    links: T[],
  ): (FooterSeoLinkGroup & { links: T[] })[] {
    // Map, not a filter per group: 500 groups × 40k links is 20M comparisons.
    const byGroup = new Map<string, T[]>();
    for (const link of links) {
      const bucket = byGroup.get(link.groupId);
      if (bucket) bucket.push(link);
      else byGroup.set(link.groupId, [link]);
    }
    return groups.map(g => ({ ...g, links: byGroup.get(g.id) ?? [] }));
  }

  /**
   * Admin listing. Same light columns as the public one plus the short meta
   * fields the list displays, and `hasSeoContent` computed in SQL so the UI can
   * still show which links carry content without shipping the content itself.
   */
  async getFooterLinksWithGroups() {
    const groups = await this.footerGroupRepo.find({ order: { sortOrder: 'ASC' } });
    const links = await this.footerLinkRepo
      .createQueryBuilder('fl')
      .select([
        ...SeoService.FOOTER_LINK_LIST_COLUMNS.map(c => `fl.${c}`),
        'fl.h1Title', 'fl.metaTitle', 'fl.robots',
      ])
      .addSelect(
        `(fl.metaTitle IS NOT NULL OR fl.h1Title IS NOT NULL
          OR fl.introContent IS NOT NULL OR fl.bottomContent IS NOT NULL
          OR fl.faqJson IS NOT NULL)`,
        'hasSeoContent',
      )
      .orderBy('fl.groupId', 'ASC')
      .addOrderBy('fl.sortOrder', 'ASC')
      .getRawAndEntities();

    const flagById = new Map(links.raw.map((r: any) => [r.fl_id, !!Number(r.hasSeoContent)]));
    const withFlag = links.entities.map(l => ({ ...l, hasSeoContent: flagById.get(l.id) ?? false }));
    return this.groupLinks(groups, withFlag);
  }

  /** Public footer. Cached — see footerCache. */
  async getActiveFooterLinksWithGroups() {
    const cached = this.readFooterCache();
    if (cached) return cached;

    const groups = await this.footerGroupRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
    const links = await this.footerLinkRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
      select: [...SeoService.FOOTER_LINK_LIST_COLUMNS],
    });
    const result = this.groupLinks(groups, links);
    this.footerCache = { at: Date.now(), data: result };
    return result;
  }

  /** The full row, including SEO content — one link at a time, for the editor. */
  async getFooterLinkById(id: string): Promise<FooterSeoLink> {
    const link = await this.footerLinkRepo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Footer link not found');
    return link;
  }

  async createFooterGroup(data: Partial<FooterSeoLinkGroup>): Promise<FooterSeoLinkGroup> {
    this.invalidateFooterCache();
    return this.footerGroupRepo.save(this.footerGroupRepo.create(data));
  }

  async updateFooterGroup(id: string, data: Partial<FooterSeoLinkGroup>): Promise<FooterSeoLinkGroup> {
    const group = await this.footerGroupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');
    Object.assign(group, data);
    this.invalidateFooterCache();
    return this.footerGroupRepo.save(group);
  }

  async deleteFooterGroup(id: string): Promise<{ message: string }> {
    const group = await this.footerGroupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');
    await this.footerGroupRepo.remove(group);
    this.invalidateFooterCache();
    return { message: 'Group deleted' };
  }

  async getFooterLinksByGroup(groupId: string): Promise<FooterSeoLink[]> {
    return this.footerLinkRepo.find({ where: { groupId }, order: { sortOrder: 'ASC' } });
  }

  async getAllFooterLinksPageable(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    city?: string;
    isActive?: boolean;
  }) {
    const page  = params.page  ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);

    const qb = this.footerLinkRepo
      .createQueryBuilder('fl')
      .leftJoinAndSelect('fl.group', 'fg')
      .orderBy('fg.category', 'ASC')
      .addOrderBy('fg.cityName', 'ASC')
      .addOrderBy('fl.localityName', 'ASC');

    if (params.search) {
      qb.andWhere(
        '(fl.label LIKE :s OR fl.url LIKE :s OR fl.metaTitle LIKE :s OR fl.localityName LIKE :s)',
        { s: `%${params.search}%` },
      );
    }
    if (params.category) {
      qb.andWhere('fg.category = :cat', { cat: params.category });
    }
    if (params.city) {
      qb.andWhere('fg.cityName LIKE :city', { city: `%${params.city}%` });
    }
    if (params.isActive !== undefined) {
      qb.andWhere('fl.isActive = :active', { active: params.isActive });
    }

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();

    const enriched = items.map(link => ({
      id:           link.id,
      label:        link.label,
      url:          link.url,
      localityName: link.localityName,
      isActive:     link.isActive,
      metaTitle:    link.metaTitle,
      h1Title:      link.h1Title,
      robots:       link.robots,
      groupId:      link.groupId,
      groupTitle:   (link as any).group?.title ?? null,
      category:     (link as any).group?.category ?? null,
      cityName:     (link as any).group?.cityName ?? null,
      type:         link.localityName ? 'locality' : 'city',
    }));

    return { items: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createFooterLink(data: Partial<FooterSeoLink>): Promise<FooterSeoLink> {
    this.invalidateFooterCache();
    return this.footerLinkRepo.save(this.footerLinkRepo.create(data));
  }

  async updateFooterLink(id: string, data: Partial<FooterSeoLink>): Promise<FooterSeoLink> {
    const link = await this.footerLinkRepo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    Object.assign(link, data);
    this.invalidateFooterCache();
    return this.footerLinkRepo.save(link);
  }

  async deleteFooterLink(id: string): Promise<{ message: string }> {
    const link = await this.footerLinkRepo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    await this.footerLinkRepo.remove(link);
    this.invalidateFooterCache();
    return { message: 'Link deleted' };
  }

  // ── Agent City SEO CRUD ───────────────────────────────────────────────────

  async getAgentCitySeoPages(page = 1, limit = 20, search?: string) {
    const qb = this.agentCitySeoRepo.createQueryBuilder('a').orderBy('a.citySlug');
    if (search) {
      qb.where('(a.citySlug LIKE :s OR a.cityName LIKE :s OR a.slug LIKE :s)', { s: `%${search}%` });
    }
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAgentCitySeoBySlug(slug: string): Promise<AgentCitySeo | null> {
    return this.agentCitySeoRepo.findOne({ where: { slug, isActive: true } });
  }

  async createAgentCitySeo(data: Partial<AgentCitySeo>): Promise<AgentCitySeo> {
    const existing = await this.agentCitySeoRepo.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    return this.agentCitySeoRepo.save(this.agentCitySeoRepo.create(data));
  }

  async updateAgentCitySeo(id: string, data: Partial<AgentCitySeo>): Promise<AgentCitySeo> {
    const row = await this.agentCitySeoRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Agent City SEO not found');
    if (data.slug && data.slug !== row.slug) {
      const exists = await this.agentCitySeoRepo.findOne({ where: { slug: data.slug } });
      if (exists) throw new ConflictException('Slug already exists');
    }
    Object.assign(row, data);
    return this.agentCitySeoRepo.save(row);
  }

  async deleteAgentCitySeo(id: string): Promise<{ message: string }> {
    const row = await this.agentCitySeoRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Agent City SEO not found');
    await this.agentCitySeoRepo.remove(row);
    return { message: 'Agent City SEO deleted' };
  }

  async getAllActiveAgentCitySlugs(): Promise<string[]> {
    const rows = await this.agentCitySeoRepo.find({ where: { isActive: true }, select: ['citySlug'] });
    return rows.map(r => r.citySlug);
  }

  // ── Property City SEO CRUD ────────────────────────────────────────────────

  async getPropertyCitySeoPages(page = 1, limit = 20, search?: string) {
    const qb = this.propertyCitySeoRepo.createQueryBuilder('p').orderBy('p.citySlug');
    if (search) {
      qb.where('(p.citySlug LIKE :s OR p.cityName LIKE :s OR p.slug LIKE :s)', { s: `%${search}%` });
    }
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPropertyCitySeoBySlug(slug: string): Promise<PropertyCitySeo | null> {
    return this.propertyCitySeoRepo.findOne({ where: { slug, isActive: true } });
  }

  async createPropertyCitySeo(data: Partial<PropertyCitySeo>): Promise<PropertyCitySeo> {
    const existing = await this.propertyCitySeoRepo.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    return this.propertyCitySeoRepo.save(this.propertyCitySeoRepo.create(data));
  }

  async updatePropertyCitySeo(id: string, data: Partial<PropertyCitySeo>): Promise<PropertyCitySeo> {
    const row = await this.propertyCitySeoRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Property City SEO not found');
    if (data.slug && data.slug !== row.slug) {
      const exists = await this.propertyCitySeoRepo.findOne({ where: { slug: data.slug } });
      if (exists) throw new ConflictException('Slug already exists');
    }
    Object.assign(row, data);
    return this.propertyCitySeoRepo.save(row);
  }

  async deletePropertyCitySeo(id: string): Promise<{ message: string }> {
    const row = await this.propertyCitySeoRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Property City SEO not found');
    await this.propertyCitySeoRepo.remove(row);
    return { message: 'Property City SEO deleted' };
  }

  // ── Footer Categories CRUD ────────────────────────────────────────────────

  async getActiveFooterCategories(): Promise<FooterSeoCategory[]> {
    return this.footerCategoryRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async getAllFooterCategories(): Promise<FooterSeoCategory[]> {
    return this.footerCategoryRepo.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async createFooterCategory(data: Partial<FooterSeoCategory>): Promise<FooterSeoCategory> {
    const existing = await this.footerCategoryRepo.findOne({ where: { value: data.value } });
    if (existing) throw new ConflictException(`Category slug "${data.value}" already exists`);
    return this.footerCategoryRepo.save(this.footerCategoryRepo.create(data));
  }

  async updateFooterCategory(id: string, data: Partial<FooterSeoCategory>): Promise<FooterSeoCategory> {
    const row = await this.footerCategoryRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Footer category not found');
    if (data.value && data.value !== row.value) {
      const exists = await this.footerCategoryRepo.findOne({ where: { value: data.value } });
      if (exists) throw new ConflictException(`Category slug "${data.value}" already exists`);
    }
    Object.assign(row, data);
    return this.footerCategoryRepo.save(row);
  }

  async deleteFooterCategory(id: string): Promise<{ message: string }> {
    const row = await this.footerCategoryRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Footer category not found');
    await this.footerCategoryRepo.remove(row);
    return { message: 'Footer category deleted' };
  }

  // ── Quick SEO ─────────────────────────────────────────────────────────────

  private toSlug(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
  }

  private applyQuickSeoVars(
    text: string | null | undefined,
    t: { cityName: string; localityName: string; categorySlug: string },
  ): string | null {
    if (!text) return null;
    let result = text
      .replace(/\{city\}/gi, t.cityName)
      .replace(/\{locality\}/gi, t.localityName)
      .replace(/\{category\}/gi, t.categorySlug);

    // When locality is empty (city-level pages), remove orphaned separators
    // so "Flats for Sale in , Delhi" → "Flats for Sale in Delhi"
    if (!t.localityName) {
      result = result
        .replace(/\s*,\s*,/g, ',')           // double commas
        .replace(/\bin\s*,\s*/gi, 'in ')      // "in , City" → "in City"
        .replace(/,\s*([A-Z])/g, ', $1')      // normalise comma+space
        .replace(/\(\s*,\s*/g, '(')           // "( , City)" → "(City)"
        .replace(/,\s*\)/g, ')')              // "(Locality, )" → "(Locality)"
        .replace(/^\s*,\s*/g, '')             // leading comma
        .replace(/\s*,\s*$/g, '')             // trailing comma
        .replace(/\s{2,}/g, ' ')              // collapse multiple spaces
        .trim();
    }

    return result || null;
  }

  private generateQuickSlug(pattern: string, categorySlug: string, citySlug: string, localitySlug: string): string {
    return pattern
      .replace(/\{category\}/g, categorySlug)
      .replace(/\{city\}/g, citySlug)
      .replace(/\{locality\}/g, localitySlug)
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async getCategoryLabel(categorySlug: string): Promise<string> {
    const cat = await this.footerCategoryRepo.findOne({ where: { value: categorySlug } });
    if (cat) return cat.label;
    const LABELS: Record<string, string> = {
      buy: 'Property for Sale', rent: 'Property for Rent',
      flats: 'Flats for Sale', 'flats-rent': 'Flats for Rent',
      villas: 'Villas for Sale', plots: 'Plots for Sale',
      commercial: 'Commercial Property', office: 'Office Space',
      'new-projects': 'New Projects', pg: 'PG / Co-Living',
      industrial: 'Industrial Property', investment: 'Investment Property',
      builder_project: 'New Projects',
    };
    return LABELS[categorySlug] || categorySlug;
  }

  /** The city slugs a scope names, singular or plural form, de-duplicated. */
  private scopeCitySlugs(body: { citySlug?: string; citySlugs?: string[] }): string[] {
    const list = body.citySlugs?.length ? body.citySlugs : body.citySlug ? [body.citySlug] : [];
    return Array.from(new Set(list.map(s => (s || '').trim()).filter(Boolean)));
  }

  /**
   * The cities a scope names, as rows. Empty when the scope names none (the
   * all-cities path resolves those from the localities it finds instead).
   *
   * Used for city-level pages so that a city the admin explicitly picked gets
   * one even when it has no localities yet — a freshly imported city otherwise
   * produces no targets at all and would be silently dropped.
   */
  private async resolveQuickSeoCities(body: { citySlug?: string; citySlugs?: string[] }): Promise<{ citySlug: string; cityName: string; cityId?: string }[]> {
    const out: { citySlug: string; cityName: string; cityId?: string }[] = [];
    for (const cs of this.scopeCitySlugs(body)) {
      const city = await this.cityRepo.findOne({ where: { slug: cs } });
      if (city) out.push({ citySlug: cs, cityName: city.name, cityId: city.id });
    }
    return out;
  }

  /**
   * Turns a Quick SEO scope into the concrete city+locality pairs to write.
   *
   * Scope can name several cities (`citySlugs`) and several localities
   * (`localitySlugs`) — the admin picks exactly where a template applies, e.g.
   * the handful of cities a warehouse category is actually sold in. The
   * singular `citySlug` / `localitySlug` are the older one-at-a-time form and
   * still work; each is folded into its plural.
   *
   * `localitySlugs` is matched per city, so one flat list of localities coming
   * from a multi-city picker lands only in the city it belongs to.
   */
  private async resolveQuickSeoTargets(body: {
    categorySlug: string;
    citySlug?: string;
    citySlugs?: string[];
    localitySlug?: string;
    localitySlugs?: string[];
  }): Promise<{ categorySlug: string; citySlug: string; cityName: string; cityId?: string; localitySlug: string; localityName: string; localityId?: string }[]> {
    const { categorySlug, localitySlug } = body;
    // Per-city max: no global cap when cities are named (frontend batches city-by-city).
    // For the all-cities fallback path (preview only), cap at 500 across all cities.
    const MAX_LOCALITIES_PER_CITY = 2000;
    const MAX_ITEMS_GLOBAL = 500;
    const targets: { categorySlug: string; citySlug: string; cityName: string; cityId?: string; localitySlug: string; localityName: string; localityId?: string }[] = [];

    const cities = this.scopeCitySlugs(body);
    const localities = Array.from(new Set(
      (body.localitySlugs?.length ? body.localitySlugs : localitySlug ? [localitySlug] : [])
        .map(s => (s || '').trim()).filter(Boolean),
    ));
    const localitySet = new Set(localities);

    if (cities.length > 0) {
      for (const cs of cities) {
        const city = await this.cityRepo.findOne({ where: { slug: cs } });
        if (!city) {
          // One bad slug must not sink a multi-city run; alone it is still an error.
          if (cities.length === 1) throw new NotFoundException(`City not found: ${cs}`);
          continue;
        }

        const locs = await this.locationRepo.find({ where: { city: city.name, isActive: true }, take: MAX_LOCALITIES_PER_CITY });
        const unique = Array.from(new Map(locs.filter(l => l.locality).map(l => [l.locality, l])).values());
        const matched = localitySet.size > 0
          ? unique.filter(l => localitySet.has(this.toSlug(l.locality)))
          : unique;

        for (const loc of matched) {
          targets.push({ categorySlug, citySlug: cs, cityName: city.name, cityId: city.id, localitySlug: this.toSlug(loc.locality), localityName: loc.locality, localityId: loc.id });
        }

        // A single named locality that this city has no row for is still a page
        // the admin asked for — keep the long-standing fallback for that one case.
        if (matched.length === 0 && cities.length === 1 && localities.length === 1) {
          const only = localities[0];
          targets.push({
            categorySlug, citySlug: cs, cityName: city.name, cityId: city.id,
            localitySlug: only,
            localityName: only.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          });
        }
      }
    } else {
      // No city named at all — every active city, capped. The admin screen
      // always names its cities and batches them one request each, so this is
      // the fallback for an API caller that didn't.
      const allCities = await this.cityRepo.find({ where: { isActive: true }, order: { name: 'ASC' }, take: 100 });
      const perCity = Math.max(1, Math.floor(MAX_ITEMS_GLOBAL / Math.max(allCities.length, 1)));
      for (const city of allCities) {
        if (!city.slug || targets.length >= MAX_ITEMS_GLOBAL) break;
        const locs = await this.locationRepo.find({ where: { city: city.name, isActive: true }, take: perCity });
        const deduped = Array.from(new Map(locs.filter(l => l.locality).map(l => [l.locality, l])).values());
        const unique = localitySet.size > 0
          ? deduped.filter(l => localitySet.has(this.toSlug(l.locality)))
          : deduped;
        for (const loc of unique) {
          if (targets.length >= MAX_ITEMS_GLOBAL) break;
          targets.push({ categorySlug, citySlug: city.slug, cityName: city.name, cityId: city.id, localitySlug: this.toSlug(loc.locality), localityName: loc.locality, localityId: loc.id });
        }
      }
    }

    return targets;
  }

  // ── Quick SEO Preview ─────────────────────────────────────────────────────
  // Checks footer_seo_links for existence so preview accurately reflects
  // what would be created vs updated vs skipped.

  async quickSeoPreview(body: {
    categorySlug: string;
    citySlug?: string;
    citySlugs?: string[];
    localitySlug?: string;
    localitySlugs?: string[];
    slugPattern?: string;
    citySlugPattern?: string;
    includeCityPage?: boolean;
    template: {
      h1Title?: string;
      metaTitle?: string;
      metaDescription?: string;
      metaKeywords?: string;
      canonicalUrl?: string;
      introContent?: string;
      bottomContent?: string;
      faqJson?: { question: string; answer: string }[];
      robots?: string;
    };
  }): Promise<{
    total: number;
    items: {
      type: 'city' | 'locality';
      cityName: string;
      localityName: string;
      citySlug: string;
      localitySlug: string;
      slug: string;
      exists: boolean;
      previewMetaTitle: string | null;
      previewH1: string | null;
    }[];
  }> {
    const localityPattern = body.slugPattern || '{category}-in-{city}-{locality}';
    const cityPattern = body.citySlugPattern || '{category}-in-{city}';
    const targets = await this.resolveQuickSeoTargets(body);
    const items: any[] = [];

    // City-level pages (one per unique city). Cities the scope names explicitly
    // count even if they have no localities yet; otherwise they come from the
    // targets, which is all the all-cities path knows about.
    if (body.includeCityPage) {
      const named = await this.resolveQuickSeoCities(body);
      const cityRows = named.length > 0
        ? named
        : Array.from(new Map(targets.map(t => [t.citySlug, { citySlug: t.citySlug, cityName: t.cityName, cityId: t.cityId }])).values());
      const seenCities = new Set<string>();
      for (const t of cityRows) {
        if (seenCities.has(t.citySlug)) continue;
        seenCities.add(t.citySlug);
        const slug = this.generateQuickSlug(cityPattern, body.categorySlug, t.citySlug, '');
        const url = `/${slug}`;
        const existing = await this.footerLinkRepo.findOne({ where: { url } });
        const ctx = { ...t, categorySlug: body.categorySlug, localityName: '' };
        items.push({
          type: 'city',
          cityName: t.cityName,
          localityName: '',
          citySlug: t.citySlug,
          localitySlug: '',
          slug,
          exists: !!existing,
          previewMetaTitle: this.applyQuickSeoVars(body.template.metaTitle, ctx),
          previewH1: this.applyQuickSeoVars(body.template.h1Title, ctx),
        });
      }
    }

    // Locality-level pages
    for (const t of targets) {
      const slug = this.generateQuickSlug(localityPattern, t.categorySlug, t.citySlug, t.localitySlug);
      const url = `/${slug}`;
      const existing = await this.footerLinkRepo.findOne({ where: { url } });
      items.push({
        type: 'locality',
        cityName: t.cityName,
        localityName: t.localityName,
        citySlug: t.citySlug,
        localitySlug: t.localitySlug,
        slug,
        exists: !!existing,
        previewMetaTitle: this.applyQuickSeoVars(body.template.metaTitle, t),
        previewH1: this.applyQuickSeoVars(body.template.h1Title, t),
      });
    }

    return { total: items.length, items };
  }

  // ── Quick SEO Apply ───────────────────────────────────────────────────────
  // Writes to footer_seo_link_groups + footer_seo_links so that:
  //  - Pages appear in the Footer SEO Links admin panel
  //  - Pages appear in the public footer (when showInFooter = true)
  //  - The SEO resolver Priority 0 (footer_link URL match) picks them up

  async quickSeoApply(body: {
    categorySlug: string;
    citySlug?: string;
    citySlugs?: string[];
    localitySlug?: string;
    localitySlugs?: string[];
    slugPattern?: string;
    citySlugPattern?: string;
    overwriteExisting?: boolean;
    showInFooter?: boolean;
    includeCityPage?: boolean;
    template: {
      h1Title?: string;
      metaTitle?: string;
      metaDescription?: string;
      metaKeywords?: string;
      canonicalUrl?: string;
      introContent?: string;
      bottomContent?: string;
      faqJson?: { question: string; answer: string }[];
      robots?: string;
    };
  }): Promise<{ created: number; updated: number; skipped: number; failed: number; total: number }> {
    const localityPattern = body.slugPattern || '{category}-in-{city}-{locality}';
    const cityPattern = body.citySlugPattern || '{category}-in-{city}';
    // Footer links are ALWAYS active (their SEO content is live).
    // showInFooter controls only whether the group appears in the public footer nav.
    const groupActive = body.showInFooter !== false;
    const targets = await this.resolveQuickSeoTargets(body);
    const catLabel = await this.getCategoryLabel(body.categorySlug);

    let created = 0, updated = 0, skipped = 0, failed = 0;

    // Build a map of city slug → group (find or create one group per category+city).
    // Cities the scope names explicitly are all included, so one the admin picked
    // that has no localities yet still gets its group and its city-level page.
    const groupMap = new Map<string, FooterSeoLinkGroup>();
    const citySet = new Map<string, { cityName: string; cityId?: string }>();
    for (const c of await this.resolveQuickSeoCities(body)) {
      citySet.set(c.citySlug, { cityName: c.cityName, cityId: c.cityId });
    }
    for (const t of targets) {
      if (!citySet.has(t.citySlug)) citySet.set(t.citySlug, { cityName: t.cityName, cityId: t.cityId });
    }

    for (const [cs, cityData] of citySet.entries()) {
      let group = await this.footerGroupRepo.findOne({
        where: { category: body.categorySlug, cityName: cityData.cityName },
      });
      if (!group) {
        group = this.footerGroupRepo.create({
          title: `${catLabel} in ${cityData.cityName}`,
          category: body.categorySlug,
          cityName: cityData.cityName,
          cityId: cityData.cityId || null,
          isActive: groupActive,   // controls footer nav visibility only
          sortOrder: 0,
        });
        group = await this.footerGroupRepo.save(group);
      } else if (body.overwriteExisting) {
        group.isActive = groupActive;
        group = await this.footerGroupRepo.save(group);
      }
      groupMap.set(cs, group);

      // City-level page (one per city, no locality in URL)
      if (body.includeCityPage) {
        const slug = this.generateQuickSlug(cityPattern, body.categorySlug, cs, '');
        const url = `/${slug}`;
        const ctx = { categorySlug: body.categorySlug, citySlug: cs, cityName: cityData.cityName, localitySlug: '', localityName: '' };
        const seoData = {
          groupId: group.id,
          label: `${catLabel} in ${cityData.cityName}`,
          url,
          localityName: null as string | null,
          localityId: null as string | null,
          isActive: true,          // SEO content is always live regardless of footer nav visibility
          sortOrder: 0,
          h1Title: this.applyQuickSeoVars(body.template.h1Title, ctx),
          metaTitle: this.applyQuickSeoVars(body.template.metaTitle, ctx),
          metaDescription: this.applyQuickSeoVars(body.template.metaDescription, ctx),
          metaKeywords: this.applyQuickSeoVars(body.template.metaKeywords, ctx),
          canonicalUrl: this.applyQuickSeoVars(body.template.canonicalUrl, ctx),
          introContent: this.applyQuickSeoVars(body.template.introContent, ctx),
          bottomContent: this.applyQuickSeoVars(body.template.bottomContent, ctx),
          faqJson: body.template.faqJson?.map(f => ({
            question: this.applyQuickSeoVars(f.question, ctx) ?? f.question,
            answer: this.applyQuickSeoVars(f.answer, ctx) ?? f.answer,
          })) ?? null,
          robots: body.template.robots || 'index,follow',
        };
        const existingCity = await this.footerLinkRepo.findOne({ where: { url } });
        if (existingCity && !body.overwriteExisting) {
          skipped++;
        } else if (existingCity) {
          Object.assign(existingCity, seoData);
          await this.footerLinkRepo.save(existingCity);
          updated++;
        } else {
          await this.footerLinkRepo.save(this.footerLinkRepo.create(seoData));
          created++;
        }
      }
    }

    // ── Locality-level pages — batch lookup then batch save ────────────────────
    // Build all target slugs first, then do a single IN-query to find existing rows.
    // This replaces N individual findOne calls with one query, dramatically reducing
    // DB round-trips when a city has many localities.
    const localityTargets = targets.map(t => ({
      t,
      group: groupMap.get(t.citySlug),
      slug:  this.generateQuickSlug(localityPattern, t.categorySlug, t.citySlug, t.localitySlug),
    })).filter(item => !!item.group);

    failed += targets.length - localityTargets.length; // targets missing a group

    if (localityTargets.length > 0) {
      const urls = localityTargets.map(item => `/${item.slug}`);

      // Single batch query for all existing links
      const existingLinks = await this.footerLinkRepo
        .createQueryBuilder('fl')
        .where('fl.url IN (:...urls)', { urls })
        .getMany();
      const existingMap = new Map(existingLinks.map(l => [l.url, l]));

      const toCreate: FooterSeoLink[] = [];
      const toUpdate: FooterSeoLink[] = [];

      for (const { t, group, slug } of localityTargets) {
        try {
          const url = `/${slug}`;
          const existing = existingMap.get(url);

          if (existing && !body.overwriteExisting) { skipped++; continue; }

          const seoData = {
            groupId: group!.id,
            label: t.localityName,
            url,
            localityName: t.localityName,
            localityId: t.localityId || null,
            isActive: true,
            sortOrder: 0,
            h1Title: this.applyQuickSeoVars(body.template.h1Title, t),
            metaTitle: this.applyQuickSeoVars(body.template.metaTitle, t),
            metaDescription: this.applyQuickSeoVars(body.template.metaDescription, t),
            metaKeywords: this.applyQuickSeoVars(body.template.metaKeywords, t),
            canonicalUrl: this.applyQuickSeoVars(body.template.canonicalUrl, t),
            introContent: this.applyQuickSeoVars(body.template.introContent, t),
            bottomContent: this.applyQuickSeoVars(body.template.bottomContent, t),
            faqJson: body.template.faqJson?.map(f => ({
              question: this.applyQuickSeoVars(f.question, t) ?? f.question,
              answer: this.applyQuickSeoVars(f.answer, t) ?? f.answer,
            })) ?? null,
            robots: body.template.robots || 'index,follow',
          };

          if (existing) {
            Object.assign(existing, seoData);
            toUpdate.push(existing);
          } else {
            toCreate.push(this.footerLinkRepo.create(seoData));
          }
        } catch {
          failed++;
        }
      }

      // Batch save in chunks of 100 to avoid oversized queries
      const CHUNK = 100;
      for (let i = 0; i < toCreate.length; i += CHUNK) {
        await this.footerLinkRepo.save(toCreate.slice(i, i + CHUNK));
      }
      for (let i = 0; i < toUpdate.length; i += CHUNK) {
        await this.footerLinkRepo.save(toUpdate.slice(i, i + CHUNK));
      }
      created += toCreate.length;
      updated += toUpdate.length;
    }

    // Bulk apply is the main way footer links appear — the cached public
    // payload is stale the moment it finishes.
    this.invalidateFooterCache();

    const cityPageCount = body.includeCityPage ? citySet.size : 0;
    return { created, updated, skipped, failed, total: targets.length + cityPageCount };
  }

  // ── Quick SEO Templates ───────────────────────────────────────────────────

  async listQuickSeoTemplates(): Promise<QuickSeoTemplate[]> {
    return this.quickSeoTemplateRepo.find({ order: { categorySlug: 'ASC', name: 'ASC' } });
  }

  async getQuickSeoTemplate(id: string): Promise<QuickSeoTemplate> {
    const t = await this.quickSeoTemplateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  async createQuickSeoTemplate(data: Partial<QuickSeoTemplate>): Promise<QuickSeoTemplate> {
    return this.quickSeoTemplateRepo.save(this.quickSeoTemplateRepo.create(data));
  }

  async updateQuickSeoTemplate(id: string, data: Partial<QuickSeoTemplate>): Promise<QuickSeoTemplate> {
    const t = await this.quickSeoTemplateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    Object.assign(t, data);
    return this.quickSeoTemplateRepo.save(t);
  }

  async deleteQuickSeoTemplate(id: string): Promise<{ message: string }> {
    const t = await this.quickSeoTemplateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    await this.quickSeoTemplateRepo.remove(t);
    return { message: 'Template deleted' };
  }

  async applyQuickSeoTemplate(id: string, scope: {
    citySlug?: string;
    citySlugs?: string[];
    localitySlug?: string;
    localitySlugs?: string[];
    overwriteExisting?: boolean;
  }): Promise<{ created: number; updated: number; skipped: number; failed: number; total: number }> {
    const t = await this.getQuickSeoTemplate(id);
    const result = await this.quickSeoApply({
      categorySlug:    t.categorySlug,
      citySlug:        scope.citySlug,
      citySlugs:       scope.citySlugs,
      localitySlug:    scope.localitySlug,
      localitySlugs:   scope.localitySlugs,
      slugPattern:     t.slugPattern,
      citySlugPattern: t.citySlugPattern,
      includeCityPage: t.includeCityPage,
      showInFooter:    t.showInFooter,
      overwriteExisting: scope.overwriteExisting ?? false,
      template: {
        h1Title:         t.h1Title,
        metaTitle:       t.metaTitle,
        metaDescription: t.metaDescription,
        metaKeywords:    t.metaKeywords,
        canonicalUrl:    t.canonicalUrl,
        introContent:    t.introContent,
        bottomContent:   t.bottomContent,
        faqJson:         t.faqJson,
        robots:          t.robots,
      },
    });
    // Track usage
    await this.quickSeoTemplateRepo.update(id, {
      appliedCount: () => 'appliedCount + 1',
      lastAppliedAt: new Date(),
    });
    return result;
  }
}

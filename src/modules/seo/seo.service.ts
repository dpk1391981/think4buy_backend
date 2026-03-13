import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CityPage } from './entities/city-page.entity';
import { SeoConfig } from './entities/seo-config.entity';
import { FooterSeoLink, FooterSeoLinkGroup } from './entities/footer-seo-link.entity';

@Injectable()
export class SeoService {
  constructor(
    @InjectRepository(CityPage) private cityPageRepo: Repository<CityPage>,
    @InjectRepository(SeoConfig) private seoConfigRepo: Repository<SeoConfig>,
    @InjectRepository(FooterSeoLink) private footerLinkRepo: Repository<FooterSeoLink>,
    @InjectRepository(FooterSeoLinkGroup) private footerGroupRepo: Repository<FooterSeoLinkGroup>,
  ) {}

  // ── City Pages ──────────────────────────────────────────────────────────────

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

  // ── SEO Config ──────────────────────────────────────────────────────────────

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

  // ── Footer SEO Links ─────────────────────────────────────────────────────────

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

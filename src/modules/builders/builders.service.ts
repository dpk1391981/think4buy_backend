import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Property,
  PropertyStatus,
  ApprovalStatus,
} from '../properties/entities/property.entity';

export interface BuilderProject {
  id: string;
  title: string;
  slug: string;
  possessionStatus: string | null;
  isNewProject: boolean;
  price: number;
  priceUnit: string | null;
  locality: string;
  city: string;
  category: string;
}

export interface BuilderResponse {
  builderName: string;
  builderSlug: string;
  city: string;
  cities: string[];
  totalProjects: number;
  readyToMove: number;
  underConstruction: number;
  newProjects: number;
  topProjects: BuilderProject[];
}

@Injectable()
export class BuildersService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
  ) {}

  // ─── List top builders (optionally city-scoped) ────────────────────────────

  async getBuilders(city?: string, limit = 6): Promise<BuilderResponse[]> {
    // Step 1: aggregate builder stats
    const qb = this.propertyRepo
      .createQueryBuilder('p')
      .select('p.builderName', 'builderName')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN p.possessionStatus = 'ready_to_move' THEN 1 ELSE 0 END)",
        'ready',
      )
      .addSelect(
        "SUM(CASE WHEN p.possessionStatus = 'under_construction' THEN 1 ELSE 0 END)",
        'uc',
      )
      .addSelect(
        'SUM(CASE WHEN p.isNewProject = 1 THEN 1 ELSE 0 END)',
        'newProj',
      )
      .where('p.isDraft = :draft', { draft: false })
      .andWhere('p.status = :status', { status: PropertyStatus.ACTIVE })
      .andWhere('p.approvalStatus = :approval', { approval: ApprovalStatus.APPROVED })
      .andWhere('p.builderName IS NOT NULL')
      .andWhere("p.builderName != ''");

    if (city) {
      qb.andWhere('LOWER(p.city) = LOWER(:city)', { city });
    }

    const rows = await qb
      .groupBy('p.builderName')
      .orderBy('total', 'DESC')
      .limit(limit)
      .getRawMany();

    if (!rows.length) return [];

    // Step 2: for each builder, load top projects + city list in parallel
    const results = await Promise.all(
      rows.map(async (b) => {
        const whereBase: any = {
          builderName: b.builderName,
          isDraft: false,
          status: PropertyStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED,
        };

        // Top 5 projects for inline display
        const topProjects = await this.propertyRepo.find({
          where: city ? { ...whereBase, city } : whereBase,
          select: [
            'id', 'title', 'slug', 'possessionStatus', 'isNewProject',
            'price', 'priceUnit', 'locality', 'city', 'category',
          ],
          order: { listingScore: 'DESC', createdAt: 'DESC' },
          take: 5,
        });

        // All cities this builder has active listings in
        const cityRows = await this.propertyRepo
          .createQueryBuilder('p')
          .select('p.city', 'city')
          .addSelect('COUNT(*)', 'cnt')
          .where('p.builderName = :name', { name: b.builderName })
          .andWhere('p.isDraft = :draft', { draft: false })
          .andWhere('p.status = :status', { status: PropertyStatus.ACTIVE })
          .andWhere('p.approvalStatus = :approval', { approval: ApprovalStatus.APPROVED })
          .groupBy('p.city')
          .orderBy('cnt', 'DESC')
          .limit(5)
          .getRawMany();

        const cities: string[] = cityRows.map((c) => c.city).filter(Boolean);
        const primaryCity = city ?? cities[0] ?? '';
        const nameSlug = this.slugify(b.builderName);
        const builderSlug = city
          ? `${nameSlug}-in-${this.slugify(city)}`
          : nameSlug;

        return {
          builderName:      b.builderName as string,
          builderSlug,
          city:             primaryCity,
          cities,
          totalProjects:    parseInt(b.total,   10) || 0,
          readyToMove:      parseInt(b.ready,   10) || 0,
          underConstruction:parseInt(b.uc,      10) || 0,
          newProjects:      parseInt(b.newProj, 10) || 0,
          topProjects: topProjects.map((p) => ({
            id:               p.id,
            title:            p.title,
            slug:             p.slug,
            possessionStatus: p.possessionStatus ?? null,
            isNewProject:     p.isNewProject,
            price:            Number(p.price),
            priceUnit:        p.priceUnit ?? null,
            locality:         p.locality,
            city:             p.city,
            category:         p.category,
          })),
        } satisfies BuilderResponse;
      }),
    );

    return results;
  }

  // ─── Single builder detail (by slug, with paginated projects) ─────────────

  async getBuilderDetail(
    builderSlug: string,
    page = 1,
    limit = 12,
    status?: string,
    city?: string,
  ): Promise<{ builder: BuilderResponse | null; projects: BuilderProject[]; total: number }> {
    // Decode slug: "godrej-properties-in-noida" → name slug + city
    let nameSlug  = builderSlug;
    let cityHint  = city;
    const inMatch = builderSlug.match(/^(.+)-in-([a-z0-9-]+)$/);
    if (inMatch && !city) {
      nameSlug = inMatch[1];
      cityHint = inMatch[2].replace(/-/g, ' ');
    }

    // Resolve builder name from slug
    const nameRow = await this.propertyRepo
      .createQueryBuilder('p')
      .select('p.builderName', 'builderName')
      .where('p.builderName IS NOT NULL')
      .andWhere("p.builderName != ''")
      .andWhere('p.status = :status', { status: PropertyStatus.ACTIVE })
      .andWhere('p.approvalStatus = :approval', { approval: ApprovalStatus.APPROVED })
      .groupBy('p.builderName')
      .getRawMany();

    const matched = nameRow.find(
      (r) => this.slugify(r.builderName) === nameSlug,
    );
    if (!matched) return { builder: null, projects: [], total: 0 };

    const builderName = matched.builderName as string;

    // Get builder summary
    const [builderInfo] = await this.getBuilders(cityHint, 100);
    const builder = (await this.getBuilders(cityHint, 100)).find(
      (b) => b.builderName === builderName,
    ) ?? null;

    // Paginated projects with optional possession filter
    const whereBase: any = {
      builderName,
      isDraft: false,
      status: PropertyStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
    };
    if (cityHint) whereBase.city = cityHint;
    if (status)   whereBase.possessionStatus = status;

    const [projects, total] = await this.propertyRepo.findAndCount({
      where: whereBase,
      select: [
        'id', 'title', 'slug', 'possessionStatus', 'isNewProject',
        'price', 'priceUnit', 'locality', 'city', 'category',
      ],
      order: { listingScore: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      builder,
      projects: projects.map((p) => ({
        id:               p.id,
        title:            p.title,
        slug:             p.slug,
        possessionStatus: p.possessionStatus ?? null,
        isNewProject:     p.isNewProject,
        price:            Number(p.price),
        priceUnit:        p.priceUnit ?? null,
        locality:         p.locality,
        city:             p.city,
        category:         p.category,
      })),
      total,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private slugify(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
}

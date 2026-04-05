import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Property,
  PropertyStatus,
  ApprovalStatus,
} from '../properties/entities/property.entity';
import { PropertyImage } from '../properties/entities/property-image.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { SystemConfigService } from '../system-config/system-config.service';

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
  type: string;
  bedrooms: number | null;
  area: number | null;
  areaUnit: string | null;
  coverImage: string | null;
}

export interface BuilderResponse {
  builderId: string | null;
  builderName: string;
  builderSlug: string;
  builderLogo: string | null;
  builderVerified: boolean;
  builderReraNumber: string | null;
  builderWebsite: string | null;
  builderExperience: number | null;
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
    @InjectRepository(PropertyImage)
    private readonly imageRepo: Repository<PropertyImage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly systemConfig: SystemConfigService,
  ) {}

  // ─── List top builders (optionally city-scoped) ────────────────────────────

  async getBuilders(city?: string, limit = 6): Promise<BuilderResponse[]> {
    // Feature flag: hide section if disabled
    const showDevelopers = await this.systemConfig.getBoolean('SHOW_TOP_DEVELOPERS', true);
    if (!showDevelopers) return [];

    // Step 1: aggregate builder stats by builderName on properties
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

    // Step 2: Load matching builder User profiles for logo/verified/rera
    const builderNames: string[] = rows.map((r) => r.builderName as string);
    const builderUsers = await this.userRepo.find({
      where: { role: UserRole.BUILDER },
      select: [
        'id', 'builderCompanyName', 'builderLogo', 'builderVerified',
        'builderReraNumber', 'builderWebsite', 'builderExperience',
      ],
    });
    // Map by company name for O(1) lookup
    const userMap = new Map<string, User>();
    for (const u of builderUsers) {
      if (u.builderCompanyName) userMap.set(u.builderCompanyName, u);
    }

    // Step 3: for each builder, load top projects + city list in parallel
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
            'type', 'bedrooms', 'area', 'areaUnit',
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

        const builderUser = userMap.get(b.builderName as string);

        return {
          builderId:          builderUser?.id ?? null,
          builderName:        b.builderName as string,
          builderSlug,
          builderLogo:        builderUser?.builderLogo ?? null,
          builderVerified:    builderUser?.builderVerified ?? false,
          builderReraNumber:  builderUser?.builderReraNumber ?? null,
          builderWebsite:     builderUser?.builderWebsite ?? null,
          builderExperience:  builderUser?.builderExperience ?? null,
          city:             primaryCity,
          cities,
          totalProjects:    parseInt(b.total,   10) || 0,
          readyToMove:      parseInt(b.ready,   10) || 0,
          underConstruction:parseInt(b.uc,      10) || 0,
          newProjects:      parseInt(b.newProj, 10) || 0,
          topProjects: await this.attachCovers(topProjects),
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
        'type', 'bedrooms', 'area', 'areaUnit',
      ],
      order: { listingScore: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      builder,
      projects: await this.attachCovers(projects),
      total,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Bulk-fetch primary cover images for a list of properties. */
  private async attachCovers(props: Property[]): Promise<BuilderProject[]> {
    if (!props.length) return [];
    const ids = props.map((p) => p.id);
    const images = await this.imageRepo
      .createQueryBuilder('img')
      .select(['img.propertyId', 'img.url', 'img.thumbnailUrl', 'img.isPrimary', 'img.sortOrder'])
      .where('img.propertyId IN (:...ids)', { ids })
      .andWhere("img.mediaType = 'image'")
      .andWhere("img.processingStatus != 'failed'")
      .orderBy('img.isPrimary', 'DESC')
      .addOrderBy('img.sortOrder', 'ASC')
      .getMany();

    // Build a map: propertyId → first (primary) image url
    const coverMap = new Map<string, string>();
    for (const img of images) {
      if (!coverMap.has(img.propertyId)) {
        coverMap.set(img.propertyId, img.url);
      }
    }

    return props.map((p) => ({
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
      type:             p.type,
      bedrooms:         p.bedrooms ?? null,
      area:             p.area ? Number(p.area) : null,
      areaUnit:         p.areaUnit ?? null,
      coverImage:       coverMap.get(p.id) ?? null,
    }));
  }

  private slugify(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
}

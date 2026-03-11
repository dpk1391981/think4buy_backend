import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';
import {
  Property,
  PropertyStatus,
  PropertyCategory,
  ApprovalStatus,
} from './entities/property.entity';
import { PropertyImage } from './entities/property-image.entity';
import { Amenity } from './entities/amenity.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { FilterPropertyDto } from './dto/filter-property.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { WalletService } from '../wallet/wallet.service';
import { TransactionReason } from '../wallet/entities/wallet-transaction.entity';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertyRepo: Repository<Property>,
    @InjectRepository(PropertyImage)
    private imageRepo: Repository<PropertyImage>,
    @InjectRepository(Amenity)
    private amenityRepo: Repository<Amenity>,
    private walletService: WalletService,
  ) {}

  async create(dto: CreatePropertyDto, owner: User): Promise<Property> {
    // Agent quota enforcement
    if (owner.role === UserRole.AGENT) {
      if (owner.agentUsedQuota >= owner.agentFreeQuota) {
        throw new BadRequestException(
          `Free listing quota exhausted (${owner.agentFreeQuota} listings). Please upgrade to a paid plan.`,
        );
      }
      // Increment quota usage
      await this.propertyRepo.manager
        .getRepository(User)
        .increment({ id: owner.id }, 'agentUsedQuota', 1);
    }

    // Auto-generate title if not provided
    if (!dto.title || !dto.title.trim()) {
      const bedroomPrefix = dto.bedrooms ? `${dto.bedrooms} BHK ` : '';
      const typeMap: Record<string, string> = {
        apartment: 'Apartment', villa: 'Villa', house: 'Independent House',
        plot: 'Plot', studio: 'Studio', penthouse: 'Penthouse',
        commercial_office: 'Office Space', commercial_shop: 'Shop',
        commercial_warehouse: 'Warehouse', factory: 'Factory',
        land: 'Land', builder_floor: 'Builder Floor',
        farm_house: 'Farm House', showroom: 'Showroom',
        industrial_shed: 'Industrial Shed', pg: 'PG', co_living: 'Co-Living Space',
      };
      const categoryMap: Record<string, string> = {
        buy: 'for Sale', rent: 'for Rent', pg: 'for PG',
        commercial: '', industrial: 'for Rent', builder_project: 'Project',
        investment: 'for Investment',
      };
      const typeLabel = typeMap[dto.type] || dto.type;
      const catLabel = categoryMap[dto.category] || '';
      const location = dto.locality || dto.city || '';
      dto.title = `${bedroomPrefix}${typeLabel} ${catLabel} in ${location}`.trim();
    }

    const baseSlug = slugify(`${dto.title}-${dto.city}-${dto.locality}`, {
      lower: true,
      strict: true,
    });
    const slug = `${baseSlug}-${uuidv4().slice(0, 8)}`;

    let amenities: Amenity[] = [];
    if (dto.amenityIds?.length) {
      amenities = await this.amenityRepo.findByIds(dto.amenityIds);
    }

    const property = this.propertyRepo.create({
      ...dto,
      slug,
      owner,
      ownerId: owner.id,
      amenities,
      approvalStatus: ApprovalStatus.PENDING,
      metaTitle: `${dto.title} | ${dto.city}`,
      metaDescription: dto.description?.substring(0, 160),
    });

    return this.propertyRepo.save(property);
  }

  async findAll(filters: FilterPropertyDto) {
    const {
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const qb = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.images', 'images')
      .leftJoinAndSelect('property.amenities', 'amenities')
      .leftJoinAndSelect('property.owner', 'owner')
      .where('property.status = :status', { status: PropertyStatus.ACTIVE })
      .andWhere('property.approvalStatus = :approvalStatus', { approvalStatus: ApprovalStatus.APPROVED });

    this.applyFilters(qb, filters);

    const allowedSort = ['createdAt', 'price', 'area', 'viewCount'];
    const safeSort = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`property.${safeSort}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findFeatured(limit = 8): Promise<Property[]> {
    return this.propertyRepo.find({
      where: { isFeatured: true, status: PropertyStatus.ACTIVE },
      relations: ['images'],
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async findBySlug(slug: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { slug },
      relations: ['images', 'amenities', 'owner'],
    });
    if (!property) throw new NotFoundException('Property not found');

    // Increment view count
    await this.propertyRepo.increment({ id: property.id }, 'viewCount', 1);
    property.viewCount += 1;
    return property;
  }

  async findById(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: ['images', 'amenities', 'owner'],
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async update(id: string, dto: Partial<CreatePropertyDto>, user: User): Promise<Property> {
    const property = await this.findById(id);
    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only edit your own properties');
    }

    if (dto.amenityIds) {
      property.amenities = await this.amenityRepo.findByIds(dto.amenityIds);
    }

    Object.assign(property, dto);
    return this.propertyRepo.save(property);
  }

  async remove(id: string, user: User): Promise<void> {
    const property = await this.findById(id);
    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own properties');
    }
    await this.propertyRepo.remove(property);
  }

  async addImages(propertyId: string, files: Express.Multer.File[], user: User) {
    const property = await this.findById(propertyId);
    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }

    const images = files.map((file, index) =>
      this.imageRepo.create({
        url: `/uploads/${file.filename}`,
        propertyId,
        isPrimary: index === 0 && property.images.length === 0,
        sortOrder: property.images.length + index,
        alt: property.title,
      }),
    );

    return this.imageRepo.save(images);
  }

  async getStats() {
    const [total, forSale, forRent, forPG] = await Promise.all([
      this.propertyRepo.count({ where: { status: PropertyStatus.ACTIVE } }),
      this.propertyRepo.count({ where: { status: PropertyStatus.ACTIVE, category: PropertyCategory.BUY } }),
      this.propertyRepo.count({ where: { status: PropertyStatus.ACTIVE, category: PropertyCategory.RENT } }),
      this.propertyRepo.count({ where: { status: PropertyStatus.ACTIVE, category: PropertyCategory.PG } }),
    ]);
    return { total, forSale, forRent, forPG };
  }

  async getCitiesWithCount() {
    return this.propertyRepo
      .createQueryBuilder('property')
      .select('property.city', 'city')
      .addSelect('COUNT(*)', 'count')
      .where('property.status = :status', { status: PropertyStatus.ACTIVE })
      .groupBy('property.city')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();
  }

  async getSimilarProperties(property: Property, limit = 4): Promise<Property[]> {
    return this.propertyRepo.find({
      where: {
        city: property.city,
        category: property.category,
        status: PropertyStatus.ACTIVE,
      },
      relations: ['images'],
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async getAmenities(): Promise<Amenity[]> {
    return this.amenityRepo.find();
  }

  async findMyListings(
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      status?: PropertyStatus;
      approvalStatus?: ApprovalStatus;
    },
  ) {
    const { page = 1, limit = 12, status, approvalStatus } = filters;

    const qb = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.images', 'images')
      .where('property.ownerId = :userId', { userId })
      .orderBy('property.createdAt', 'DESC');

    if (status) {
      qb.andWhere('property.status = :status', { status });
    }
    if (approvalStatus) {
      qb.andWhere('property.approvalStatus = :approvalStatus', { approvalStatus });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((+page - 1) * +limit)
      .take(+limit)
      .getMany();

    return {
      data: items,
      meta: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / +limit),
      },
    };
  }

  async boostProperty(
    propertyId: string,
    boostPlanId: string,
    user: User,
  ): Promise<Property> {
    const property = await this.findById(propertyId);

    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only boost your own properties');
    }

    const boostPlan = await this.walletService.getBoostPlanById(boostPlanId);

    // Deduct tokens from wallet
    await this.walletService.debit(
      user.id,
      boostPlan.tokenCost,
      TransactionReason.BOOST_PROPERTY,
      `Boosted property "${property.title}" for ${boostPlan.durationDays} days`,
      property.id,
      'property',
    );

    // Calculate boost expiry: extend from current expiry if still active, else from now
    const now = new Date();
    const currentExpiry =
      property.boostExpiresAt && property.boostExpiresAt > now
        ? property.boostExpiresAt
        : now;

    const boostExpiresAt = new Date(currentExpiry);
    boostExpiresAt.setDate(boostExpiresAt.getDate() + boostPlan.durationDays);

    property.boostExpiresAt = boostExpiresAt;
    property.isFeatured = true;

    return this.propertyRepo.save(property);
  }

  private applyFilters(qb: SelectQueryBuilder<Property>, filters: FilterPropertyDto) {
    if (filters.category) {
      qb.andWhere('property.category = :category', { category: filters.category });
    }
    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      qb.andWhere('property.type IN (:...types)', { types });
    }
    if (filters.city) {
      qb.andWhere('LOWER(property.city) = LOWER(:city)', { city: filters.city });
    }
    if (filters.locality) {
      qb.andWhere('LOWER(property.locality) LIKE LOWER(:locality)', {
        locality: `%${filters.locality}%`,
      });
    }
    if (filters.pincode) {
      qb.andWhere('property.pincode = :pincode', { pincode: filters.pincode });
    }
    if (filters.minPrice) {
      qb.andWhere('property.price >= :minPrice', { minPrice: filters.minPrice });
    }
    if (filters.maxPrice) {
      qb.andWhere('property.price <= :maxPrice', { maxPrice: filters.maxPrice });
    }
    if (filters.minArea) {
      qb.andWhere('property.area >= :minArea', { minArea: filters.minArea });
    }
    if (filters.maxArea) {
      qb.andWhere('property.area <= :maxArea', { maxArea: filters.maxArea });
    }
    if (filters.bedrooms) {
      const beds = filters.bedrooms.split(',').map((b) => parseInt(b));
      const hasPlus = filters.bedrooms.includes('+');
      if (hasPlus) {
        const maxBed = Math.max(...beds.filter((b) => !isNaN(b)));
        qb.andWhere('property.bedrooms >= :minBed', { minBed: maxBed });
      } else {
        qb.andWhere('property.bedrooms IN (:...beds)', { beds });
      }
    }
    if (filters.furnishingStatus) {
      qb.andWhere('property.furnishingStatus = :furnishingStatus', {
        furnishingStatus: filters.furnishingStatus,
      });
    }
    if (filters.possessionStatus) {
      qb.andWhere('property.possessionStatus = :possessionStatus', {
        possessionStatus: filters.possessionStatus,
      });
    }
    if (filters.isFeatured !== undefined) {
      qb.andWhere('property.isFeatured = :isFeatured', {
        isFeatured: filters.isFeatured,
      });
    }
    if (filters.isVerified !== undefined) {
      qb.andWhere('property.isVerified = :isVerified', {
        isVerified: filters.isVerified,
      });
    }
    if (filters.search) {
      qb.andWhere(
        '(property.title LIKE :search OR property.locality LIKE :search OR property.society LIKE :search OR property.city LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    if (filters.agentId) {
      qb.andWhere('property.ownerId = :agentId', { agentId: filters.agentId });
    }

    // State filter — prefer stateId FK match, fallback to string match
    if ((filters as any).stateId) {
      qb.andWhere('property.stateId = :stateId', { stateId: (filters as any).stateId });
    } else if ((filters as any).state) {
      qb.andWhere('LOWER(property.state) = LOWER(:state)', { state: (filters as any).state });
    }

    // City filter — prefer cityId FK match
    if ((filters as any).cityId) {
      qb.andWhere('property.cityId = :cityId', { cityId: (filters as any).cityId });
    }
  }
}

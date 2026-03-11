import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inquiry } from './entities/inquiry.entity';
import { Property } from '../properties/entities/property.entity';

export class CreateInquiryDto {
  name: string;
  email: string;
  phone: string;
  message?: string;
  type?: string;
}

@Injectable()
export class InquiriesService {
  constructor(
    @InjectRepository(Inquiry)
    private inquiryRepo: Repository<Inquiry>,
    @InjectRepository(Property)
    private propertyRepo: Repository<Property>,
  ) {}

  async create(propertyId: string, dto: CreateInquiryDto, userId?: string) {
    const property = await this.propertyRepo.findOne({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');

    const inquiry = this.inquiryRepo.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      message: dto.message,
      type: (dto.type as any) ?? 'general',
      propertyId,
      userId,
    } as any);
    return this.inquiryRepo.save(inquiry);
  }

  async findByProperty(propertyId: string) {
    return this.inquiryRepo.find({
      where: { propertyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByOwner(ownerId: string) {
    return this.inquiryRepo
      .createQueryBuilder('inquiry')
      .innerJoin('inquiry.property', 'property')
      .where('property.ownerId = :ownerId', { ownerId })
      .leftJoinAndSelect('inquiry.property', 'prop')
      .orderBy('inquiry.createdAt', 'DESC')
      .getMany();
  }

  async findByOwnerPaginated(ownerId: string, page = 1, limit = 20) {
    const qb = this.inquiryRepo
      .createQueryBuilder('inquiry')
      .innerJoin('inquiry.property', 'property')
      .where('property.ownerId = :ownerId', { ownerId })
      .leftJoinAndSelect('inquiry.property', 'prop')
      .orderBy('inquiry.createdAt', 'DESC');

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
}

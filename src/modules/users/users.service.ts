import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async getUserListings(userId: string) {
    return this.userRepo.findOne({
      where: { id: userId },
      relations: ['properties', 'properties.images'],
    });
  }

  async getAgents(
    page = 1,
    limit = 12,
    filters: { city?: string; cityId?: string; state?: string; stateId?: string; locality?: string; search?: string } = {},
  ): Promise<{ agents: Partial<User>[]; total: number }> {
    const qb = this.userRepo.createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.AGENT })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .select([
        'user.id', 'user.name', 'user.email', 'user.phone',
        'user.avatar', 'user.city', 'user.state', 'user.stateId', 'user.cityId', 'user.company',
        'user.agentLicense', 'user.agentBio', 'user.agentExperience',
        'user.agentRating', 'user.totalDeals', 'user.agentTick',
      ]);

    // Prefer FK-based city filter, fallback to name match
    if (filters.cityId) {
      qb.andWhere('user.cityId = :cityId', { cityId: filters.cityId });
    } else if (filters.city) {
      qb.andWhere('LOWER(user.city) LIKE LOWER(:city)', { city: `%${filters.city}%` });
    }
    // Prefer FK-based state filter, fallback to name match
    if (filters.stateId) {
      qb.andWhere('user.stateId = :stateId', { stateId: filters.stateId });
    } else if (filters.state) {
      qb.andWhere('LOWER(user.state) LIKE LOWER(:state)', { state: `%${filters.state}%` });
    }
    if (filters.search) {
      qb.andWhere(
        '(LOWER(user.name) LIKE LOWER(:q) OR LOWER(user.company) LIKE LOWER(:q) OR LOWER(user.city) LIKE LOWER(:q))',
        { q: `%${filters.search}%` },
      );
    }

    qb.orderBy('user.agentTick', 'DESC')
      .addOrderBy('user.agentRating', 'DESC')
      .addOrderBy('user.totalDeals', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [agents, total] = await qb.getManyAndCount();
    return { agents, total };
  }
}

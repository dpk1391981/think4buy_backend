import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { Property, ApprovalStatus, PropertyStatus } from '../properties/entities/property.entity';
import { Inquiry } from '../inquiries/entities/inquiry.entity';
import { CreateAgentDto, UpdateAgentDto, UpdateAgentQuotaDto } from './dto/admin.dto';
import { WalletService } from '../wallet/wallet.service';
import { TransactionReason } from '../wallet/entities/wallet-transaction.entity';
import { LocationsService } from '../locations/locations.service';
import { SubscriptionPlan } from '../wallet/entities/subscription-plan.entity';
import { BoostPlan } from '../wallet/entities/boost-plan.entity';
import { State } from '../locations/entities/state.entity';
import { City } from '../locations/entities/city.entity';
import { Country } from '../locations/entities/country.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Property) private propertyRepo: Repository<Property>,
    @InjectRepository(Inquiry) private inquiryRepo: Repository<Inquiry>,
    @InjectRepository(Country) private countryRepo: Repository<Country>,
    private walletService: WalletService,
    private locationsService: LocationsService,
  ) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalAgents,
      totalProperties,
      pendingProperties,
      approvedProperties,
      rejectedProperties,
      totalInquiries,
      featuredProperties,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { role: UserRole.AGENT } }),
      this.propertyRepo.count(),
      this.propertyRepo.count({ where: { approvalStatus: ApprovalStatus.PENDING } }),
      this.propertyRepo.count({ where: { approvalStatus: ApprovalStatus.APPROVED } }),
      this.propertyRepo.count({ where: { approvalStatus: ApprovalStatus.REJECTED } }),
      this.inquiryRepo.count(),
      this.propertyRepo.count({ where: { isFeatured: true, approvalStatus: ApprovalStatus.APPROVED } }),
    ]);

    return {
      totalUsers,
      totalAgents,
      totalProperties,
      pendingProperties,
      approvedProperties,
      rejectedProperties,
      totalInquiries,
      featuredProperties,
    };
  }

  async getProperties(filters: {
    approvalStatus?: ApprovalStatus;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { approvalStatus, page = 1, limit = 20, search } = filters;

    const qb = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.owner', 'owner')
      .leftJoinAndSelect('property.images', 'images')
      .orderBy('property.createdAt', 'DESC');

    if (approvalStatus) {
      qb.andWhere('property.approvalStatus = :approvalStatus', { approvalStatus });
    }
    if (search) {
      qb.andWhere(
        '(property.title LIKE :search OR property.city LIKE :search OR property.locality LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async approveProperty(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!property) throw new NotFoundException('Property not found');

    const wasAlreadyApproved = property.approvalStatus === ApprovalStatus.APPROVED;

    property.approvalStatus = ApprovalStatus.APPROVED;
    property.status = PropertyStatus.ACTIVE;
    property.rejectionReason = null;
    const saved = await this.propertyRepo.save(property);

    // Consume listing quota on first approval (agent role)
    if (!wasAlreadyApproved && property.owner?.role === UserRole.AGENT) {
      await this.userRepo.increment({ id: property.owner.id }, 'agentUsedQuota', 1);
    }

    return saved;
  }

  async rejectProperty(id: string, reason?: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!property) throw new NotFoundException('Property not found');

    const wasApproved = property.approvalStatus === ApprovalStatus.APPROVED;

    property.approvalStatus = ApprovalStatus.REJECTED;
    property.status = PropertyStatus.INACTIVE;
    property.rejectionReason = reason || null;
    const saved = await this.propertyRepo.save(property);

    // Release quota if property was previously approved
    if (wasApproved && property.owner?.role === UserRole.AGENT) {
      await this.userRepo.decrement({ id: property.owner.id }, 'agentUsedQuota', 1);
    }

    return saved;
  }

  async getAgents(page = 1, limit = 20, search?: string) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.AGENT })
      .orderBy('user.createdAt', 'DESC');

    if (search) {
      qb.andWhere(
        '(user.name LIKE :search OR user.email LIKE :search OR user.company LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();
    const users = await qb.skip((page - 1) * limit).take(limit).getMany();

    // Enrich with agency info from agent_profiles + agencies
    if (users.length > 0) {
      const userIds = users.map((u) => u.id);
      const profiles: any[] = await this.userRepo.manager.query(
        `SELECT ap.userId, ap.id AS profileId, ap.agencyId,
                ag.name AS agencyName
         FROM agent_profiles ap
         LEFT JOIN agencies ag ON ag.id = ap.agencyId
         WHERE ap.userId IN (${userIds.map(() => '?').join(',')})`,
        userIds,
      );
      const profileMap = Object.fromEntries(profiles.map((p) => [p.userId, p]));
      const items = users.map((u) => ({
        ...u,
        profileId:  profileMap[u.id]?.profileId  ?? null,
        agencyId:   profileMap[u.id]?.agencyId   ?? null,
        agencyName: profileMap[u.id]?.agencyName ?? null,
      }));
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    return { items: users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createAgent(dto: CreateAgentDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);
    const agent = this.userRepo.create({
      ...dto,
      password: hashed,
      role: UserRole.AGENT,
      isVerified: true,
      agentFreeQuota: dto.agentFreeQuota ?? 100,
    });

    return this.userRepo.save(agent);
  }

  async getAgentById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.AGENT } });
    if (!user) throw new NotFoundException('Agent not found');
    return user;
  }

  async updateAgent(id: string, dto: UpdateAgentDto): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.AGENT } });
    if (!user) throw new NotFoundException('Agent not found');

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepo.findOne({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Email already in use');
    }

    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async updateAgentQuota(id: string, dto: UpdateAgentQuotaDto): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.AGENT } });
    if (!user) throw new NotFoundException('Agent not found');

    user.agentFreeQuota = dto.agentFreeQuota;
    return this.userRepo.save(user);
  }

  async toggleAgentStatus(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.AGENT } });
    if (!user) throw new NotFoundException('Agent not found');

    user.isActive = !user.isActive;
    return this.userRepo.save(user);
  }

  // ── Wallet Management ───────────────────────────────────────────────────────

  async getAllWallets(page = 1, limit = 20, search?: string) {
    return this.walletService.getAllWallets(page, limit, search);
  }

  async topUpWallet(userId: string, amount: number, description?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.walletService.adminTopUp(userId, amount, description);
  }

  async deductFromWallet(userId: string, amount: number, description?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.walletService.adminDeduct(userId, amount, description);
  }

  async getAllTransactions(page = 1, limit = 20) {
    return this.walletService.getAllTransactions(page, limit);
  }

  // ── Subscription Plans ──────────────────────────────────────────────────────

  async getSubscriptionPlans() {
    return this.walletService.getSubscriptionPlans();
  }

  async createSubscriptionPlan(data: Partial<SubscriptionPlan>) {
    return this.walletService.createSubscriptionPlan(data);
  }

  async updateSubscriptionPlan(id: string, data: Partial<SubscriptionPlan>) {
    return this.walletService.updateSubscriptionPlan(id, data);
  }

  async deleteSubscriptionPlan(id: string) {
    return this.walletService.deleteSubscriptionPlan(id);
  }

  // ── Boost Plans ─────────────────────────────────────────────────────────────

  async getBoostPlans() {
    return this.walletService.getBoostPlans();
  }

  async createBoostPlan(data: Partial<BoostPlan>) {
    return this.walletService.createBoostPlan(data);
  }

  async updateBoostPlan(id: string, data: Partial<BoostPlan>) {
    return this.walletService.updateBoostPlan(id, data);
  }

  async deleteBoostPlan(id: string) {
    return this.walletService.deleteBoostPlan(id);
  }

  // ── States ──────────────────────────────────────────────────────────────────

  async getStates() {
    return this.locationsService.getStates(false);
  }

  async createState(data: { name: string; code: string; isActive?: boolean }) {
    return this.locationsService.createState(data);
  }

  async updateState(id: string, data: Partial<State>) {
    return this.locationsService.updateState(id, data);
  }

  async deleteState(id: string) {
    return this.locationsService.deleteState(id);
  }

  // ── Cities ──────────────────────────────────────────────────────────────────

  async getAllCities(page = 1, limit = 50, search?: string, stateId?: string) {
    return this.locationsService.getAllCities(page, limit, search, stateId);
  }

  async createCity(data: {
    name: string;
    stateId: string;
    isActive?: boolean;
    isFeatured?: boolean;
    imageUrl?: string;
  }) {
    return this.locationsService.createCity(data);
  }

  async updateCity(id: string, data: Partial<City>) {
    return this.locationsService.updateCity(id, data);
  }

  async deleteCity(id: string) {
    return this.locationsService.deleteCity(id);
  }

  // ── Countries ────────────────────────────────────────────────────────────────

  async getCountries() {
    return this.countryRepo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async createCountry(data: Partial<Country>): Promise<Country> {
    const existing = await this.countryRepo.findOne({ where: { code: data.code } });
    if (existing) throw new ConflictException('Country code already exists');
    return this.countryRepo.save(this.countryRepo.create(data));
  }

  async updateCountry(id: string, data: Partial<Country>): Promise<Country> {
    const country = await this.countryRepo.findOne({ where: { id } });
    if (!country) throw new NotFoundException('Country not found');
    Object.assign(country, data);
    return this.countryRepo.save(country);
  }

  async deleteCountry(id: string): Promise<{ message: string }> {
    const country = await this.countryRepo.findOne({ where: { id } });
    if (!country) throw new NotFoundException('Country not found');
    await this.countryRepo.remove(country);
    return { message: 'Country deleted' };
  }

  // ── Property Full CRUD ───────────────────────────────────────────────────────

  async updateProperty(id: string, data: Partial<Property>): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    Object.assign(property, data);
    return this.propertyRepo.save(property);
  }

  async deleteProperty(id: string): Promise<{ message: string }> {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    await this.propertyRepo.remove(property);
    return { message: 'Property deleted successfully' };
  }

  async togglePropertyStatus(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    property.status = property.status === PropertyStatus.ACTIVE
      ? PropertyStatus.INACTIVE
      : PropertyStatus.ACTIVE;
    return this.propertyRepo.save(property);
  }

  async togglePropertyFeatured(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    property.isFeatured = !property.isFeatured;
    return this.propertyRepo.save(property);
  }

  async updatePropertySeo(id: string, data: { slug?: string; metaTitle?: string; metaDescription?: string }): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');

    if (data.slug && data.slug !== property.slug) {
      const existing = await this.propertyRepo.findOne({ where: { slug: data.slug } });
      if (existing) throw new ConflictException('Slug already in use by another property');
      property.slug = data.slug;
    }
    if (data.metaTitle !== undefined) (property as any).metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) (property as any).metaDescription = data.metaDescription;

    return this.propertyRepo.save(property);
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { Property, ApprovalStatus, PropertyStatus } from '../properties/entities/property.entity';
import { PropertyStatusHistory } from '../properties/entities/property-status-history.entity';
import { Inquiry } from '../inquiries/entities/inquiry.entity';
import { CreateAgentDto, UpdateAgentDto, UpdateAgentQuotaDto, CreateBuilderDto, UpdateBuilderDto } from './dto/admin.dto';
import { WalletService } from '../wallet/wallet.service';
import { TransactionReason } from '../wallet/entities/wallet-transaction.entity';
import { LocationsService } from '../locations/locations.service';
import { SubscriptionPlan } from '../wallet/entities/subscription-plan.entity';
import { BoostPlan } from '../wallet/entities/boost-plan.entity';
import { State } from '../locations/entities/state.entity';
import { City } from '../locations/entities/city.entity';
import { Country } from '../locations/entities/country.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Property) private propertyRepo: Repository<Property>,
    @InjectRepository(PropertyStatusHistory) private statusHistoryRepo: Repository<PropertyStatusHistory>,
    @InjectRepository(Inquiry) private inquiryRepo: Repository<Inquiry>,
    @InjectRepository(Country) private countryRepo: Repository<Country>,
    private walletService: WalletService,
    private locationsService: LocationsService,
    private readonly notificationsService: NotificationsService,
    private readonly alertsService: AlertsService,
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
    isDraft?: boolean;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { approvalStatus, isDraft, page = 1, limit = 20, search } = filters;

    const qb = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.owner', 'owner')
      .leftJoinAndSelect('property.images', 'images')
      .orderBy('property.createdAt', 'DESC');

    if (isDraft === true) {
      // Drafts tab: ONLY properties still in draft state
      qb.where('property.isDraft = true');
    } else if (approvalStatus) {
      // Pending / Approved / Rejected tabs: never include drafts
      qb.where('property.approvalStatus = :approvalStatus', { approvalStatus })
        .andWhere('property.isDraft = false');
    } else {
      // "All" tab: exclude drafts
      qb.where('property.isDraft = false');
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

  async approveProperty(id: string, adminUserId?: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!property) throw new NotFoundException('Property not found');

    const wasAlreadyApproved = property.approvalStatus === ApprovalStatus.APPROVED;
    const oldStatus = property.status;

    property.approvalStatus = ApprovalStatus.APPROVED;
    property.status = PropertyStatus.ACTIVE;
    property.rejectionReason = null;
    const saved = await this.propertyRepo.save(property);

    // Track status history
    await this.statusHistoryRepo.save(
      this.statusHistoryRepo.create({
        propertyId: id,
        oldStatus: oldStatus,
        newStatus: PropertyStatus.ACTIVE,
        updatedBy: adminUserId ?? null,
        updatedByRole: 'admin',
        note: 'Approved by admin',
      }),
    );
    this.logger.log(`Property ${id} approved → active by admin ${adminUserId ?? 'unknown'}`);

    // Consume subscription listing quota on first approval (all listing roles)
    if (!wasAlreadyApproved && property.owner?.id) {
      await this.walletService.incrementSubscriptionUsage(property.owner.id);
    }

    if (saved.owner?.id) {
      this.notificationsService.createSilent({
        userId: saved.owner.id,
        role: saved.owner.role,
        title: 'Property Approved',
        message: `Your property "${saved.title}" has been approved and is now live.`,
        type: NotificationType.PROPERTY,
        entityType: 'property',
        entityId: saved.id,
      });
    }

    // Notify buyers whose property alerts match this newly approved property
    if (!wasAlreadyApproved) {
      this.alertsService.checkAlertsForProperty({
        id: saved.id,
        title: saved.title,
        city: (saved as any).city,
        locality: (saved as any).locality,
        category: (saved as any).category,
        price: (saved as any).price,
      });
    }

    return saved;
  }

  async rejectProperty(id: string, reason?: string, adminUserId?: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!property) throw new NotFoundException('Property not found');

    const wasApproved = property.approvalStatus === ApprovalStatus.APPROVED;
    const oldStatus = property.status;

    property.approvalStatus = ApprovalStatus.REJECTED;
    property.status = PropertyStatus.INACTIVE;
    property.rejectionReason = reason || null;
    const saved = await this.propertyRepo.save(property);

    // Track status history
    await this.statusHistoryRepo.save(
      this.statusHistoryRepo.create({
        propertyId: id,
        oldStatus: oldStatus,
        newStatus: PropertyStatus.INACTIVE,
        updatedBy: adminUserId ?? null,
        updatedByRole: 'admin',
        note: reason ? `Rejected: ${reason}` : 'Rejected by admin',
      }),
    );
    this.logger.log(`Property ${id} rejected → inactive by admin ${adminUserId ?? 'unknown'}${reason ? ': ' + reason : ''}`);

    // Release quota if property was previously approved
    if (wasApproved && property.owner?.role === UserRole.AGENT) {
      await this.userRepo.decrement({ id: property.owner.id }, 'agentUsedQuota', 1);
    }

    if (saved.owner?.id) {
      this.notificationsService.createSilent({
        userId: saved.owner.id,
        role: saved.owner.role,
        title: 'Property Rejected',
        message: `Your property "${saved.title}" was rejected${reason ? ': ' + reason : '.'} Please review and resubmit.`,
        type: NotificationType.PROPERTY,
        entityType: 'property',
        entityId: saved.id,
      });
    }

    return saved;
  }

  async reactivateProperty(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id }, relations: ['owner'] });
    if (!property) throw new NotFoundException('Property not found');

    property.approvalStatus = ApprovalStatus.PENDING;
    property.status = PropertyStatus.INACTIVE;
    property.isDraft = false;
    property.rejectionReason = null;
    const saved = await this.propertyRepo.save(property);

    if (saved.owner?.id) {
      this.notificationsService.createSilent({
        userId: saved.owner.id,
        role: saved.owner.role,
        title: 'Property Resubmitted for Review',
        message: `Your property "${saved.title}" has been requeued for admin review.`,
        type: NotificationType.PROPERTY,
        entityType: 'property',
        entityId: saved.id,
      });
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

  async adminSaveAgentDocument(agentId: string, docType: string, fileUrl: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: agentId } });
    if (!user) throw new NotFoundException('Agent not found');
    let meta: Record<string, string> = {};
    if (user.agentBio?.startsWith('__meta__:')) {
      try { meta = JSON.parse(user.agentBio.slice(9)); } catch {}
    }
    const key = `doc${docType.charAt(0).toUpperCase()}${docType.slice(1)}`;
    meta[key] = fileUrl;
    await this.userRepo.update(agentId, { agentBio: `__meta__:${JSON.stringify(meta)}` });
    return this.userRepo.findOne({ where: { id: agentId } }) as Promise<User>;
  }

  /** Badge → subscription plan type mapping */
  private static readonly BADGE_PLAN_MAP: Record<string, string> = {
    none:     'free',
    verified: 'basic',
    bronze:   'premium',
    silver:   'featured',
    gold:     'enterprise',
  };

  async updateAgent(id: string, dto: UpdateAgentDto): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.AGENT } });
    if (!user) throw new NotFoundException('Agent not found');

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepo.findOne({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Email already in use');
    }

    const badgeChanged = dto.agentTick !== undefined && dto.agentTick !== user.agentTick;

    Object.assign(user, dto);
    await this.userRepo.save(user);

    // Auto-assign matching subscription plan when badge changes (including downgrade to none → free)
    if (badgeChanged && dto.agentTick !== undefined) {
      const targetPlanType = AdminService.BADGE_PLAN_MAP[dto.agentTick];
      if (targetPlanType) {
        const plan = await this.walletService.getPlanByType(targetPlanType);
        if (plan) {
          await this.walletService.adminAssignPlan(id, plan.id);
        }
      }
    }

    return this.userRepo.findOne({ where: { id } }) as Promise<User>;
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

  // ── Avatar Approval (all roles) ──────────────────────────────────────────────

  async getPendingAvatarAgents(page = 1, limit = 20) {
    // Returns ALL users with a pending avatar — not just agents
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.pendingAvatar IS NOT NULL')
      .andWhere("user.pendingAvatar != ''")
      .orderBy('user.updatedAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit)
      .select(['user.id', 'user.name', 'user.role', 'user.email', 'user.phone', 'user.city', 'user.avatar', 'user.pendingAvatar', 'user.agentProfileStatus', 'user.updatedAt'])
      .getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async approveAgentAvatar(id: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.pendingAvatar) throw new NotFoundException('No pending avatar to approve');

    await this.userRepo.update(id, { avatar: user.pendingAvatar, pendingAvatar: null });
    return { message: 'Avatar approved and set as profile image' };
  }

  async rejectAgentAvatar(id: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.userRepo.update(id, { pendingAvatar: null });
    return { message: 'Pending avatar rejected and removed' };
  }

  async getPendingProfessionalAgents(page = 1, limit = 20) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.AGENT })
      .andWhere('user.agentProfileStatus = :status', { status: 'pending' })
      .orderBy('user.updatedAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit)
      .select([
        'user.id', 'user.name', 'user.email', 'user.phone', 'user.city',
        'user.company', 'user.avatar', 'user.agentLicense', 'user.agentGstNumber',
        'user.agentBio', 'user.agentExperience', 'user.agentProfileStatus',
        'user.agentTick', 'user.updatedAt',
      ])
      .getMany();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Approve an agent's professional details, optionally setting a badge tier.
   * When badge is provided, the subscription plan is auto-assigned (BADGE_PLAN_MAP).
   */
  async approveProfessionalDetails(
    id: string,
    badge?: 'none' | 'verified' | 'bronze' | 'silver' | 'gold',
  ): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.AGENT } });
    if (!user) throw new NotFoundException('Agent not found');

    const update: any = { agentProfileStatus: 'approved' };

    if (badge && badge !== user.agentTick) {
      update.agentTick = badge;
      // Sync subscription plan to badge tier
      const targetPlanType = AdminService.BADGE_PLAN_MAP[badge];
      if (targetPlanType) {
        const plan = await this.walletService.getPlanByType(targetPlanType);
        if (plan) await this.walletService.adminAssignPlan(id, plan.id);
      }
    }

    await this.userRepo.update(id, update);
    return { message: `Professional details approved${badge ? ` with ${badge} badge` : ''}` };
  }

  async rejectProfessionalDetails(
    id: string,
    reason?: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.AGENT } });
    if (!user) throw new NotFoundException('Agent not found');
    // Reset to 'none' so agent can re-submit; store rejection note in agentBio if provided
    const update: any = { agentProfileStatus: 'none' };
    if (reason?.trim()) {
      // Preserve existing meta, append rejection note
      let meta: Record<string, string> = {};
      if (user.agentBio?.startsWith('__meta__:')) {
        try { meta = JSON.parse(user.agentBio.slice(9)); } catch {}
      }
      meta.rejectionReason = reason.trim();
      update.agentBio = `__meta__:${JSON.stringify(meta)}`;
    }
    await this.userRepo.update(id, update);
    return { message: 'Professional details rejected' };
  }

  async setAgentProfileInactive(id: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.AGENT } });
    if (!user) throw new NotFoundException('Agent not found');
    await this.userRepo.update(id, { agentProfileStatus: 'inactive' } as any);
    return { message: 'Agent professional profile set to inactive' };
  }

  // ── Wallet Management ───────────────────────────────────────────────────────

  async getAllWallets(page = 1, limit = 20, search?: string, role?: string) {
    return this.walletService.getAllWallets(page, limit, search, role);
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

  /** Admin view — includes inactive plans */
  async getSubscriptionPlans() {
    return this.walletService.getAllSubscriptionPlans();
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

  async getAllUserSubscriptions(page = 1, limit = 20, search?: string) {
    return this.walletService.getAllSubscriptions(page, limit, search);
  }

  async adminAssignPlan(userId: string, planId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.walletService.adminAssignPlan(userId, planId);
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

  // ── Localities ────────────────────────────────────────────────────────────────

  async getLocalities(params: { page?: number; limit?: number; city?: string; state?: string; search?: string }) {
    return this.locationsService.getLocalities(params);
  }

  async createLocality(data: { city: string; state: string; locality?: string; pincode?: string; latitude?: number; longitude?: number }) {
    return this.locationsService.createLocality(data);
  }

  async updateLocality(id: string, data: any) {
    return this.locationsService.updateLocality(id, data);
  }

  async deleteLocality(id: string) {
    return this.locationsService.deleteLocality(id);
  }

  async bulkImportLocalities(rows: { city: string; state: string; locality?: string; pincode?: string }[]) {
    return this.locationsService.bulkImportLocalities(rows);
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

  async togglePropertyPremium(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    property.isPremium = !property.isPremium;
    return this.propertyRepo.save(property);
  }

  async updatePropertySeo(id: string, data: { slug?: string; metaTitle?: string; metaDescription?: string; allowIndexing?: boolean }): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');

    if (data.slug && data.slug !== property.slug) {
      const existing = await this.propertyRepo.findOne({ where: { slug: data.slug } });
      if (existing) throw new ConflictException('Slug already in use by another property');
      property.slug = data.slug;
    }
    if (data.metaTitle !== undefined) property.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) property.metaDescription = data.metaDescription;
    if (data.allowIndexing !== undefined) property.allowIndexing = data.allowIndexing;

    return this.propertyRepo.save(property);
  }

  async changeUserRole(userId: string, newRole: string): Promise<{ success: boolean }> {
    const validRoles = Object.values(UserRole);
    if (!validRoles.includes(newRole as UserRole)) {
      throw new ConflictException(`Invalid role: ${newRole}`);
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.role = newRole as UserRole;
    await this.userRepo.save(user);
    return { success: true };
  }

  // ── Builder Management ──────────────────────────────────────────────────────

  async getBuilders(page = 1, limit = 20, search?: string) {
    const where: any = { role: UserRole.BUILDER };
    const qb = this.userRepo.createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.BUILDER });

    if (search) {
      qb.andWhere(
        '(u.name LIKE :s OR u.email LIKE :s OR u.builderCompanyName LIKE :s OR u.builderReraNumber LIKE :s)',
        { s: `%${search}%` },
      );
    }

    qb.orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((u) => this.sanitizeBuilderUser(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBuilderById(id: string) {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.BUILDER } });
    if (!user) throw new NotFoundException('Builder not found');
    return this.sanitizeBuilderUser(user);
  }

  async createBuilder(dto: CreateBuilderDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(dto.password, 12);

    const user = this.userRepo.create({
      name:                dto.name,
      email:               dto.email,
      phone:               dto.phone ?? null,
      password:            hashed,
      role:                UserRole.BUILDER,
      city:                dto.city ?? null,
      state:               dto.state ?? null,
      isActive:            true,
      isVerified:          true,
      needsOnboarding:     false,
      builderCompanyName:  dto.builderCompanyName,
      builderReraNumber:   dto.builderReraNumber ?? null,
      builderExperience:   dto.builderExperience ?? null,
      builderWebsite:      dto.builderWebsite ?? null,
      builderProjectCount: dto.builderProjectCount ?? 0,
      builderVerified:     false,
    });

    const saved = await this.userRepo.save(user);
    return this.sanitizeBuilderUser(saved);
  }

  async updateBuilder(id: string, dto: UpdateBuilderDto) {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.BUILDER } });
    if (!user) throw new NotFoundException('Builder not found');

    if (dto.name               !== undefined) user.name               = dto.name;
    if (dto.email              !== undefined) user.email              = dto.email;
    if (dto.phone              !== undefined) user.phone              = dto.phone;
    if (dto.city               !== undefined) user.city               = dto.city;
    if (dto.state              !== undefined) user.state              = dto.state;
    if (dto.builderCompanyName !== undefined) user.builderCompanyName = dto.builderCompanyName;
    if (dto.builderReraNumber  !== undefined) user.builderReraNumber  = dto.builderReraNumber;
    if (dto.builderExperience  !== undefined) user.builderExperience  = dto.builderExperience;
    if (dto.builderWebsite     !== undefined) user.builderWebsite     = dto.builderWebsite;
    if (dto.builderProjectCount !== undefined) user.builderProjectCount = dto.builderProjectCount;
    if (dto.builderVerified    !== undefined) user.builderVerified    = dto.builderVerified;
    if (dto.isActive           !== undefined) user.isActive           = dto.isActive;

    const saved = await this.userRepo.save(user);
    return this.sanitizeBuilderUser(saved);
  }

  async updateBuilderLogo(id: string, logoUrl: string) {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.BUILDER } });
    if (!user) throw new NotFoundException('Builder not found');
    user.builderLogo = logoUrl;
    await this.userRepo.save(user);
    return { id, builderLogo: logoUrl };
  }

  async toggleBuilderVerified(id: string) {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.BUILDER } });
    if (!user) throw new NotFoundException('Builder not found');
    user.builderVerified = !user.builderVerified;
    await this.userRepo.save(user);
    return { id, builderVerified: user.builderVerified };
  }

  async deleteBuilder(id: string) {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.BUILDER } });
    if (!user) throw new NotFoundException('Builder not found');
    await this.userRepo.remove(user);
    return { success: true };
  }

  private sanitizeBuilderUser(u: User) {
    return {
      id:                  u.id,
      name:                u.name,
      email:               u.email,
      phone:               u.phone ?? null,
      city:                u.city ?? null,
      state:               u.state ?? null,
      isActive:            u.isActive,
      isVerified:          u.isVerified,
      builderCompanyName:  u.builderCompanyName ?? null,
      builderReraNumber:   u.builderReraNumber ?? null,
      builderExperience:   u.builderExperience ?? null,
      builderWebsite:      u.builderWebsite ?? null,
      builderLogo:         u.builderLogo ?? null,
      builderProjectCount: u.builderProjectCount ?? 0,
      builderVerified:     u.builderVerified ?? false,
      createdAt:           u.createdAt,
      updatedAt:           u.updatedAt,
    };
  }
}

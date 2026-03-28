import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import {
  WalletTransaction,
  TransactionType,
  TransactionReason,
} from './entities/wallet-transaction.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { BoostPlan } from './entities/boost-plan.entity';
import { AgentSubscription, SubscriptionStatus } from './entities/agent-subscription.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private transactionRepository: Repository<WalletTransaction>,
    @InjectRepository(SubscriptionPlan)
    private subscriptionPlanRepository: Repository<SubscriptionPlan>,
    @InjectRepository(BoostPlan)
    private boostPlanRepository: Repository<BoostPlan>,
    @InjectRepository(AgentSubscription)
    private agentSubscriptionRepository: Repository<AgentSubscription>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createWallet(userId: string): Promise<Wallet> {
    const wallet = this.walletRepository.create({
      userId,
      balance: 100,
      totalEarned: 100,
    });
    const saved = await this.walletRepository.save(wallet);

    // Record welcome bonus transaction
    await this.transactionRepository.save({
      walletId: saved.id,
      type: TransactionType.BONUS,
      reason: TransactionReason.WELCOME_BONUS,
      amount: 100,
      balanceBefore: 0,
      balanceAfter: 100,
      description: 'Welcome bonus tokens',
    });

    return saved;
  }

  async getWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) {
      wallet = await this.createWallet(userId);
    }
    return wallet;
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await this.getWallet(userId);
    const [transactions, total] = await this.transactionRepository.findAndCount({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { transactions, total, page, limit, wallet };
  }

  async credit(
    userId: string,
    amount: number,
    reason: TransactionReason,
    description: string,
    referenceId?: string,
    referenceType?: string,
  ): Promise<WalletTransaction> {
    const wallet = await this.getWallet(userId);
    const balanceBefore = Number(wallet.balance);
    wallet.balance = Number(wallet.balance) + amount;
    wallet.totalEarned = Number(wallet.totalEarned) + amount;
    await this.walletRepository.save(wallet);

    return this.transactionRepository.save({
      walletId: wallet.id,
      type: TransactionType.CREDIT,
      reason,
      amount,
      balanceBefore,
      balanceAfter: wallet.balance,
      description,
      referenceId,
      referenceType,
    });
  }

  async debit(
    userId: string,
    amount: number,
    reason: TransactionReason,
    description: string,
    referenceId?: string,
    referenceType?: string,
  ): Promise<WalletTransaction> {
    const wallet = await this.getWallet(userId);
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException(
        `Insufficient tokens. You have ${wallet.balance} tokens but need ${amount}`,
      );
    }
    const balanceBefore = Number(wallet.balance);
    wallet.balance = Number(wallet.balance) - amount;
    wallet.totalSpent = Number(wallet.totalSpent) + amount;
    await this.walletRepository.save(wallet);

    return this.transactionRepository.save({
      walletId: wallet.id,
      type: TransactionType.DEBIT,
      reason,
      amount,
      balanceBefore,
      balanceAfter: wallet.balance,
      description,
      referenceId,
      referenceType,
    });
  }

  async getSubscriptionPlans() {
    return this.subscriptionPlanRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async getBoostPlans() {
    return this.boostPlanRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async getBoostPlanById(id: string): Promise<BoostPlan> {
    const plan = await this.boostPlanRepository.findOne({ where: { id, isActive: true } });
    if (!plan) throw new NotFoundException('Boost plan not found');
    return plan;
  }

  async getUserQuota(userId: string) {
    return this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'role', 'agentFreeQuota', 'agentUsedQuota'],
    });
  }

  // Subscription purchase
  async purchaseSubscription(userId: string, planId: string) {
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId, isActive: true },
    });
    if (!plan) throw new NotFoundException('Subscription plan not found or inactive');

    // Deduct tokens equal to plan price (tokens are used as currency)
    await this.debit(
      userId,
      Number(plan.price),
      TransactionReason.SUBSCRIPTION,
      `Subscribed to ${plan.name} plan`,
      planId,
      'subscription_plan',
    );

    // Expire any existing active subscription
    await this.agentSubscriptionRepository.update(
      { agentId: userId, status: SubscriptionStatus.ACTIVE },
      { status: SubscriptionStatus.EXPIRED },
    );

    // Create new subscription
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    const subscription = this.agentSubscriptionRepository.create({
      agentId: userId,
      planId,
      status: SubscriptionStatus.ACTIVE,
      startsAt: now,
      expiresAt,
      tokensDeducted: plan.price,
      planSnapshot: {
        name: plan.name,
        type: plan.type,
        price: plan.price,
        durationDays: plan.durationDays,
        maxListings: plan.maxListings,
        tokensIncluded: plan.tokensIncluded,
        features: plan.features,
      },
    });
    const saved = await this.agentSubscriptionRepository.save(subscription);

    // Credit the included tokens from the plan
    if (Number(plan.tokensIncluded) > 0) {
      await this.credit(
        userId,
        Number(plan.tokensIncluded),
        TransactionReason.SUBSCRIPTION,
        `${plan.name} plan tokens`,
        saved.id,
        'agent_subscription',
      );
    }

    // Update agent quota: set new limit and reset used count for the new period
    await this.userRepository.update(userId, {
      agentFreeQuota: plan.maxListings,
      agentUsedQuota: 0,
    });

    return { subscription: saved, plan };
  }

  /**
   * Activate a subscription plan without deducting tokens.
   * Used by PaymentProcessor after a successful real-money payment.
   * Mirrors purchaseSubscription() but skips the token debit step.
   */
  async activateSubscriptionAfterPayment(
    userId: string,
    planId: string,
    transactionId: string,
  ): Promise<{ subscription: AgentSubscription; plan: SubscriptionPlan }> {
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId, isActive: true },
    });
    if (!plan) throw new NotFoundException('Subscription plan not found or inactive');

    // Expire any existing active subscription
    await this.agentSubscriptionRepository.update(
      { agentId: userId, status: SubscriptionStatus.ACTIVE },
      { status: SubscriptionStatus.EXPIRED },
    );

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    const subscription = this.agentSubscriptionRepository.create({
      agentId: userId,
      planId,
      status: SubscriptionStatus.ACTIVE,
      startsAt: now,
      expiresAt,
      tokensDeducted: 0, // paid via real money, no tokens deducted
      planSnapshot: {
        name: plan.name,
        type: plan.type,
        price: plan.price,
        durationDays: plan.durationDays,
        maxListings: plan.maxListings,
        tokensIncluded: plan.tokensIncluded,
        features: plan.features,
        paidVia: 'real_money',
        transactionId,
      },
    });
    const saved = await this.agentSubscriptionRepository.save(subscription);

    // Credit included tokens (plan benefit, no cost — money was paid via gateway)
    if (Number(plan.tokensIncluded) > 0) {
      await this.credit(
        userId,
        Number(plan.tokensIncluded),
        TransactionReason.SUBSCRIPTION,
        `${plan.name} plan tokens (real money payment)`,
        saved.id,
        'agent_subscription',
      );
    }

    // Set listing quota
    await this.userRepository.update(userId, {
      agentFreeQuota: plan.maxListings,
      agentUsedQuota: 0,
    });

    return { subscription: saved, plan };
  }

  async getAgentSubscription(agentId: string) {
    // Expire any subscriptions that have passed their expiry date
    await this.agentSubscriptionRepository
      .createQueryBuilder()
      .update(AgentSubscription)
      .set({ status: SubscriptionStatus.EXPIRED })
      .where('agentId = :agentId AND status = :status AND expiresAt < NOW()', {
        agentId,
        status: SubscriptionStatus.ACTIVE,
      })
      .execute();

    const current = await this.agentSubscriptionRepository.findOne({
      where: { agentId, status: SubscriptionStatus.ACTIVE },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    const history = await this.agentSubscriptionRepository.find({
      where: { agentId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return { current, history };
  }

  // Admin methods
  async getAllWallets(page = 1, limit = 20, search?: string, role?: string) {
    const qb = this.walletRepository
      .createQueryBuilder('wallet')
      .leftJoinAndSelect('wallet.user', 'user')
      .select([
        'wallet',
        'user.id',
        'user.name',
        'user.email',
        'user.role',
        'user.phone',
        'user.avatar',
        'user.city',
        'user.agentTick',
      ]);

    if (search) {
      qb.andWhere('(user.name LIKE :search OR user.email LIKE :search OR user.phone LIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (role && role !== 'all') {
      qb.andWhere('user.role = :role', { role });
    }

    qb.orderBy('wallet.balance', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [wallets, total] = await qb.getManyAndCount();
    return { wallets, total, page, limit };
  }

  async adminTopUp(
    userId: string,
    amount: number,
    description?: string,
  ): Promise<WalletTransaction> {
    return this.credit(
      userId,
      amount,
      TransactionReason.ADMIN_CREDIT,
      description || `Admin credited ${amount} tokens`,
      undefined,
      'admin',
    );
  }

  async adminDeduct(
    userId: string,
    amount: number,
    description?: string,
  ): Promise<WalletTransaction> {
    return this.debit(
      userId,
      amount,
      TransactionReason.ADMIN_DEBIT,
      description || `Admin deducted ${amount} tokens`,
      undefined,
      'admin',
    );
  }

  async getAllTransactions(page = 1, limit = 20) {
    const [transactions, total] = await this.transactionRepository.findAndCount({
      relations: ['wallet', 'wallet.user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { transactions, total, page, limit };
  }

  // Subscription Plan CRUD (admin)
  async createSubscriptionPlan(data: Partial<SubscriptionPlan>) {
    const plan = this.subscriptionPlanRepository.create(data);
    return this.subscriptionPlanRepository.save(plan);
  }

  async updateSubscriptionPlan(id: string, data: Partial<SubscriptionPlan>) {
    await this.subscriptionPlanRepository.update(id, data);
    return this.subscriptionPlanRepository.findOne({ where: { id } });
  }

  async deleteSubscriptionPlan(id: string) {
    return this.subscriptionPlanRepository.delete(id);
  }

  // Boost Plan CRUD (admin)
  async createBoostPlan(data: Partial<BoostPlan>) {
    const plan = this.boostPlanRepository.create(data);
    return this.boostPlanRepository.save(plan);
  }

  async updateBoostPlan(id: string, data: Partial<BoostPlan>) {
    await this.boostPlanRepository.update(id, data);
    return this.boostPlanRepository.findOne({ where: { id } });
  }

  async deleteBoostPlan(id: string) {
    return this.boostPlanRepository.delete(id);
  }
}

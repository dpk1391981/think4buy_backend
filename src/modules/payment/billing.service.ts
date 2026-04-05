import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentGateway, GatewayStatus } from './entities/payment-gateway.entity';
import { WalletService } from '../wallet/wallet.service';
import { TransactionReason } from '../wallet/entities/wallet-transaction.entity';
import { PaymentType } from './entities/payment-transaction.entity';
import { SystemConfigService } from '../system-config/system-config.service';

export interface ChargeUserOptions {
  userId:        string;
  amount:        number;           // tokens OR currency amount (INR)
  type:          PaymentType;
  description:   string;
  referenceId?:  string;
  referenceType?: string;
}

export interface ChargeResult {
  mode:         'tokens' | 'real_money';
  success:      boolean;
  walletTxId?:  string;            // set when mode = tokens
  paymentTxId?: string;            // set when mode = real_money (pending)
  clientPayload?: Record<string, any>; // set when mode = real_money (for frontend checkout)
}

/**
 * BillingService — the SINGLE abstraction layer for charging users.
 *
 * Callers NEVER need to know whether payments are token-based or real-money.
 * The decision is made here based on:
 *   1. PAYMENT_ENABLED env variable (master switch)
 *   2. At least one ACTIVE gateway in DB
 *
 * If payment_enabled = false  → WalletService.debit() (tokens)
 * If payment_enabled = true   → initiate gateway payment → return clientPayload to frontend
 *
 * This preserves full backward compatibility: existing wallet debit calls
 * continue to work unchanged; callers just need to handle the ChargeResult.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
    private readonly systemConfig: SystemConfigService,
    @InjectRepository(PaymentGateway)
    private gatewayRepo: Repository<PaymentGateway>,
  ) {}

  /**
   * Determine if real-money payments are active.
   * Real payments require BOTH:
   *   1. PAYMENT_ENABLED=true in env
   *   2. At least one active gateway in DB
   */
  async isRealPaymentEnabled(): Promise<boolean> {
    // DB flag takes precedence over env var (admin-toggleable at runtime)
    const dbFlag = await this.systemConfig.getBoolean('PAYMENT_ENABLED', false);
    if (!dbFlag) return false;

    const activeGateway = await this.gatewayRepo.findOne({
      where: { status: GatewayStatus.ACTIVE },
    });
    return !!activeGateway;
  }

  /**
   * Charge a user for a service.
   *
   * TOKEN mode:   immediately deducts from wallet and returns success.
   * REAL MONEY:   creates a pending payment and returns clientPayload for the
   *               frontend to launch the gateway's checkout flow.
   *               Fulfillment (e.g. plan activation) happens after webhook confirmation.
   */
  async chargeUser(opts: ChargeUserOptions): Promise<ChargeResult> {
    const paymentEnabled = await this.isRealPaymentEnabled();

    if (!paymentEnabled) {
      return this.chargeViaTokens(opts);
    }

    // Real money: signal to caller that they need to initiate a payment flow
    this.logger.log(`Real payment mode active for user ${opts.userId}, type=${opts.type}`);
    return {
      mode:    'real_money',
      success: false, // not yet — frontend must complete checkout
      // Caller should use PaymentService.initiatePayment() to get clientPayload
    };
  }

  /**
   * Direct token deduction — always available regardless of payment mode.
   * Used for admin credits, subscription token deductions, boosts.
   */
  async chargeViaTokens(opts: ChargeUserOptions): Promise<ChargeResult> {
    const reason = this.mapTypeToReason(opts.type);
    const tx = await this.walletService.debit(
      opts.userId,
      opts.amount,
      reason,
      opts.description,
      opts.referenceId,
      opts.referenceType,
    );
    this.logger.log(`Token charge: user=${opts.userId} amount=${opts.amount} tx=${tx.id}`);
    return { mode: 'tokens', success: true, walletTxId: tx.id };
  }

  /**
   * Credit tokens to user wallet (used after successful real-money payment
   * to grant token allowance from a subscription plan).
   */
  async creditTokens(
    userId: string,
    amount: number,
    reason: TransactionReason,
    description: string,
    referenceId?: string,
    referenceType?: string,
  ) {
    return this.walletService.credit(userId, amount, reason, description, referenceId, referenceType);
  }

  private mapTypeToReason(type: PaymentType): TransactionReason {
    switch (type) {
      case PaymentType.SUBSCRIPTION:     return TransactionReason.SUBSCRIPTION;
      case PaymentType.BOOST:            return TransactionReason.BOOST_PROPERTY;
      case PaymentType.TOKEN_PURCHASE:   return TransactionReason.PAYMENT;
      case PaymentType.PROPERTY_LISTING: return TransactionReason.PAYMENT;
      default:                           return TransactionReason.PAYMENT;
    }
  }
}

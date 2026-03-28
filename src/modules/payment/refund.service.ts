import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund, RefundStatus, RefundInitiatedBy } from './entities/refund.entity';
import { PaymentTransaction, PaymentStatus, PaymentMode } from './entities/payment-transaction.entity';
import { PaymentLog, LogLevel, LogSource } from './entities/payment-log.entity';
import { GatewayFactoryService } from './gateways/gateway.factory.service';
import { WalletService } from '../wallet/wallet.service';
import { TransactionReason } from '../wallet/entities/wallet-transaction.entity';
import { InitiateRefundDto } from './dto/refund.dto';
import { RazorpayGateway } from './gateways/razorpay.gateway';

/**
 * RefundService — handles refund lifecycle for both real-money and token transactions.
 *
 * Real-money refunds:  routed through the original payment gateway
 * Token refunds:       re-credit wallet via WalletService
 */
@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(Refund)
    private refundRepo: Repository<Refund>,
    @InjectRepository(PaymentTransaction)
    private txRepo: Repository<PaymentTransaction>,
    @InjectRepository(PaymentLog)
    private logRepo: Repository<PaymentLog>,
    private readonly gatewayFactory: GatewayFactoryService,
    private readonly walletService: WalletService,
  ) {}

  async initiateRefund(dto: InitiateRefundDto, adminId?: string): Promise<Refund> {
    const tx = await this.txRepo.findOne({ where: { id: dto.transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');

    if (tx.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(`Cannot refund a transaction with status: ${tx.status}`);
    }

    if (dto.amount > Number(tx.amount)) {
      throw new BadRequestException(
        `Refund amount (${dto.amount}) cannot exceed original amount (${tx.amount})`,
      );
    }

    // Prevent double-refund: check existing non-failed refunds
    const existingRefund = await this.refundRepo.findOne({
      where: { transactionId: dto.transactionId },
    });
    if (existingRefund && existingRefund.status !== RefundStatus.FAILED) {
      throw new BadRequestException('A refund already exists for this transaction');
    }

    const refund = this.refundRepo.create({
      transactionId:    dto.transactionId,
      userId:           tx.userId,
      amount:           dto.amount,
      reason:           dto.reason,
      status:           RefundStatus.INITIATED,
      initiatedBy:      dto.initiatedBy ?? RefundInitiatedBy.ADMIN,
      initiatorAdminId: adminId,
    });
    await this.refundRepo.save(refund);

    await this.logEvent(tx.id, 'refund.initiated', LogSource.ADMIN, LogLevel.INFO,
      `Refund of ${dto.amount} initiated by admin ${adminId ?? 'system'}`);

    // Process immediately
    await this.processRefund(refund, tx);

    return this.refundRepo.findOne({ where: { id: refund.id } });
  }

  private async processRefund(refund: Refund, tx: PaymentTransaction): Promise<void> {
    refund.status = RefundStatus.PROCESSING;
    await this.refundRepo.save(refund);

    try {
      if (tx.mode === PaymentMode.REAL_MONEY && tx.gatewayPaymentId) {
        // Real-money: route through gateway
        await this.processGatewayRefund(refund, tx);
      } else {
        // Token mode: re-credit wallet
        await this.processTokenRefund(refund, tx);
      }
    } catch (err) {
      refund.status        = RefundStatus.FAILED;
      refund.failureReason = err.message;
      await this.refundRepo.save(refund);

      await this.logEvent(tx.id, 'refund.failed', LogSource.SYSTEM, LogLevel.ERROR,
        `Refund failed: ${err.message}`);
      this.logger.error(`Refund ${refund.id} failed: ${err.message}`);
    }
  }

  private async processGatewayRefund(refund: Refund, tx: PaymentTransaction): Promise<void> {
    const ctx = await this.gatewayFactory.getGatewayById(tx.gatewayId);

    const result = await (ctx.adapter as RazorpayGateway).processRefund(
      {
        gatewayPaymentId: tx.gatewayPaymentId,
        amount:           refund.amount,
        reason:           refund.reason,
      },
      ctx.config as any,
    );

    refund.gatewayRefundId  = result.gatewayRefundId;
    refund.gatewayResponse  = JSON.stringify(result);
    refund.status           = result.status === 'completed' ? RefundStatus.COMPLETED : RefundStatus.PROCESSING;
    refund.processedAt      = result.status === 'completed' ? new Date() : undefined;
    await this.refundRepo.save(refund);

    // Mark original transaction as refunded
    if (refund.status === RefundStatus.COMPLETED) {
      await this.txRepo.update(tx.id, { status: PaymentStatus.REFUNDED });
    }

    await this.logEvent(tx.id, 'refund.gateway_processed', LogSource.SYSTEM, LogLevel.SUCCESS,
      `Gateway refund initiated: ${result.gatewayRefundId}`);
  }

  private async processTokenRefund(refund: Refund, tx: PaymentTransaction): Promise<void> {
    await this.walletService.credit(
      tx.userId,
      refund.amount,
      TransactionReason.REFUND,
      `Refund: ${refund.reason}`,
      refund.id,
      'refund',
    );

    refund.status      = RefundStatus.COMPLETED;
    refund.processedAt = new Date();
    await this.refundRepo.save(refund);

    await this.txRepo.update(tx.id, { status: PaymentStatus.REFUNDED });
    await this.logEvent(tx.id, 'refund.token_credited', LogSource.SYSTEM, LogLevel.SUCCESS,
      `Token refund of ${refund.amount} credited to wallet`);
  }

  async getRefundsByTransaction(transactionId: string) {
    return this.refundRepo.find({
      where: { transactionId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllRefunds(page = 1, limit = 20, status?: RefundStatus) {
    const qb = this.refundRepo
      .createQueryBuilder('r')
      .leftJoin('r.transaction', 'tx')
      .leftJoin('r.user', 'user')
      .select(['r', 'tx.id', 'tx.amount', 'tx.currency', 'tx.type', 'user.id', 'user.name', 'user.email']);

    if (status) qb.andWhere('r.status = :status', { status });

    qb.orderBy('r.createdAt', 'DESC').skip((page - 1) * limit).take(limit);
    const [refunds, total] = await qb.getManyAndCount();
    return { refunds, total, page, limit };
  }

  private async logEvent(
    transactionId: string,
    event: string,
    source: LogSource,
    level: LogLevel,
    message: string,
  ) {
    try {
      await this.logRepo.save(
        this.logRepo.create({ transactionId, event, source, level, message }),
      );
    } catch { /* non-critical */ }
  }
}

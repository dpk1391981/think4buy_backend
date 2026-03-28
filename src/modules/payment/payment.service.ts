import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  PaymentTransaction,
  PaymentStatus,
  PaymentMode,
} from './entities/payment-transaction.entity';
import { PaymentLog, LogLevel, LogSource } from './entities/payment-log.entity';
import { GatewayFactoryService } from './gateways/gateway.factory.service';
import { GatewayName } from './entities/payment-gateway.entity';
import { InitiatePaymentDto, VerifyPaymentDto } from './dto/initiate-payment.dto';
import { RazorpayGateway } from './gateways/razorpay.gateway';

export const PAYMENT_QUEUE = 'payment_queue';

export interface PaymentJobData {
  transactionId: string;
  jobType: 'fulfill_payment';
}

/**
 * PaymentService — orchestrates the real-money payment lifecycle.
 *
 * Flow:
 *   1. initiatePayment   → create DB record + gateway order → return client payload
 *   2. verifyPayment     → verify signature → enqueue fulfillment job
 *   3. handleWebhook     → verify webhook → update status → enqueue fulfillment
 *   4. PaymentProcessor  → processes fulfillment (credits wallet / activates plan)
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private txRepo: Repository<PaymentTransaction>,
    @InjectRepository(PaymentLog)
    private logRepo: Repository<PaymentLog>,
    private readonly gatewayFactory: GatewayFactoryService,
    private readonly dataSource: DataSource,
    @InjectQueue(PAYMENT_QUEUE) private paymentQueue: Queue,
  ) {}

  // ─── Initiate ──────────────────────────────────────────────────────────────

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    // Idempotency: return existing transaction if key already used
    const existing = await this.txRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException('Idempotency key belongs to a different user');
      }
      this.logger.log(`Idempotency hit: returning existing tx ${existing.id}`);
      return { transaction: existing, clientPayload: existing.metadata?.clientPayload ?? {} };
    }

    const ctx = await this.gatewayFactory.getActiveGateway();

    // Create transaction record
    const tx = this.txRepo.create({
      idempotencyKey: dto.idempotencyKey,
      userId,
      gatewayId:     ctx.gateway.id,
      amount:        dto.amount,
      currency:      dto.currency ?? 'INR',
      status:        PaymentStatus.INITIATED,
      type:          dto.type,
      mode:          PaymentMode.REAL_MONEY,
      referenceId:   dto.referenceId,
      referenceType: dto.referenceType,
      metadata:      dto.metadata ?? {},
    });
    await this.txRepo.save(tx);

    await this.addLog(tx.id, 'payment.initiated', LogSource.SYSTEM, LogLevel.INFO,
      `Payment initiated via ${ctx.gateway.name}`, JSON.stringify({ amount: dto.amount }));

    // Create order on gateway
    let clientPayload: Record<string, any> = {};
    try {
      const orderResult = await (ctx.adapter as RazorpayGateway).createOrder(
        {
          amount:   dto.amount,
          currency: dto.currency ?? 'INR',
          receipt:  tx.id,
          notes:    {
            userId,
            type:        dto.type,
            description: dto.metadata?.description ?? '',
            referenceId: dto.referenceId ?? '',
          },
        },
        ctx.config as any,
      );

      tx.gatewayOrderId = orderResult.gatewayOrderId;
      tx.status         = PaymentStatus.PENDING;
      tx.metadata       = { ...(tx.metadata ?? {}), clientPayload: orderResult.clientPayload };
      await this.txRepo.save(tx);

      clientPayload = orderResult.clientPayload;

      await this.addLog(tx.id, 'gateway.order_created', LogSource.SYSTEM, LogLevel.SUCCESS,
        `Gateway order created: ${orderResult.gatewayOrderId}`);
    } catch (err) {
      tx.status        = PaymentStatus.FAILED;
      tx.failureReason = err.message;
      await this.txRepo.save(tx);

      await this.addLog(tx.id, 'gateway.order_failed', LogSource.SYSTEM, LogLevel.ERROR,
        `Gateway order creation failed: ${err.message}`);
      throw err;
    }

    return { transaction: tx, clientPayload };
  }

  // ─── Verify (frontend callback) ────────────────────────────────────────────

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const tx = await this.txRepo.findOne({ where: { id: dto.transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) throw new BadRequestException('Unauthorized');
    if (tx.status === PaymentStatus.SUCCESS) return { success: true, transaction: tx };
    if (tx.status === PaymentStatus.FAILED) {
      throw new BadRequestException('This payment already failed. Please initiate a new payment.');
    }

    const ctx = await this.gatewayFactory.getGatewayById(tx.gatewayId);

    const isValid = (ctx.adapter as RazorpayGateway).verifyPayment(
      {
        gatewayOrderId:   dto.gatewayOrderId,
        gatewayPaymentId: dto.gatewayPaymentId,
        gatewaySignature: dto.gatewaySignature,
      },
      ctx.config.keySecret ?? ctx.config.secretKey,
    );

    if (!isValid) {
      await this.addLog(tx.id, 'payment.signature_invalid', LogSource.SYSTEM, LogLevel.ERROR,
        'Payment signature verification failed');
      throw new BadRequestException('Payment signature verification failed. Do not retry with the same data.');
    }

    tx.gatewayPaymentId = dto.gatewayPaymentId;
    tx.status           = PaymentStatus.SUCCESS;
    tx.processedAt      = new Date();
    await this.txRepo.save(tx);

    await this.addLog(tx.id, 'payment.verified', LogSource.SYSTEM, LogLevel.SUCCESS,
      'Payment signature verified successfully');

    // Enqueue fulfillment job (credit wallet / activate subscription)
    await this.paymentQueue.add(
      'fulfill_payment',
      { transactionId: tx.id, jobType: 'fulfill_payment' } satisfies PaymentJobData,
      {
        attempts:  5,
        backoff:   { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     false,
      },
    );

    return { success: true, transaction: tx };
  }

  // ─── Webhook ───────────────────────────────────────────────────────────────

  async handleWebhook(
    gatewayName: GatewayName,
    rawBody: Buffer,
    signature: string,
    ipAddress: string,
  ): Promise<void> {
    const ctx = await this.gatewayFactory.getGatewayByName(gatewayName);

    const isValid = (ctx.adapter as RazorpayGateway).verifyWebhook({
      rawBody,
      signature,
      secret: ctx.config.webhookSecret,
    });

    if (!isValid) {
      await this.addLog(null, `webhook.${gatewayName}.invalid_signature`, LogSource.WEBHOOK, LogLevel.ERROR,
        'Webhook signature verification failed', rawBody.toString('utf8'), false, ipAddress);
      this.logger.warn(`Invalid webhook signature from ${ipAddress}`);
      return; // Do not throw — return 200 to prevent gateway retry storms
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return;
    }

    // Resolve transaction from gateway event
    const tx = await this.resolveTransactionFromWebhook(gatewayName, payload);
    if (!tx) {
      await this.addLog(null, `webhook.${gatewayName}.unresolved`, LogSource.WEBHOOK, LogLevel.WARNING,
        'Could not resolve transaction from webhook payload', JSON.stringify(payload), true, ipAddress);
      return;
    }

    await this.addLog(tx.id, `webhook.${gatewayName}.received`, LogSource.WEBHOOK, LogLevel.INFO,
      `Webhook event: ${payload.event ?? 'unknown'}`, JSON.stringify(payload), true, ipAddress);

    const event: string = payload.event ?? payload.type ?? '';

    if (this.isSuccessEvent(gatewayName, event)) {
      if (tx.status !== PaymentStatus.SUCCESS) {
        tx.gatewayPaymentId = this.extractPaymentId(gatewayName, payload);
        tx.status           = PaymentStatus.SUCCESS;
        tx.processedAt      = new Date();
        await this.txRepo.save(tx);

        await this.paymentQueue.add(
          'fulfill_payment',
          { transactionId: tx.id, jobType: 'fulfill_payment' } satisfies PaymentJobData,
          { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, jobId: `fulfill_${tx.id}` },
        );
      }
    } else if (this.isFailureEvent(gatewayName, event)) {
      tx.status        = PaymentStatus.FAILED;
      tx.failureReason = `Gateway event: ${event}`;
      await this.txRepo.save(tx);
    }
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  async getPaymentStatus(transactionId: string, userId: string) {
    const tx = await this.txRepo.findOne({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) throw new BadRequestException('Unauthorized');
    return tx;
  }

  async getPaymentStatusPublic(transactionId: string) {
    const tx = await this.txRepo.findOne({
      where: { id: transactionId },
      select: ['id', 'status', 'amount', 'currency', 'type', 'mode', 'createdAt', 'processedAt'],
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async getAllTransactions(
    page = 1,
    limit = 20,
    status?: PaymentStatus,
    userId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const qb = this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.user', 'user')
      .leftJoinAndSelect('tx.gateway', 'gateway')
      .select([
        'tx', 'user.id', 'user.name', 'user.email', 'user.phone',
        'gateway.id', 'gateway.name', 'gateway.displayName',
      ]);

    if (status)   qb.andWhere('tx.status = :status', { status });
    if (userId)   qb.andWhere('tx.userId = :userId', { userId });
    if (dateFrom) qb.andWhere('tx.createdAt >= :dateFrom', { dateFrom });
    if (dateTo)   qb.andWhere('tx.createdAt <= :dateTo', { dateTo });

    qb.orderBy('tx.createdAt', 'DESC').skip((page - 1) * limit).take(limit);
    const [transactions, total] = await qb.getManyAndCount();
    return { transactions, total, page, limit };
  }

  async getRevenueStats() {
    const stats = await this.txRepo
      .createQueryBuilder('tx')
      .select([
        'COUNT(CASE WHEN tx.status = :success THEN 1 END) AS totalSuccess',
        'COUNT(CASE WHEN tx.status = :failed THEN 1 END) AS totalFailed',
        'COUNT(CASE WHEN tx.status = :refunded THEN 1 END) AS totalRefunded',
        'SUM(CASE WHEN tx.status = :success AND tx.mode = :money THEN tx.amount ELSE 0 END) AS totalRevenueMoney',
        'COUNT(*) AS totalTransactions',
      ])
      .setParameters({ success: 'success', failed: 'failed', refunded: 'refunded', money: 'real_money' })
      .getRawOne();
    return stats;
  }

  async getWebhookLogs(transactionId?: string, page = 1, limit = 50) {
    const qb = this.logRepo
      .createQueryBuilder('log')
      .where('log.source = :src', { src: LogSource.WEBHOOK });

    if (transactionId) qb.andWhere('log.transactionId = :tid', { tid: transactionId });

    qb.orderBy('log.createdAt', 'DESC').skip((page - 1) * limit).take(limit);
    const [logs, total] = await qb.getManyAndCount();
    return { logs, total, page, limit };
  }

  async exportTransactions(status?: PaymentStatus, dateFrom?: string, dateTo?: string) {
    const qb = this.txRepo
      .createQueryBuilder('tx')
      .leftJoin('tx.user', 'user')
      .select([
        'tx.id', 'tx.idempotencyKey', 'tx.amount', 'tx.currency', 'tx.status',
        'tx.type', 'tx.mode', 'tx.gatewayOrderId', 'tx.gatewayPaymentId',
        'tx.createdAt', 'tx.processedAt', 'user.name', 'user.email', 'user.phone',
      ]);

    if (status)   qb.andWhere('tx.status = :status', { status });
    if (dateFrom) qb.andWhere('tx.createdAt >= :dateFrom', { dateFrom });
    if (dateTo)   qb.andWhere('tx.createdAt <= :dateTo', { dateTo });

    qb.orderBy('tx.createdAt', 'DESC').take(10000);
    return qb.getRawMany();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async addLog(
    transactionId: string | null,
    event: string,
    source: LogSource,
    level: LogLevel,
    message: string,
    payload?: string,
    signatureValid?: boolean,
    ipAddress?: string,
  ) {
    try {
      await this.logRepo.save(
        this.logRepo.create({
          transactionId: transactionId ?? undefined,
          event,
          source,
          level,
          message,
          payload,
          signatureValid: signatureValid ?? null,
          ipAddress,
        }),
      );
    } catch (e) {
      this.logger.error(`Failed to write payment log: ${e.message}`);
    }
  }

  private async resolveTransactionFromWebhook(
    gatewayName: GatewayName,
    payload: any,
  ): Promise<PaymentTransaction | null> {
    let gatewayOrderId: string | undefined;

    if (gatewayName === GatewayName.RAZORPAY) {
      gatewayOrderId = payload?.payload?.payment?.entity?.order_id;
    } else if (gatewayName === GatewayName.STRIPE) {
      gatewayOrderId = payload?.data?.object?.id; // PaymentIntent id
    }

    if (!gatewayOrderId) return null;

    return this.txRepo.findOne({ where: { gatewayOrderId } });
  }

  private extractPaymentId(gatewayName: GatewayName, payload: any): string {
    if (gatewayName === GatewayName.RAZORPAY) {
      return payload?.payload?.payment?.entity?.id ?? '';
    }
    if (gatewayName === GatewayName.STRIPE) {
      return payload?.data?.object?.latest_charge ?? payload?.data?.object?.id ?? '';
    }
    return '';
  }

  private isSuccessEvent(gatewayName: GatewayName, event: string): boolean {
    const successEvents: Record<string, string[]> = {
      [GatewayName.RAZORPAY]: ['payment.captured'],
      [GatewayName.STRIPE]:   ['payment_intent.succeeded', 'charge.succeeded'],
    };
    return (successEvents[gatewayName] ?? []).includes(event);
  }

  private isFailureEvent(gatewayName: GatewayName, event: string): boolean {
    const failureEvents: Record<string, string[]> = {
      [GatewayName.RAZORPAY]: ['payment.failed'],
      [GatewayName.STRIPE]:   ['payment_intent.payment_failed', 'charge.failed'],
    };
    return (failureEvents[gatewayName] ?? []).includes(event);
  }
}

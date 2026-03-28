import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentTransaction,
  PaymentStatus,
  PaymentType,
  PaymentMode,
} from './entities/payment-transaction.entity';
import { PaymentLog, LogLevel, LogSource } from './entities/payment-log.entity';
import { WalletService } from '../wallet/wallet.service';
import { TransactionReason } from '../wallet/entities/wallet-transaction.entity'; // used for TOKEN_PURCHASE credit
import { PAYMENT_QUEUE, PaymentJobData } from './payment.service';

/**
 * PaymentProcessor — BullMQ worker that fulfills successful payments.
 *
 * Runs AFTER payment verification (either from frontend callback or webhook).
 * Responsibilities:
 *   - Credit tokens to wallet (for token purchase plans)
 *   - Activate subscriptions
 *   - Update referenceId record (boost plan, listing, etc.)
 *   - Log every step to payment_logs
 *
 * Retry policy: 5 attempts with exponential backoff (2s, 4s, 8s, 16s, 32s).
 * Dead-letter: BullMQ stores failed jobs with full context for admin review.
 */
@Processor(PAYMENT_QUEUE)
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private txRepo: Repository<PaymentTransaction>,
    @InjectRepository(PaymentLog)
    private logRepo: Repository<PaymentLog>,
    private readonly walletService: WalletService,
  ) {
    super();
  }

  async process(job: Job<PaymentJobData>): Promise<any> {
    const { transactionId, jobType } = job.data;
    this.logger.log(`Processing payment job ${job.id}: ${jobType} for tx=${transactionId}`);

    if (job.attemptsMade > 0) {
      this.logger.warn(`Retry attempt ${job.attemptsMade} for tx=${transactionId}`);
    }

    const tx = await this.txRepo.findOne({ where: { id: transactionId } });
    if (!tx) {
      // Transaction deleted — skip silently
      this.logger.warn(`Transaction ${transactionId} not found, skipping fulfillment`);
      return { skipped: true, reason: 'transaction_not_found' };
    }

    if (tx.status !== PaymentStatus.SUCCESS) {
      this.logger.warn(`Transaction ${transactionId} is not in SUCCESS state (${tx.status}), skipping`);
      return { skipped: true, reason: 'not_success' };
    }

    // Idempotency: check if already fulfilled (retryCount > 0 indicates prior run)
    if (tx.retryCount > 0 && job.attemptsMade === 0) {
      this.logger.log(`Transaction ${transactionId} already fulfilled, skipping`);
      return { skipped: true, reason: 'already_fulfilled' };
    }

    try {
      await this.fulfill(tx, job.id as string);
      tx.retryCount += 1;
      await this.txRepo.save(tx);
      this.logger.log(`Fulfillment successful for tx=${transactionId}`);
      return { success: true };
    } catch (err) {
      await this.writeLog(transactionId, 'fulfill.failed', LogLevel.ERROR, LogSource.QUEUE,
        `Fulfillment attempt ${job.attemptsMade + 1} failed: ${err.message}`);
      throw err; // rethrow for BullMQ retry
    }
  }

  private async fulfill(tx: PaymentTransaction, jobId: string): Promise<void> {
    await this.writeLog(tx.id, 'fulfill.started', LogLevel.INFO, LogSource.QUEUE,
      `Fulfillment started (mode=${tx.mode}, type=${tx.type})`);

    if (tx.type === PaymentType.TOKEN_PURCHASE) {
      // Credit token pack amount to wallet
      const tokenAmount = tx.metadata?.tokens ?? tx.amount;
      await this.walletService.credit(
        tx.userId,
        tokenAmount,
        TransactionReason.PAYMENT,
        `Token purchase via payment`,
        tx.id,
        'payment_transaction',
      );
      await this.writeLog(tx.id, 'fulfill.tokens_credited', LogLevel.SUCCESS, LogSource.QUEUE,
        `${tokenAmount} tokens credited to user ${tx.userId}`);
    } else if (tx.type === PaymentType.SUBSCRIPTION) {
      if (tx.referenceId && tx.mode === PaymentMode.REAL_MONEY) {
        // Real-money subscription: activate plan WITHOUT token deduction.
        // activateSubscriptionAfterPayment handles:
        //   • Expiring existing active subscription
        //   • Creating new AgentSubscription record
        //   • Crediting included tokens from the plan (benefit, not deduction)
        //   • Updating user listing quota (agentFreeQuota reset)
        await this.walletService.activateSubscriptionAfterPayment(
          tx.userId,
          tx.referenceId,
          tx.id,
        );
        await this.writeLog(tx.id, 'fulfill.subscription_activated', LogLevel.SUCCESS, LogSource.QUEUE,
          `Subscription plan ${tx.referenceId} activated for user ${tx.userId} via real-money payment`);
      }
      // Token-mode subscriptions are processed synchronously in WalletService.purchaseSubscription()
      // and never enter this queue — no action needed here for the tokens path.
    } else if (tx.type === PaymentType.BOOST) {
      await this.writeLog(tx.id, 'fulfill.boost_activated', LogLevel.SUCCESS, LogSource.QUEUE,
        `Boost activated for property ${tx.referenceId}`);
    } else if (tx.type === PaymentType.PROPERTY_LISTING) {
      await this.writeLog(tx.id, 'fulfill.listing_paid', LogLevel.SUCCESS, LogSource.QUEUE,
        `Property listing payment confirmed for ${tx.referenceId}`);
    }

    await this.writeLog(tx.id, 'fulfill.completed', LogLevel.SUCCESS, LogSource.QUEUE,
      `Fulfillment completed for tx=${tx.id} job=${jobId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PaymentJobData>, err: Error) {
    const isExhausted = job.attemptsMade >= (job.opts?.attempts ?? 1);
    this.logger.error(
      `Payment job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts ?? 1}): ${err.message}`,
    );

    if (isExhausted) {
      this.logger.error(
        `DEAD LETTER: Payment job ${job.id} exhausted all retries for tx=${job.data?.transactionId}`,
      );
      // In production: send alert to admin / push to dead-letter monitoring
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<PaymentJobData>) {
    this.logger.log(`Payment job ${job.id} completed for tx=${job.data?.transactionId}`);
  }

  private async writeLog(
    transactionId: string,
    event: string,
    level: LogLevel,
    source: LogSource,
    message: string,
  ) {
    try {
      await this.logRepo.save(
        this.logRepo.create({ transactionId, event, level, source, message }),
      );
    } catch { /* non-critical */ }
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

// Entities
import { PaymentGateway } from './entities/payment-gateway.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentLog } from './entities/payment-log.entity';
import { Refund } from './entities/refund.entity';

// Services
import { PaymentConfigService } from './payment-config.service';
import { PaymentService, PAYMENT_QUEUE } from './payment.service';
import { BillingService } from './billing.service';
import { RefundService } from './refund.service';

// Gateways (strategy pattern adapters)
import { GatewayFactoryService } from './gateways/gateway.factory.service';
import { RazorpayGateway } from './gateways/razorpay.gateway';
import { StripeGateway } from './gateways/stripe.gateway';

// Processor (BullMQ worker)
import { PaymentProcessor } from './payment.processor';

// Controllers
import { PaymentController } from './payment.controller';
import { PaymentAdminController } from './payment-admin.controller';

// External module dependencies
import { WalletModule } from '../wallet/wallet.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [
    ConfigModule,
    SystemConfigModule,
    TypeOrmModule.forFeature([
      PaymentGateway,
      PaymentTransaction,
      PaymentLog,
      Refund,
    ]),
    // Register the payment processing queue
    BullModule.registerQueue({
      name: PAYMENT_QUEUE,
      defaultJobOptions: {
        attempts:  5,
        backoff:   { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 200, age: 7 * 24 * 3600 }, // keep 200 jobs for 7 days
        removeOnFail:     false, // keep failed jobs for admin inspection
      },
    }),
    WalletModule,
  ],
  controllers: [
    PaymentController,
    PaymentAdminController,
  ],
  providers: [
    // Services
    PaymentConfigService,
    PaymentService,
    BillingService,
    RefundService,

    // Gateway adapters (strategy pattern)
    GatewayFactoryService,
    RazorpayGateway,
    StripeGateway,

    // BullMQ processor
    PaymentProcessor,
  ],
  exports: [
    BillingService,
    PaymentService,
    RefundService,
    PaymentConfigService,
  ],
})
export class PaymentModule {}

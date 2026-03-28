import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { BoostPlan } from './entities/boost-plan.entity';
import { AgentSubscription } from './entities/agent-subscription.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { PaymentGateway } from '../payment/entities/payment-gateway.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Wallet,
      WalletTransaction,
      SubscriptionPlan,
      BoostPlan,
      AgentSubscription,
      User,
      Property,
      PaymentGateway,   // needed to check active gateway for payment mode check
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}

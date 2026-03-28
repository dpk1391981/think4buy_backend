import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletService } from './wallet.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PaymentGateway, GatewayStatus } from '../payment/entities/payment-gateway.entity';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
    @InjectRepository(PaymentGateway)
    private readonly gatewayRepo: Repository<PaymentGateway>,
  ) {}

  /** Check if real-money payments are active (used by frontend before purchase) */
  private async isRealPaymentEnabled(): Promise<boolean> {
    if (this.configService.get<string>('PAYMENT_ENABLED') !== 'true') return false;
    const gw = await this.gatewayRepo.findOne({ where: { status: GatewayStatus.ACTIVE } });
    return !!gw;
  }

  @Get()
  @ApiOperation({ summary: 'Get current user wallet balance with quota info' })
  async getWallet(@Request() req) {
    const [wallet, user] = await Promise.all([
      this.walletService.getWallet(req.user.id),
      this.walletService.getUserQuota(req.user.id),
    ]);
    return {
      ...wallet,
      quotaUsed: user?.agentUsedQuota ?? 0,
      quotaTotal: user?.agentFreeQuota ?? 0,
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getTransactions(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.walletService.getTransactions(req.user.id, page, limit);
  }

  @Get('boost-plans')
  @ApiOperation({ summary: 'Get all active boost plans' })
  getBoostPlans() {
    return this.walletService.getBoostPlans();
  }

  @Get('subscription-plans')
  @ApiOperation({ summary: 'Get all active subscription plans' })
  getSubscriptionPlans() {
    return this.walletService.getSubscriptionPlans();
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get current agent subscription' })
  getAgentSubscription(@Request() req) {
    return this.walletService.getAgentSubscription(req.user.id);
  }

  @Post('subscription/purchase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Purchase a subscription plan. Returns {requiresPayment: true, ...} when real-money mode is active.',
  })
  async purchaseSubscription(@Request() req, @Body('planId') planId: string) {
    const paymentEnabled = await this.isRealPaymentEnabled();

    if (paymentEnabled) {
      // Real-money mode: return plan details for the frontend to launch checkout
      // Actual activation happens in PaymentProcessor after successful payment
      const plans = await this.walletService.getSubscriptionPlans();
      const plan = plans.find((p) => p.id === planId);
      if (!plan) {
        throw new Error('Subscription plan not found or inactive');
      }
      return {
        requiresPayment: true,
        plan: {
          id:             plan.id,
          name:           plan.name,
          price:          plan.price,
          durationDays:   plan.durationDays,
          tokensIncluded: plan.tokensIncluded,
          maxListings:    plan.maxListings,
        },
      };
    }

    // Token mode: existing flow unchanged
    return this.walletService.purchaseSubscription(req.user.id, planId);
  }
}

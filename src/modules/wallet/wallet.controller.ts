import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user wallet balance' })
  getWallet(@Request() req) {
    return this.walletService.getWallet(req.user.id);
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
  @ApiOperation({ summary: 'Purchase a subscription plan using tokens' })
  purchaseSubscription(@Request() req, @Body('planId') planId: string) {
    return this.walletService.purchaseSubscription(req.user.id, planId);
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  RawBodyRequest,
  Req,
  Headers,
  Ip,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { BillingService } from './billing.service';
import { InitiatePaymentDto, VerifyPaymentDto } from './dto/initiate-payment.dto';
import { GatewayName } from './entities/payment-gateway.entity';

@ApiTags('payment')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly billingService: BillingService,
  ) {}

  // ─── Status check (public — no auth required) ──────────────────────────────

  @Get('mode')
  @ApiOperation({ summary: 'Check if real-money payment mode is enabled' })
  async getPaymentMode() {
    const enabled = await this.billingService.isRealPaymentEnabled();
    return { paymentEnabled: enabled };
  }

  // ─── Authenticated user routes ─────────────────────────────────────────────

  @Post('initiate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Initiate a payment (returns gateway checkout payload)' })
  async initiatePayment(@Request() req: any, @Body() dto: InitiatePaymentDto) {
    return this.paymentService.initiatePayment(req.user.id, dto);
  }

  @Post('verify')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify payment signature after frontend checkout completion' })
  async verifyPayment(@Request() req: any, @Body() dto: VerifyPaymentDto) {
    return this.paymentService.verifyPayment(req.user.id, dto);
  }

  @Get('status/:transactionId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status for a specific transaction' })
  async getStatus(@Request() req: any, @Param('transactionId') id: string) {
    return this.paymentService.getPaymentStatus(id, req.user.id);
  }

  @Get('status/:transactionId/public')
  @ApiOperation({ summary: 'Public payment status (limited fields, no auth)' })
  async getStatusPublic(@Param('transactionId') id: string) {
    return this.paymentService.getPaymentStatusPublic(id);
  }

  @Get('history')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's payment transaction history" })
  async getHistory(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.paymentService.getAllTransactions(
      Number(page), Number(limit), undefined, req.user.id,
    );
  }

  // ─── Webhooks (no auth — signature verified internally) ───────────────────

  /**
   * Razorpay webhook endpoint.
   * Header: X-Razorpay-Signature
   * Configure in Razorpay Dashboard → Webhooks → https://yourdomain.com/api/v1/payment/webhook/razorpay
   */
  @Post('webhook/razorpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Razorpay webhook receiver (signature-verified)' })
  async webhookRazorpay(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
    @Ip() ip: string,
  ) {
    await this.paymentService.handleWebhook(
      GatewayName.RAZORPAY,
      req.rawBody ?? Buffer.from(''),
      signature ?? '',
      ip,
    );
    return { received: true };
  }

  /**
   * Stripe webhook endpoint.
   * Header: Stripe-Signature
   * Configure in Stripe Dashboard → Webhooks → https://yourdomain.com/api/v1/payment/webhook/stripe
   */
  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver (signature-verified)' })
  async webhookStripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Ip() ip: string,
  ) {
    await this.paymentService.handleWebhook(
      GatewayName.STRIPE,
      req.rawBody ?? Buffer.from(''),
      signature ?? '',
      ip,
    );
    return { received: true };
  }
}

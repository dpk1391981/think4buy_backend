import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
  DefaultValuePipe,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { PaymentService } from './payment.service';
import { PaymentConfigService } from './payment-config.service';
import { RefundService } from './refund.service';
import { BillingService } from './billing.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { CreateGatewayDto, UpdateGatewayDto } from './dto/admin-gateway.dto';
import { InitiateRefundDto } from './dto/refund.dto';
import { PaymentStatus } from './entities/payment-transaction.entity';
import { RefundStatus } from './entities/refund.entity';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('admin-payment')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin/payment')
export class PaymentAdminController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: PaymentConfigService,
    private readonly refundService: RefundService,
    private readonly billingService: BillingService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  private assertAdmin(req: any) {
    const role = req.user?.role;
    const ok = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN || req.user?.isSuperAdmin;
    if (!ok) throw new ForbiddenException('Admin access required');
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Payment dashboard stats: revenue, failed, refunds' })
  async getDashboard(@Request() req: any) {
    this.assertAdmin(req);
    const [stats, paymentMode] = await Promise.all([
      this.paymentService.getRevenueStats(),
      this.billingService.isRealPaymentEnabled(),
    ]);
    return { ...stats, paymentEnabled: paymentMode };
  }

  // ─── Payment Mode Toggle ────────────────────────────────────────────────────

  @Get('mode')
  @ApiOperation({ summary: 'Get payment mode status (real money vs token-based)' })
  async getPaymentMode(@Request() req: any) {
    this.assertAdmin(req);
    const [enabled, hasActiveGateway] = await Promise.all([
      this.systemConfig.getBoolean('PAYMENT_ENABLED', false),
      this.billingService.isRealPaymentEnabled(),
    ]);
    return { paymentEnabled: enabled, hasActiveGateway };
  }

  @Patch('mode')
  @ApiOperation({ summary: 'Enable or disable real-money payment mode' })
  async setPaymentMode(@Request() req: any, @Body() body: { enabled: boolean }) {
    this.assertAdmin(req);
    await this.systemConfig.set('PAYMENT_ENABLED', body.enabled, {
      group: 'billing',
      description: 'Enable real-money payments via configured gateway. When false, the platform uses token-based billing.',
    });
    const isActive = await this.billingService.isRealPaymentEnabled();
    return {
      paymentEnabled: body.enabled,
      hasActiveGateway: isActive,
      message: body.enabled
        ? isActive
          ? 'Real-money payments enabled.'
          : 'Flag enabled but no active gateway — configure and activate a gateway.'
        : 'Token-based billing restored.',
    };
  }

  // ─── Transactions ──────────────────────────────────────────────────────────

  @Get('transactions')
  @ApiOperation({ summary: 'List all payment transactions with filters' })
  @ApiQuery({ name: 'status', enum: PaymentStatus, required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async listTransactions(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: PaymentStatus,
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    this.assertAdmin(req);
    return this.paymentService.getAllTransactions(page, limit, status, userId, dateFrom, dateTo);
  }

  @Get('transactions/export')
  @ApiOperation({ summary: 'Export transactions as CSV' })
  async exportTransactions(
    @Request() req: any,
    @Res() res: Response,
    @Query('status') status?: PaymentStatus,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
  ) {
    this.assertAdmin(req);
    const rows = await this.paymentService.exportTransactions(status, dateFrom, dateTo);

    if (format === 'json') {
      return res.json(rows);
    }

    // CSV export
    if (!rows.length) {
      return res.status(204).send();
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(r =>
        headers.map(h => JSON.stringify(r[h] ?? '')).join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transactions_${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.send(csvLines.join('\n'));
  }

  // ─── Webhooks / Logs ───────────────────────────────────────────────────────

  @Get('webhook-logs')
  @ApiOperation({ summary: 'View webhook event logs' })
  async getWebhookLogs(
    @Request() req: any,
    @Query('transactionId') transactionId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
  ) {
    this.assertAdmin(req);
    return this.paymentService.getWebhookLogs(transactionId, page, limit);
  }

  // ─── Refunds ───────────────────────────────────────────────────────────────

  @Post('refunds')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Admin-initiated refund' })
  async initiateRefund(@Request() req: any, @Body() dto: InitiateRefundDto) {
    this.assertAdmin(req);
    return this.refundService.initiateRefund(dto, req.user.id);
  }

  @Get('refunds')
  @ApiOperation({ summary: 'List all refunds' })
  async listRefunds(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: RefundStatus,
  ) {
    this.assertAdmin(req);
    return this.refundService.getAllRefunds(page, limit, status);
  }

  @Get('refunds/transaction/:transactionId')
  @ApiOperation({ summary: 'Get refunds for a specific transaction' })
  async getRefundsByTransaction(
    @Request() req: any,
    @Param('transactionId') transactionId: string,
  ) {
    this.assertAdmin(req);
    return this.refundService.getRefundsByTransaction(transactionId);
  }

  // ─── Gateway Management ────────────────────────────────────────────────────

  @Get('gateways')
  @ApiOperation({ summary: 'List all configured payment gateways (config masked)' })
  async listGateways(@Request() req: any) {
    this.assertAdmin(req);
    return this.configService.listGateways();
  }

  @Get('gateways/:id')
  @ApiOperation({ summary: 'Get a single gateway config (masked)' })
  async getGateway(@Request() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.configService.getGatewayById(id);
  }

  @Post('gateways')
  @ApiOperation({ summary: 'Add a new payment gateway' })
  async createGateway(@Request() req: any, @Body() dto: CreateGatewayDto) {
    this.assertAdmin(req);
    return this.configService.createGateway(dto);
  }

  @Patch('gateways/:id')
  @ApiOperation({ summary: 'Update gateway credentials or settings' })
  async updateGateway(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateGatewayDto,
  ) {
    this.assertAdmin(req);
    return this.configService.updateGateway(id, dto);
  }

  @Post('gateways/:id/activate')
  @ApiOperation({ summary: 'Activate this gateway (deactivates all others)' })
  async activateGateway(@Request() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.configService.activateGateway(id);
  }

  @Post('gateways/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate this gateway' })
  async deactivateGateway(@Request() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.configService.deactivateGateway(id);
  }

  @Delete('gateways/:id')
  @ApiOperation({ summary: 'Delete an inactive gateway' })
  async deleteGateway(@Request() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    await this.configService.deleteGateway(id);
    return { success: true };
  }
}

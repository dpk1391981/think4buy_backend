import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentGateway, GatewayName, GatewayStatus } from '../entities/payment-gateway.entity';
import { CryptoUtil } from '../../../common/utils/crypto.util';
import { RazorpayGateway } from './razorpay.gateway';
import { StripeGateway } from './stripe.gateway';

export interface ActiveGatewayContext {
  gateway: PaymentGateway;
  config: Record<string, any>;
  adapter: RazorpayGateway | StripeGateway;
}

/**
 * GatewayFactoryService — resolves the active payment gateway adapter at runtime.
 *
 * Plug-and-play: new gateways can be added by:
 *   1. Creating a new adapter implementing IPaymentGateway
 *   2. Registering it in the switch statement below
 *   3. Adding credentials via Admin Panel
 */
@Injectable()
export class GatewayFactoryService {
  private readonly logger = new Logger(GatewayFactoryService.name);

  constructor(
    @InjectRepository(PaymentGateway)
    private gatewayRepo: Repository<PaymentGateway>,
    private readonly razorpayGateway: RazorpayGateway,
    private readonly stripeGateway: StripeGateway,
  ) {}

  /** Fetch the highest-priority active gateway and decrypt its config */
  async getActiveGateway(): Promise<ActiveGatewayContext> {
    const gateway = await this.gatewayRepo.findOne({
      where: { status: GatewayStatus.ACTIVE },
      order: { priority: 'ASC' },
    });

    if (!gateway) {
      throw new BadRequestException(
        'No active payment gateway configured. Please contact support.',
      );
    }

    return this.buildContext(gateway);
  }

  /** Resolve a specific gateway by its DB id (e.g., for webhook routing) */
  async getGatewayById(id: string): Promise<ActiveGatewayContext> {
    const gateway = await this.gatewayRepo.findOne({ where: { id } });
    if (!gateway) throw new BadRequestException('Gateway not found');
    return this.buildContext(gateway);
  }

  /** Resolve by gateway name (e.g., from webhook URL path) */
  async getGatewayByName(name: GatewayName): Promise<ActiveGatewayContext> {
    const gateway = await this.gatewayRepo.findOne({ where: { name } });
    if (!gateway) throw new BadRequestException(`Gateway '${name}' not found`);
    return this.buildContext(gateway);
  }

  private buildContext(gateway: PaymentGateway): ActiveGatewayContext {
    let config: Record<string, any>;
    try {
      const decryptedConfig = CryptoUtil.decrypt(gateway.config);
      config = JSON.parse(decryptedConfig);
    } catch {
      this.logger.error(`Failed to parse config for gateway ${gateway.id}`);
      throw new BadRequestException('Gateway configuration error. Please contact support.');
    }

    const adapter = this.resolveAdapter(gateway.name);
    return { gateway, config, adapter };
  }

  private resolveAdapter(name: GatewayName): RazorpayGateway | StripeGateway {
    switch (name) {
      case GatewayName.RAZORPAY: return this.razorpayGateway;
      case GatewayName.STRIPE:   return this.stripeGateway;
      default:
        throw new BadRequestException(`Unsupported gateway: ${name}`);
    }
  }
}

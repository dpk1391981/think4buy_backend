import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentGateway, GatewayStatus } from './entities/payment-gateway.entity';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { CreateGatewayDto, UpdateGatewayDto } from './dto/admin-gateway.dto';

/**
 * PaymentConfigService — manages payment gateway configurations.
 * Enforces:
 *   • Only one gateway active at a time (deactivates others on activation)
 *   • AES-256 encryption of all gateway credentials at rest
 *   • Never returns raw decrypted config outside the payment service
 */
@Injectable()
export class PaymentConfigService {
  private readonly logger = new Logger(PaymentConfigService.name);

  constructor(
    @InjectRepository(PaymentGateway)
    private gatewayRepo: Repository<PaymentGateway>,
  ) {}

  async listGateways(): Promise<Array<Omit<PaymentGateway, 'config'> & { configMasked: Record<string, string> }>> {
    const gateways = await this.gatewayRepo.find({ order: { priority: 'ASC' } });
    return gateways.map(g => this.maskGateway(g));
  }

  async getGatewayById(id: string): Promise<Omit<PaymentGateway, 'config'> & { configMasked: Record<string, string> }> {
    const gateway = await this.gatewayRepo.findOne({ where: { id } });
    if (!gateway) throw new NotFoundException('Payment gateway not found');
    return this.maskGateway(gateway);
  }

  async createGateway(dto: CreateGatewayDto): Promise<PaymentGateway> {
    const existing = await this.gatewayRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Gateway '${dto.name}' already exists. Use update instead.`);

    const encryptedConfig = CryptoUtil.encrypt(JSON.stringify(dto.config));

    const gateway = this.gatewayRepo.create({
      name:        dto.name,
      displayName: dto.displayName,
      status:      GatewayStatus.INACTIVE,
      config:      encryptedConfig,
      priority:    dto.priority ?? 10,
      isTestMode:  dto.isTestMode ?? false,
    });

    const saved = await this.gatewayRepo.save(gateway);
    this.logger.log(`Created payment gateway: ${gateway.name} (id=${saved.id})`);
    return saved;
  }

  async updateGateway(id: string, dto: UpdateGatewayDto): Promise<PaymentGateway> {
    const gateway = await this.gatewayRepo.findOne({ where: { id } });
    if (!gateway) throw new NotFoundException('Payment gateway not found');

    if (dto.config !== undefined) {
      gateway.config = CryptoUtil.encrypt(JSON.stringify(dto.config));
    }
    if (dto.displayName !== undefined) gateway.displayName = dto.displayName;
    if (dto.priority    !== undefined) gateway.priority    = dto.priority;
    if (dto.isTestMode  !== undefined) gateway.isTestMode  = dto.isTestMode;
    if (dto.status      !== undefined) gateway.status      = dto.status;

    const saved = await this.gatewayRepo.save(gateway);
    this.logger.log(`Updated payment gateway: ${gateway.name} (id=${id})`);
    return saved;
  }

  /**
   * Activate a gateway and deactivate all others (single active gateway policy).
   */
  async activateGateway(id: string): Promise<PaymentGateway> {
    const gateway = await this.gatewayRepo.findOne({ where: { id } });
    if (!gateway) throw new NotFoundException('Payment gateway not found');

    // Deactivate all other gateways
    await this.gatewayRepo
      .createQueryBuilder()
      .update(PaymentGateway)
      .set({ status: GatewayStatus.INACTIVE })
      .where('id != :id', { id })
      .execute();

    gateway.status = GatewayStatus.ACTIVE;
    const saved = await this.gatewayRepo.save(gateway);
    this.logger.log(`Activated payment gateway: ${gateway.name} (id=${id})`);
    return saved;
  }

  async deactivateGateway(id: string): Promise<PaymentGateway> {
    const gateway = await this.gatewayRepo.findOne({ where: { id } });
    if (!gateway) throw new NotFoundException('Payment gateway not found');

    gateway.status = GatewayStatus.INACTIVE;
    const saved = await this.gatewayRepo.save(gateway);
    this.logger.log(`Deactivated payment gateway: ${gateway.name} (id=${id})`);
    return saved;
  }

  async deleteGateway(id: string): Promise<void> {
    const gateway = await this.gatewayRepo.findOne({ where: { id } });
    if (!gateway) throw new NotFoundException('Payment gateway not found');
    if (gateway.status === GatewayStatus.ACTIVE) {
      throw new ConflictException('Cannot delete an active gateway. Deactivate it first.');
    }
    await this.gatewayRepo.remove(gateway);
    this.logger.log(`Deleted payment gateway: ${gateway.name} (id=${id})`);
  }

  /** Returns config with values masked (e.g. "rzp_live_•••xyz") */
  private maskGateway(g: PaymentGateway): any {
    let configMasked: Record<string, string> = {};
    try {
      const decrypted = CryptoUtil.decrypt(g.config);
      const raw = JSON.parse(decrypted) as Record<string, string>;
      configMasked = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, CryptoUtil.mask(String(v), 4)]),
      );
    } catch {
      configMasked = {};
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { config: _, ...rest } = g;
    return { ...rest, configMasked };
  }
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum GatewayStatus {
  ACTIVE   = 'active',
  INACTIVE = 'inactive',
}

export enum GatewayName {
  RAZORPAY = 'razorpay',
  STRIPE   = 'stripe',
  PAYPAL   = 'paypal',
}

/**
 * payment_gateways — stores configurable gateway credentials (config is AES-256 encrypted).
 * Admin can add/update/activate/deactivate gateways from the panel.
 * Only ONE gateway should be active at a time (enforced at service level).
 */
@Entity('payment_gateways')
export class PaymentGateway {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Logical key used by GatewayFactory to resolve the correct adapter */
  @Column({ type: 'enum', enum: GatewayName })
  name: GatewayName;

  @Column({ length: 100 })
  displayName: string;

  @Column({ type: 'enum', enum: GatewayStatus, default: GatewayStatus.INACTIVE })
  status: GatewayStatus;

  /**
   * AES-256-GCM encrypted JSON string.
   * Decrypted shape per gateway:
   *   razorpay: { keyId, keySecret, webhookSecret }
   *   stripe:   { publishableKey, secretKey, webhookSecret }
   *   paypal:   { clientId, clientSecret, webhookId }
   */
  @Column({ type: 'text' })
  config: string;

  /** Lower number = higher priority when multiple gateways are active */
  @Column({ type: 'int', default: 10 })
  priority: number;

  /** Switch gateway to sandbox/test mode without changing credentials */
  @Column({ default: false })
  isTestMode: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

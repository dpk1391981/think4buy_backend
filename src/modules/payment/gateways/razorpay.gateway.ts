import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IPaymentGateway,
  CreateOrderInput,
  CreateOrderOutput,
  VerifyPaymentInput,
  RefundInput,
  RefundOutput,
  WebhookVerifyInput,
} from './payment-gateway.interface';

/**
 * Razorpay Gateway Adapter
 * ─────────────────────────
 * Uses the official Razorpay REST API directly via fetch (no SDK dependency).
 * Install SDK optionally: npm install razorpay
 *
 * Razorpay flow:
 *   1. POST /v1/orders → get order_id
 *   2. Frontend opens Razorpay checkout with order_id
 *   3. On success, frontend receives { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *   4. Backend verifies: HMAC-SHA256(order_id + "|" + payment_id, keySecret) == signature
 */
@Injectable()
export class RazorpayGateway implements IPaymentGateway {
  readonly gatewayName = 'razorpay';
  private readonly logger = new Logger(RazorpayGateway.name);

  private buildAuthHeader(keyId: string, keySecret: string): string {
    return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  }

  async createOrder(
    input: CreateOrderInput,
    credentials: { keyId: string; keySecret: string },
  ): Promise<CreateOrderOutput> {
    const amountInPaise = Math.round(input.amount * 100); // Razorpay uses smallest currency unit

    const body = {
      amount: amountInPaise,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40), // Razorpay receipt max 40 chars
      notes: input.notes ?? {},
    };

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.buildAuthHeader(credentials.keyId, credentials.keySecret),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Razorpay createOrder failed: ${err}`);
      throw new BadRequestException('Payment gateway error. Please try again.');
    }

    const order = await response.json() as { id: string; [k: string]: any };

    return {
      gatewayOrderId: order.id,
      clientPayload: {
        key: credentials.keyId,
        amount: amountInPaise,
        currency: input.currency,
        orderId: order.id,
        name: 'Think4BuySale',
        description: input.notes?.description ?? 'Payment',
      },
    };
  }

  verifyPayment(input: VerifyPaymentInput, keySecret: string): boolean {
    const payload = `${input.gatewayOrderId}|${input.gatewayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');
    return expectedSignature === input.gatewaySignature;
  }

  verifyWebhook(input: WebhookVerifyInput): boolean {
    const body = typeof input.rawBody === 'string'
      ? input.rawBody
      : input.rawBody.toString('utf8');

    const expectedSignature = crypto
      .createHmac('sha256', input.secret)
      .update(body)
      .digest('hex');
    return expectedSignature === input.signature;
  }

  async processRefund(
    input: RefundInput,
    credentials: { keyId: string; keySecret: string },
  ): Promise<RefundOutput> {
    const amountInPaise = Math.round(input.amount * 100);

    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${input.gatewayPaymentId}/refund`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.buildAuthHeader(credentials.keyId, credentials.keySecret),
        },
        body: JSON.stringify({
          amount: amountInPaise,
          notes: { reason: input.reason ?? 'Refund requested' },
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Razorpay refund failed: ${err}`);
      throw new BadRequestException('Refund processing failed. Please try again.');
    }

    const refund = await response.json() as { id: string; status: string };

    return {
      gatewayRefundId: refund.id,
      status: refund.status === 'processed' ? 'completed' : 'initiated',
    };
  }
}

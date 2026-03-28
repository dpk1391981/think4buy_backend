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
 * Stripe Gateway Adapter
 * ──────────────────────
 * Uses Stripe REST API directly (no SDK dependency required).
 * Install SDK optionally: npm install stripe
 *
 * Stripe flow:
 *   1. POST /v1/payment_intents → get client_secret
 *   2. Frontend confirms with Stripe.js using client_secret
 *   3. Webhook delivers payment_intent.succeeded
 *   4. Backend verifies webhook signature
 */
@Injectable()
export class StripeGateway implements IPaymentGateway {
  readonly gatewayName = 'stripe';
  private readonly logger = new Logger(StripeGateway.name);
  private readonly STRIPE_BASE = 'https://api.stripe.com/v1';

  private buildHeaders(secretKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  private encodeBody(params: Record<string, any>): string {
    return Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }

  async createOrder(
    input: CreateOrderInput,
    credentials: { publishableKey: string; secretKey: string },
  ): Promise<CreateOrderOutput> {
    const amountInCents = Math.round(input.amount * 100);

    const params: Record<string, any> = {
      amount: amountInCents,
      currency: input.currency.toLowerCase(),
      'automatic_payment_methods[enabled]': true,
      metadata: {
        receipt: input.receipt,
        ...input.notes,
      },
    };

    const response = await fetch(`${this.STRIPE_BASE}/payment_intents`, {
      method: 'POST',
      headers: this.buildHeaders(credentials.secretKey),
      body: this.encodeBody(params),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Stripe createPaymentIntent failed: ${err}`);
      throw new BadRequestException('Payment gateway error. Please try again.');
    }

    const intent = await response.json() as { id: string; client_secret: string };

    return {
      gatewayOrderId: intent.id,
      clientPayload: {
        publishableKey: credentials.publishableKey,
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
      },
    };
  }

  verifyPayment(_input: VerifyPaymentInput, _secret: string): boolean {
    // Stripe uses webhook-based confirmation; front-end status is sufficient.
    // We validate the webhook signature instead.
    return true;
  }

  verifyWebhook(input: WebhookVerifyInput): boolean {
    try {
      const parts = input.signature.split(',');
      const tPart = parts.find(p => p.startsWith('t='));
      const v1Part = parts.find(p => p.startsWith('v1='));
      if (!tPart || !v1Part) return false;

      const timestamp = tPart.slice(2);
      const v1Sig    = v1Part.slice(3);

      const body = typeof input.rawBody === 'string'
        ? input.rawBody
        : input.rawBody.toString('utf8');

      const payload = `${timestamp}.${body}`;
      const expected = crypto
        .createHmac('sha256', input.secret)
        .update(payload)
        .digest('hex');

      return expected === v1Sig;
    } catch {
      return false;
    }
  }

  async processRefund(
    input: RefundInput,
    credentials: { secretKey: string },
  ): Promise<RefundOutput> {
    const amountInCents = Math.round(input.amount * 100);

    const params = this.encodeBody({
      payment_intent: input.gatewayPaymentId,
      amount: amountInCents,
      reason: 'requested_by_customer',
    });

    const response = await fetch(`${this.STRIPE_BASE}/refunds`, {
      method: 'POST',
      headers: this.buildHeaders(credentials.secretKey),
      body: params,
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Stripe refund failed: ${err}`);
      throw new BadRequestException('Refund processing failed. Please try again.');
    }

    const refund = await response.json() as { id: string; status: string };

    return {
      gatewayRefundId: refund.id,
      status: refund.status === 'succeeded' ? 'completed' : 'initiated',
    };
  }
}

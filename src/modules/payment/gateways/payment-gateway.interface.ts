/**
 * Strategy interface for payment gateway adapters.
 * Every gateway (Razorpay, Stripe, PayPal) implements this contract.
 * The GatewayFactoryService resolves the correct implementation at runtime.
 */
export interface CreateOrderInput {
  amount: number;          // in base currency units (e.g. INR paise for Razorpay? No – send rupees, we convert internally)
  currency: string;        // 'INR', 'USD', etc.
  receipt: string;         // our transactionId (used as idempotency reference)
  notes?: Record<string, string>;
}

export interface CreateOrderOutput {
  gatewayOrderId: string;  // e.g. Razorpay order_id or Stripe PaymentIntent id
  clientPayload: Record<string, any>; // data sent to frontend to render checkout
}

export interface VerifyPaymentInput {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string;
}

export interface RefundInput {
  gatewayPaymentId: string;
  amount: number;          // partial refund amount; full if equal to original
  reason?: string;
}

export interface RefundOutput {
  gatewayRefundId: string;
  status: 'initiated' | 'completed';
}

export interface WebhookVerifyInput {
  rawBody: string | Buffer;
  signature: string;
  secret: string;
}

export interface IPaymentGateway {
  /** Human-readable name for logging */
  readonly gatewayName: string;

  /**
   * Create a payment order/intent on the gateway.
   * Returns gateway-specific data the frontend needs to launch checkout.
   * Credentials are decrypted from DB and passed at call-time (not stored on adapter).
   */
  createOrder(input: CreateOrderInput, credentials: Record<string, any>): Promise<CreateOrderOutput>;

  /**
   * Server-side signature verification after frontend payment completion.
   * Throws BadRequestException if signature is invalid.
   */
  verifyPayment(input: VerifyPaymentInput, secret: string): boolean;

  /**
   * Verify that a webhook POST came from the gateway (signature check).
   */
  verifyWebhook(input: WebhookVerifyInput): boolean;

  /**
   * Initiate a refund via the gateway API.
   * Credentials are decrypted from DB and passed at call-time (not stored on adapter).
   */
  processRefund(input: RefundInput, credentials: Record<string, any>): Promise<RefundOutput>;
}

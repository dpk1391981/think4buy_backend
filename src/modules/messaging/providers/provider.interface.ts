export interface SendMessagePayload {
  to: string;          // phone number or email
  subject?: string;   // email only
  body: string;        // rendered message body
  /** Provider-specific template name (for WhatsApp pre-approved templates) */
  providerTemplateName?: string;
  /** Rendered variables array for template-based sends (WhatsApp Meta) */
  templateVariables?: string[];
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IMessagingProvider {
  send(payload: SendMessagePayload, config: Record<string, any>): Promise<SendResult>;
}

import { Injectable, Logger } from '@nestjs/common';
import { IMessagingProvider, SendMessagePayload, SendResult } from './provider.interface';

/**
 * WhatsApp Business API via Meta Graph API.
 * Config: { apiKey: string, phoneNumberId: string }
 * Supports both template-based and free-form messages.
 */
@Injectable()
export class WhatsAppMetaProvider implements IMessagingProvider {
  private readonly logger = new Logger(WhatsAppMetaProvider.name);

  async send(payload: SendMessagePayload, config: Record<string, any>): Promise<SendResult> {
    const { apiKey, phoneNumberId } = config;
    if (!apiKey || !phoneNumberId) {
      return { success: false, error: 'WhatsApp Meta config missing apiKey or phoneNumberId' };
    }

    const phone = payload.to.replace(/\D/g, ''); // strip non-digits
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    let body: Record<string, any>;

    if (payload.providerTemplateName) {
      // Template-based message (pre-approved)
      const components: any[] = [];
      if (payload.templateVariables?.length) {
        components.push({
          type: 'body',
          parameters: payload.templateVariables.map(v => ({ type: 'text', text: v })),
        });
      }
      body = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: payload.providerTemplateName,
          language: { code: 'en_US' },
          ...(components.length > 0 && { components }),
        },
      };
    } else {
      // Free-form text message (only allowed within 24h window)
      body = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: payload.body },
      };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json: any = await res.json();
      if (!res.ok) {
        return { success: false, error: JSON.stringify(json?.error ?? json) };
      }
      const msgId = json?.messages?.[0]?.id;
      return { success: true, messageId: msgId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

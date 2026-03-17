import { Injectable, Logger } from '@nestjs/common';
import { IMessagingProvider, SendMessagePayload, SendResult } from './provider.interface';

/**
 * WhatsApp via Twilio Conversations API.
 * Config: { accountSid: string, authToken: string, from: string }
 * `from` must be in the format: "whatsapp:+1415XXXXXXX"
 */
@Injectable()
export class WhatsAppTwilioProvider implements IMessagingProvider {
  private readonly logger = new Logger(WhatsAppTwilioProvider.name);

  async send(payload: SendMessagePayload, config: Record<string, any>): Promise<SendResult> {
    const { accountSid, authToken, from } = config;
    if (!accountSid || !authToken || !from) {
      return { success: false, error: 'Twilio WhatsApp config missing accountSid, authToken or from' };
    }

    const phone = payload.to.replace(/\D/g, '');
    const to = `whatsapp:+${phone}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
    formData.append('To', to);
    formData.append('Body', payload.body);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });
      const json: any = await res.json();
      if (!res.ok || json.status === 'failed') {
        return { success: false, error: json.message ?? JSON.stringify(json) };
      }
      return { success: true, messageId: json.sid };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { IMessagingProvider, SendMessagePayload, SendResult } from './provider.interface';

/**
 * Generic SMS provider.
 * Supports: msg91, twilio-sms, generic HTTP webhook.
 *
 * Config for msg91:  { authKey, senderId, route? }
 * Config for twilio: { accountSid, authToken, from }
 * Config for generic:{ url, method?, headers?, bodyTemplate? }
 */
@Injectable()
export class SmsProvider implements IMessagingProvider {
  private readonly logger = new Logger(SmsProvider.name);

  async send(payload: SendMessagePayload, config: Record<string, any>): Promise<SendResult> {
    const { type } = config;

    if (type === 'msg91') {
      return this.sendMsg91(payload, config);
    }
    if (type === 'twilio') {
      return this.sendTwilio(payload, config);
    }
    // Fallback: generic webhook
    return this.sendGeneric(payload, config);
  }

  private async sendMsg91(payload: SendMessagePayload, config: Record<string, any>): Promise<SendResult> {
    const { authKey, senderId, templateId, route = '4' } = config;
    if (!authKey || !senderId) {
      return { success: false, error: 'MSG91 config missing authKey or senderId' };
    }
    const phone = payload.to.replace(/\D/g, '');
    const body = {
      sender: senderId,
      route,
      country: '91',
      sms: [{ message: payload.body, to: [phone] }],
      ...(templateId && { template_id: templateId }),
    };
    try {
      const res = await fetch('https://api.msg91.com/api/v2/sendsms', {
        method: 'POST',
        headers: { authkey: authKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json: any = await res.json();
      if (json.type !== 'success') {
        return { success: false, error: JSON.stringify(json) };
      }
      return { success: true, messageId: json.request_id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async sendTwilio(payload: SendMessagePayload, config: Record<string, any>): Promise<SendResult> {
    const { accountSid, authToken, from } = config;
    if (!accountSid || !authToken || !from) {
      return { success: false, error: 'Twilio SMS config missing accountSid, authToken or from' };
    }
    const phone = `+${payload.to.replace(/\D/g, '')}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const form = new URLSearchParams({ From: from, To: phone, Body: payload.body });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      const json: any = await res.json();
      if (!res.ok) return { success: false, error: json.message };
      return { success: true, messageId: json.sid };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async sendGeneric(payload: SendMessagePayload, config: Record<string, any>): Promise<SendResult> {
    const { url, method = 'POST', headers = {}, bodyTemplate } = config;
    if (!url) return { success: false, error: 'Generic SMS config missing url' };
    const body = bodyTemplate
      ? bodyTemplate.replace('{{to}}', payload.to).replace('{{message}}', payload.body)
      : JSON.stringify({ to: payload.to, message: payload.body });
    try {
      const res = await fetch(url, { method, headers, body });
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

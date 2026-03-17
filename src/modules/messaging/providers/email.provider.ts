import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IMessagingProvider, SendMessagePayload, SendResult } from './provider.interface';

/**
 * Email provider supporting SMTP and SendGrid.
 *
 * Config for SMTP:     { type: 'smtp', host, port, secure, user, pass, from }
 * Config for SendGrid: { type: 'sendgrid', apiKey, from }
 */
@Injectable()
export class EmailProvider implements IMessagingProvider {
  private readonly logger = new Logger(EmailProvider.name);

  async send(payload: SendMessagePayload, config: Record<string, any>): Promise<SendResult> {
    if (config.type === 'sendgrid') {
      return this.sendViaSendGrid(payload, config);
    }
    return this.sendViaSMTP(payload, config);
  }

  private async sendViaSMTP(payload: SendMessagePayload, config: Record<string, any>): Promise<SendResult> {
    const { host, port = 587, secure = false, user, pass, from } = config;
    if (!host || !from) {
      return { success: false, error: 'SMTP config missing host or from' };
    }
    try {
      const transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Boolean(secure),
        ...(user && pass && { auth: { user, pass } }),
      });
      const info = await transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject || 'Notification',
        html: payload.body.replace(/\n/g, '<br>'),
        text: payload.body,
      });
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async sendViaSendGrid(payload: SendMessagePayload, config: Record<string, any>): Promise<SendResult> {
    const { apiKey, from } = config;
    if (!apiKey || !from) {
      return { success: false, error: 'SendGrid config missing apiKey or from' };
    }
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }] }],
          from: { email: from },
          subject: payload.subject || 'Notification',
          content: [
            { type: 'text/plain', value: payload.body },
            { type: 'text/html', value: payload.body.replace(/\n/g, '<br>') },
          ],
        }),
      });
      if (res.status !== 202 && res.status !== 200) {
        const txt = await res.text();
        return { success: false, error: txt };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

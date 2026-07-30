import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OutreachChannel } from '@bhavano/types';

export type SendOutcome = { ok: true; providerRef?: string } | { ok: false; error: string };

/**
 * Promotional delivery. Deliberately separate from NotificationsService/Msg91Provider, which
 * carry *transactional* messages (OTP, "your listing was flagged"): in India the two go through
 * different DLT template categories and different consent rules, and conflating them is how a
 * transactional sender ends up blocked for spam.
 *
 * Nothing is sent unless MSG91_MARKETING_ENABLED is explicitly "true" — the runner also defaults
 * every campaign to dryRun, so real messages require two deliberate opt-ins, not one.
 */
@Injectable()
export class OutreachSenderService {
  private readonly logger = new Logger(OutreachSenderService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return this.config.get<string>('MSG91_MARKETING_ENABLED') === 'true';
  }

  async send(
    channel: OutreachChannel,
    to: string,
    body: string,
    dltTemplateId: string | null,
  ): Promise<SendOutcome> {
    if (!this.enabled) {
      return { ok: false, error: 'Marketing sending is disabled (set MSG91_MARKETING_ENABLED=true)' };
    }

    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    if (!authKey) return { ok: false, error: 'MSG91_AUTH_KEY is not configured' };

    try {
      switch (channel) {
        case 'sms':
          return await this.sendSms(authKey, to, body, dltTemplateId);
        case 'whatsapp':
          return await this.sendWhatsApp(authKey, to, body);
        case 'email':
          // Promotional email would go through the existing EmailProvider, but it needs its own
          // unsubscribe-header/list handling to avoid poisoning transactional deliverability —
          // left unimplemented rather than half-done.
          return { ok: false, error: 'Email campaigns are not implemented yet' };
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async sendSms(
    authKey: string,
    to: string,
    body: string,
    dltTemplateId: string | null,
  ): Promise<SendOutcome> {
    if (!dltTemplateId) return { ok: false, error: 'Missing DLT template id' };

    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: dltTemplateId,
        recipients: [{ mobiles: to.replace('+', ''), VAR1: body }],
      }),
    });

    if (!res.ok) return { ok: false, error: `MSG91 ${res.status}: ${await res.text()}` };
    const json = (await res.json().catch(() => ({}))) as { request_id?: string };
    return { ok: true, providerRef: json.request_id };
  }

  private async sendWhatsApp(authKey: string, to: string, body: string): Promise<SendOutcome> {
    const from = this.config.get<string>('MSG91_WHATSAPP_NUMBER');
    if (!from) return { ok: false, error: 'MSG91_WHATSAPP_NUMBER is not configured' };

    const res = await fetch('https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrated_number: from,
        content_type: 'text',
        payload: { to: to.replace('+', ''), type: 'text', text: { body } },
      }),
    });

    if (!res.ok) return { ok: false, error: `MSG91 WhatsApp ${res.status}: ${await res.text()}` };
    return { ok: true };
  }
}

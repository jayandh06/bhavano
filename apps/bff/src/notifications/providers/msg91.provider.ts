import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MSG91 OTP delivery (v5 OTP API). Requires MSG91_AUTH_KEY (and, depending on your
 * account's DLT setup, MSG91_SENDER_ID / MSG91_DLT_TEMPLATE_ID) to actually send SMS —
 * throws until those are configured rather than silently no-op'ing, since a fake success
 * would be worse than a clear "not configured yet" error.
 * Docs: https://docs.msg91.com/reference/send-otp
 */
@Injectable()
export class Msg91Provider {
  private readonly logger = new Logger(Msg91Provider.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    if (!authKey) {
      throw new InternalServerErrorException(
        'MSG91_AUTH_KEY is not configured — set it in apps/bff/.env to enable OTP delivery.',
      );
    }

    const templateId = this.config.get<string>('MSG91_DLT_TEMPLATE_ID');
    const params = new URLSearchParams({
      mobile: `91${phone}`,
      otp: code,
      ...(templateId ? { template_id: templateId } : {}),
    });

    const res = await fetch(
      `https://control.msg91.com/api/v5/otp?${params.toString()}`,
      {
        method: 'POST',
        headers: { authkey: authKey, 'Content-Type': 'application/json' },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new InternalServerErrorException(
        `MSG91 send failed (${res.status}): ${body}`,
      );
    }
  }

  /** Free-form transactional SMS (e.g. "your listing was flagged") — a distinct MSG91 API
   * from OTP delivery, and in India it requires its own DLT-registered template (a
   * regulatory step done in the MSG91 dashboard, not something this code can satisfy) —
   * set MSG91_TRANSACTIONAL_TEMPLATE_ID once that's approved. Best-effort: unlike sendOtp,
   * this is a side effect of a moderation action, not the action itself, so a missing
   * template or a failed send is logged rather than thrown. The approved template is
   * assumed to have a single variable slot (commonly named VAR1) for the message body.
   * Docs: https://docs.msg91.com/reference/send-flow-based-sms */
  async sendTransactionalSms(phone: string, body: string): Promise<void> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    const templateId = this.config.get<string>(
      'MSG91_TRANSACTIONAL_TEMPLATE_ID',
    );
    if (!authKey || !templateId) {
      this.logger.warn(
        `MSG91_AUTH_KEY/MSG91_TRANSACTIONAL_TEMPLATE_ID not configured — skipping SMS to ${phone}: "${body}"`,
      );
      return;
    }

    try {
      const res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { authkey: authKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          short_url: '0',
          recipients: [{ mobiles: `91${phone}`, VAR1: body }],
        }),
      });
      if (!res.ok) {
        const responseBody = await res.text();
        this.logger.error(
          `MSG91 transactional SMS failed (${res.status}): ${responseBody}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${phone}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /** MSG91 WhatsApp Business API — a distinct product from SMS, requires its own registered
   * WhatsApp sender number + an approved message template (MSG91 dashboard, not something this
   * code can satisfy) before real sends work. Best-effort, same as sendTransactionalSms: logs
   * and skips rather than throwing when unconfigured. Verify the exact endpoint/payload shape
   * against MSG91's current WhatsApp API docs (https://docs.msg91.com/whatsapp) before relying
   * on this in production — MSG91's WhatsApp API surface has changed over time. The approved
   * template is assumed to have a single body variable, mirroring sendTransactionalSms's VAR1. */
  async sendWhatsapp(phone: string, body: string): Promise<void> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    const integratedNumber = this.config.get<string>(
      'MSG91_WHATSAPP_INTEGRATED_NUMBER',
    );
    const templateName = this.config.get<string>(
      'MSG91_WHATSAPP_TEMPLATE_NAME',
    );
    if (!authKey || !integratedNumber || !templateName) {
      this.logger.warn(
        `MSG91 WhatsApp not configured (MSG91_WHATSAPP_INTEGRATED_NUMBER/MSG91_WHATSAPP_TEMPLATE_NAME) — skipping WhatsApp to ${phone}: "${body}"`,
      );
      return;
    }

    try {
      const res = await fetch(
        'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
        {
          method: 'POST',
          headers: { authkey: authKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            integrated_number: integratedNumber,
            content_type: 'template',
            payload: {
              messaging_product: 'whatsapp',
              type: 'template',
              template: {
                name: templateName,
                language: { code: 'en' },
                to_and_components: [
                  {
                    to: [`91${phone}`],
                    components: { body_1: { type: 'text', value: body } },
                  },
                ],
              },
            },
          }),
        },
      );
      if (!res.ok) {
        const responseBody = await res.text();
        this.logger.error(
          `MSG91 WhatsApp send failed (${res.status}): ${responseBody}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp to ${phone}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
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

    const res = await fetch(`https://control.msg91.com/api/v5/otp?${params.toString()}`, {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new InternalServerErrorException(`MSG91 send failed (${res.status}): ${body}`);
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
    const templateId = this.config.get<string>('MSG91_TRANSACTIONAL_TEMPLATE_ID');
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
        this.logger.error(`MSG91 transactional SMS failed (${res.status}): ${responseBody}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phone}: ${error instanceof Error ? error.message : error}`);
    }
  }
}

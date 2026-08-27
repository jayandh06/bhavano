import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MSG91 SMS delivery. Requires MSG91_AUTH_KEY (plus MSG91_SENDER_ID / MSG91_DLT_TEMPLATE_ID)
 * to actually send — sendOtp throws until those are configured rather than silently
 * no-op'ing, since a fake success would leave a user waiting for an SMS that never went.
 *
 * NOTE: OTP goes through the **Flow** API (/api/v5/flow/), not the OTP API (/api/v5/otp),
 * even though it is an OTP. MSG91 keeps templates in separate buckets and /api/v5/otp only
 * accepts OTP-type templates; ours ("Bhavano_Login", MSG91 id 6a8ea1aae1638d5a06061ca5) is a
 * Flow/Transactional template, which that endpoint rejects with "Template ID Missing or
 * Invalid Template" no matter what else the request gets right. Nothing depends on the OTP
 * API's own features — we generate and verify codes ourselves — so this is purely a delivery
 * pipe. See docs/plans/msg91-sms-otp-activation.md.
 *
 * Docs: https://docs.msg91.com/reference/send-flow-based-sms
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
    const senderId = this.config.get<string>('MSG91_SENDER_ID');
    // Key on the recipient must match the template's placeholder — ##otp## -> "otp".
    const otpVarName = this.config.get<string>('MSG91_OTP_VAR_NAME') ?? 'otp';

    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(templateId ? { template_id: templateId } : {}),
        short_url: '0',
        ...(senderId ? { sender: senderId } : {}),
        recipients: [{ mobiles: `91${phone}`, [otpVarName]: code }],
      }),
    });

    // MSG91 answers 200 with {"type":"error"} for template and sender problems, so the status
    // code alone is not the outcome — this cost a long debugging session to learn. Note it is
    // still not the *delivery* outcome: an unwhitelisted IP also returns 200/success here and
    // is only visible in MSG91's own SMS logs.
    const body = await res.text();
    if (!res.ok || body.includes('"error"')) {
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

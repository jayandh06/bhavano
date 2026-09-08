import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** The image header component on the "bhavano_welcome_2" WhatsApp template — see
 * sendWhatsappTemplate's doc comment. Not worth a config var: it's the site logo, not a secret
 * or environment-dependent value. */
const WELCOME_HEADER_IMAGE_URL = 'https://www.bhavano.com/logo.png';

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

  /** WhatsApp via MSG91 — a distinct product/endpoint from the SMS APIs above, currently used
   * only for the first-time mobile-app-signup welcome message (see AuthService.welcomeIfFirstLogin
   * and docs/plans/whatsapp-welcome-mobile-signups.md). Requires a WhatsApp Business template
   * created and approved in the MSG91 dashboard first — that's a manual, human-only step, not
   * something this code can satisfy, so this degrades to a logged no-op (like
   * sendTransactionalSms above) rather than throwing, until MSG91_WHATSAPP_INTEGRATED_NUMBER /
   * MSG91_WHATSAPP_TEMPLATE_NAME / MSG91_WHATSAPP_NAMESPACE are all set (INTEGRATED_NUMBER and
   * TEMPLATE_NAME were already scaffolded in .env.production.example back on 2026-07-22, well
   * before this was actually built — matching their names here rather than inventing new ones).
   *
   * The exact request shape below — namespace required, and the body variable keyed
   * "body_name"/"parameter_name" rather than a plain positional or name-matched key — is copied
   * verbatim from the "Code" snippet MSG91's own dashboard generates for this specific approved
   * template (Templates -> bhavano_welcome_2 -> Code), after two guesses based on generic docs
   * examples both failed against real sends: a positional "body_1" key ("Parameter name is
   * missing or empty"), then a plain "name" key (Meta error #132000, "number of localizable_params
   * (0) does not match the expected number of params (1)" — neither guess was recognized as
   * populating the template's one variable at all). Trust the dashboard snippet over any generic
   * docs example for any future template this account adds.
   *
   * The template also has an image header component, previously unknown — WELCOME_HEADER_IMAGE_URL
   * below, the site logo. WhatsApp templates can't omit a defined component, so this always sends
   * with it even though the welcome message itself is really about the body text.
   *
   * Docs: https://docs.msg91.com/whatsapp */
  async sendWhatsappTemplate(phone: string, name: string): Promise<boolean> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    const integratedNumber = this.config.get<string>(
      'MSG91_WHATSAPP_INTEGRATED_NUMBER',
    );
    const template = this.config.get<string>('MSG91_WHATSAPP_TEMPLATE_NAME');
    const namespace = this.config.get<string>('MSG91_WHATSAPP_NAMESPACE');
    if (!authKey || !integratedNumber || !template || !namespace) {
      this.logger.warn(
        `MSG91 WhatsApp not configured (MSG91_WHATSAPP_INTEGRATED_NUMBER/` +
          `MSG91_WHATSAPP_TEMPLATE_NAME/MSG91_WHATSAPP_NAMESPACE) — skipping WhatsApp welcome to ${phone}`,
      );
      return false;
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
                name: template,
                language: { code: 'en', policy: 'deterministic' },
                namespace,
                to_and_components: [
                  {
                    to: [`91${phone}`],
                    components: {
                      header_1: {
                        type: 'image',
                        value: WELCOME_HEADER_IMAGE_URL,
                      },
                      body_name: {
                        type: 'text',
                        value: name,
                        parameter_name: 'name',
                      },
                    },
                  },
                ],
              },
            },
          }),
        },
      );
      const responseBody = await res.text();
      if (!res.ok || responseBody.includes('"error"')) {
        this.logger.error(
          `MSG91 WhatsApp send failed (${res.status}): ${responseBody}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp welcome to ${phone}: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }

  /** WhatsApp via MSG91 — the ad-posted-confirmation notification (see
   * NotificationsService.notifyListingPosted), sent once an advertiser's listing goes live.
   * Reuses the welcome template's integrated number and namespace above (one WABA account
   * shared across templates); only the template name is specific to this notification —
   * MSG91_WHATSAPP_AD_POSTED_TEMPLATE_NAME = "ad_posted_confirmation".
   *
   * Four named body variables (name, title1, title2, location — the approved template repeats
   * the listing title twice in its own wording, so both map to the same value) plus one dynamic
   * URL button variable, in the exact shape MSG91's dashboard "Code" snippet gives for this
   * template — same lesson as sendWhatsappTemplate above: trust that snippet over a generic
   * docs example.
   *
   * Returns the id MSG91's response carries for this specific send, so a later delivery/read
   * status webhook (WhatsappWebhookController) can correlate back to it — see
   * ListingNotificationLog.providerMessageId's own doc comment. Confirmed against a real send on
   * 2026-09-08: the bulk endpoint's success response is
   * `{"status":"success","hasError":false,"data":"...","errors":null,"request_id":"<id>"}` —
   * `request_id` is the value that shows back up as `requestId` on the matching webhook event. */
  async sendAdPostedConfirmation(
    phone: string,
    vars: { name: string; title1: string; title2: string; location: string },
    buttonUrlSuffix: string,
  ): Promise<{ sent: boolean; messageId: string | null }> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    const integratedNumber = this.config.get<string>(
      'MSG91_WHATSAPP_INTEGRATED_NUMBER',
    );
    const template = this.config.get<string>(
      'MSG91_WHATSAPP_AD_POSTED_TEMPLATE_NAME',
    );
    const namespace = this.config.get<string>('MSG91_WHATSAPP_NAMESPACE');
    if (!authKey || !integratedNumber || !template || !namespace) {
      this.logger.warn(
        `MSG91 WhatsApp not configured (MSG91_WHATSAPP_INTEGRATED_NUMBER/` +
          `MSG91_WHATSAPP_AD_POSTED_TEMPLATE_NAME/MSG91_WHATSAPP_NAMESPACE) — skipping ad-posted WhatsApp to ${phone}`,
      );
      return { sent: false, messageId: null };
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
                name: template,
                language: { code: 'en', policy: 'deterministic' },
                namespace,
                to_and_components: [
                  {
                    to: [`91${phone}`],
                    components: {
                      body_name: {
                        type: 'text',
                        value: vars.name,
                        parameter_name: 'name',
                      },
                      body_title1: {
                        type: 'text',
                        value: vars.title1,
                        parameter_name: 'title1',
                      },
                      body_title2: {
                        type: 'text',
                        value: vars.title2,
                        parameter_name: 'title2',
                      },
                      body_location: {
                        type: 'text',
                        value: vars.location,
                        parameter_name: 'location',
                      },
                      button_1: {
                        subtype: 'url',
                        type: 'text',
                        value: buttonUrlSuffix,
                      },
                    },
                  },
                ],
              },
            },
          }),
        },
      );
      const responseBody = await res.text();
      if (!res.ok || responseBody.includes('"error"')) {
        this.logger.error(
          `MSG91 WhatsApp ad-posted send failed (${res.status}): ${responseBody}`,
        );
        return { sent: false, messageId: null };
      }
      // Logged at info level deliberately, not debug — this is the one real response this
      // codebase has on hand so far for extractMessageId (and WhatsappWebhookController's own
      // status-shape guess) to be checked against and corrected from.
      this.logger.log(`MSG91 WhatsApp ad-posted send response: ${responseBody}`);
      return { sent: true, messageId: this.extractMessageId(responseBody) };
    } catch (error) {
      this.logger.error(
        `Failed to send ad-posted WhatsApp to ${phone}: ${error instanceof Error ? error.message : error}`,
      );
      return { sent: false, messageId: null };
    }
  }

  /** Where MSG91 puts this send's id, confirmed against a real bulk-send response on 2026-09-08
   * (see sendAdPostedConfirmation's own comment for the exact shape) — `request_id` at the top
   * level. Returns null rather than throwing on anything unexpected (a differently-shaped
   * response some future MSG91 change might send): a missing id just means the later webhook
   * won't correlate to this send, not that the send itself failed. */
  private extractMessageId(responseBody: string): string | null {
    try {
      const parsed = JSON.parse(responseBody) as Record<string, unknown>;
      return typeof parsed.request_id === 'string' && parsed.request_id.length > 0
        ? parsed.request_id
        : null;
    } catch {
      return null;
    }
  }
}

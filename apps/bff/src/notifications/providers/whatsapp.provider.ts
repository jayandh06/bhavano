import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Graph API version pinned rather than floating: Meta deprecates versions on a schedule, and a
 * silently-shifting default is how a working integration breaks on a date nobody wrote down. */
const DEFAULT_API_VERSION = 'v23.0';
const DEFAULT_TEMPLATE_LANGUAGE = 'en';

/**
 * WhatsApp Business messages via Meta's Cloud API, called directly rather than through MSG91.
 *
 * Direct because it is the primary source: no reseller in the path to add markup, lag a Graph API
 * version behind, or reshape a payload. The MSG91 WhatsApp wrapper this replaces was written
 * against docs and never sent a single message in production.
 *
 * Two identifiers are easy to confuse and only one works here. The endpoint takes the **Phone
 * Number ID** — the id of the sending number — not the WhatsApp Business Account (WABA) id that
 * owns it. A WABA id in WHATSAPP_PHONE_NUMBER_ID fails with an unhelpful "object does not exist"
 * style error, so that is the first thing to check when a send 400s.
 *
 * Best-effort by design: unconfigured logs and skips, a failed send logs and returns. Callers are
 * fire-and-forget notification paths, and none of them should fail a user's real action because a
 * message could not be delivered.
 */
@Injectable()
export class WhatsappProvider {
  private readonly logger = new Logger(WhatsappProvider.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(
      this.config.get<string>('WHATSAPP_ACCESS_TOKEN') &&
      this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'),
    );
  }

  /**
   * Sends an approved template to a WhatsApp user.
   *
   * A template, not free text, because this is business-initiated. WhatsApp only permits free-form
   * messages inside the 24-hour window opened by the user messaging first; outside it — which is
   * every case here — the message must be a template Meta has approved in advance.
   *
   * `bodyParams` accepts either parameter style, because a template is fixed to one of them at
   * creation and cannot be converted afterwards:
   *
   * - **an array** for positional templates (`{{1}}`, `{{2}}`…), filled in order;
   * - **an object** for named templates (`{{name}}`, `{{title}}`…), keyed by parameter name.
   *
   * Named is worth preferring for anything with more than two variables. Positional order is
   * invisible from the template text, so reordering `{{2}}` and `{{3}}` in WhatsApp Manager
   * silently starts sending the title where the link should go, with nothing failing. Named
   * parameters cannot be misaligned that way.
   *
   * Either way the set must match the approved template exactly — a missing or unexpected
   * parameter is a 400, not a partial send.
   *
   * `buttonUrlSuffix` fills a dynamic URL button's one variable — the part of the link that
   * comes after whatever fixed prefix the template's button was created with (see
   * `whatsapp_create_listing_posted_template.py`'s `BUTTON_URL_BASE` for the matching prefix on
   * that side). Meta's dynamic URL buttons take exactly one, always positional — never named,
   * unlike the body — so this is a plain string, not part of `bodyParams`. Omit it entirely for
   * a template with no button, or one whose button is a fixed URL with nothing to fill.
   */
  async sendTemplate(
    phone: string,
    templateName: string,
    bodyParams: string[] | Record<string, string> = [],
    buttonUrlSuffix?: string,
  ): Promise<boolean> {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneNumberId) {
      this.logger.warn(
        `WhatsApp not configured (WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID) — skipping "${templateName}" to ${phone}`,
      );
      return false;
    }

    const version =
      this.config.get<string>('WHATSAPP_API_VERSION') ?? DEFAULT_API_VERSION;
    const language =
      this.config.get<string>('WHATSAPP_TEMPLATE_LANGUAGE') ??
      DEFAULT_TEMPLATE_LANGUAGE;

    // E.164 without the leading "+". Callers store bare 10-digit Indian numbers, the same
    // assumption msg91.provider.ts makes when it prefixes 91.
    const to =
      phone.startsWith('91') && phone.length > 10 ? phone : `91${phone}`;

    // Named parameters carry `parameter_name` alongside the value; positional ones are matched
    // by array order and must not carry it. Meta rejects the wrong shape for the template's
    // declared style rather than coercing between them.
    const parameters = Array.isArray(bodyParams)
      ? bodyParams.map((text) => ({ type: 'text' as const, text }))
      : Object.entries(bodyParams).map(([name, text]) => ({
          type: 'text' as const,
          parameter_name: name,
          text,
        }));

    try {
      const res = await fetch(
        `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'template',
            template: {
              name: templateName,
              language: { code: language },
              // Omit `components` entirely for a template with neither body variables nor a
              // button to fill — an empty components array is rejected the same way an empty
              // body component is, rather than being ignored as "nothing to fill in".
              ...(parameters.length > 0 || buttonUrlSuffix !== undefined
                ? {
                    components: [
                      ...(parameters.length > 0
                        ? [{ type: 'body', parameters }]
                        : []),
                      ...(buttonUrlSuffix !== undefined
                        ? [
                            {
                              type: 'button',
                              sub_type: 'url',
                              // "0" — the button's position among the template's own buttons,
                              // not a magic constant tied to this call. Every template built by
                              // this codebase so far has exactly one button, so this has never
                              // needed to vary; a second-button template would need the caller
                              // to say which index it means.
                              index: '0',
                              parameters: [
                                { type: 'text', text: buttonUrlSuffix },
                              ],
                            },
                          ]
                        : []),
                    ],
                  }
                : {}),
            },
          }),
        },
      );

      if (!res.ok) {
        // Meta's error body names the actual cause (expired token, unapproved template, wrong
        // id, number not on WhatsApp) and is far more useful than the status alone.
        const body = await res.text();
        this.logger.error(
          `WhatsApp send failed (${res.status}) for "${templateName}" to ${phone}: ${body}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        `WhatsApp send threw for "${templateName}" to ${phone}: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }
}

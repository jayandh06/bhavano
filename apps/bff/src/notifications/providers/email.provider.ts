import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailOptions {
  /** Where a reply should go, when that isn't the from-address — e.g. support tickets, so
   * support can just hit Reply and reach the reporter. */
  replyTo?: string;
  attachments?: EmailAttachment[];
  /** Branded HTML alternative, built by `renderEmail`. The `text` argument stays mandatory and
   * is sent alongside it: a message with no text/plain part scores worse with spam filters and
   * is unreadable in clients that prefer text, so HTML is an addition, never a replacement. */
  html?: string;
}

/**
 * Outbound email over Zoho Mail's SMTP.
 *
 * SMTP rather than a transactional email API because bhavano.com's mail already lives in Zoho —
 * the MX records and the `include:zohomail.com` SPF are in place, so sending through the same
 * provider needs no DNS changes and no second vendor.
 *
 * SMTP_PASS must be a Zoho **app-specific password** (Zoho Mail → Settings → Security → App
 * Passwords), not the account password: Zoho rejects the account password for SMTP whenever 2FA
 * is on.
 *
 * SMTP_HOST is configurable because Zoho's host is data-centre specific — `smtp.zoho.com` for
 * the global DC, `smtp.zoho.in` for India, `smtp.zoho.eu` for Europe. Using the wrong one fails
 * authentication with a misleading credentials error.
 *
 * Note Zoho Mail is a mailbox product, so its SMTP carries a daily send cap in the hundreds.
 * That comfortably covers support tickets and moderation notices; if saved-search alerts ever
 * grow into bulk volume, this wants moving to a transactional service (ZeptoMail is Zoho's).
 */
@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 465);

    this.from =
      this.config.get<string>('SMTP_FROM') ?? 'Bhavano <support@bhavano.com>';

    this.transporter =
      host && user && pass
        ? createTransport({
            host,
            port,
            // 465 is implicit TLS; 587 upgrades via STARTTLS after connecting.
            secure: port === 465,
            auth: { user, pass },
          })
        : null;
  }

  /** Best-effort — notifications are a side effect of moderation actions, not the action
   * itself, so a missing/failed send is logged rather than thrown (unlike OTP delivery,
   * where the caller genuinely can't proceed without it).
   *
   * Returns whether the send actually happened, for the callers that need to record it
   * (support tickets persist the report first and flag whether support was notified) — existing
   * callers can keep ignoring the result. */
  async send(
    to: string,
    subject: string,
    text: string,
    options?: SendEmailOptions,
  ): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS) — skipping email to ${to}: "${subject}"`,
      );
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        ...(options?.html && { html: options.html }),
        ...(options?.replyTo && { replyTo: options.replyTo }),
        ...(options?.attachments?.length && {
          attachments: options.attachments,
        }),
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }
}

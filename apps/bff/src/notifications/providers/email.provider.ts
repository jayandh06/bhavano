import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailOptions {
  /** Where a reply should go, when that isn't the from-address — e.g. support tickets, so
   * support can just hit Reply and reach the reporter. */
  replyTo?: string;
  attachments?: EmailAttachment[];
}

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  /** Best-effort — notifications are a side effect of moderation actions, not the action
   * itself, so a missing/failed send is logged rather than thrown (unlike OTP delivery,
   * where the caller genuinely can't proceed without it).
   *
   * Returns whether the send actually happened, for the callers that need to record it
   * (support tickets persist the report first and flag whether support was notified) — existing
   * callers can keep ignoring the result. */
  async send(to: string, subject: string, text: string, options?: SendEmailOptions): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY is not configured — skipping email to ${to}: "${subject}"`);
      return false;
    }

    const from = this.config.get<string>('RESEND_FROM_EMAIL') ?? 'Bhavano <onboarding@resend.dev>';
    try {
      await this.resend.emails.send({
        from,
        to,
        subject,
        text,
        ...(options?.replyTo && { replyTo: options.replyTo }),
        ...(options?.attachments?.length && { attachments: options.attachments }),
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }
}

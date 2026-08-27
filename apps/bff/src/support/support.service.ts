import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { LEGAL_ENTITY } from '@bhavano/types/legalEntity';
import { CONTACT_TOPIC_LABELS } from '@bhavano/types/support';
import type { ContactTopic } from '@bhavano/types/support';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProvider } from '../notifications/providers/email.provider';
import { R2StorageService } from '../storage/r2-storage.service';
import { attachmentKey, type ProcessedAttachment } from './support-attachments';

export interface SubmitTicketArgs {
  topic: ContactTopic;
  name: string;
  email: string;
  phone?: string;
  listingUrl?: string;
  paymentId?: string;
  message: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  attachments: ProcessedAttachment[];
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailProvider,
    private readonly storage: R2StorageService,
  ) {}

  async submit(args: SubmitTicketArgs): Promise<{ ticketId: string }> {
    // Written before the email is attempted, on purpose: EmailProvider.send() logs and returns
    // on failure rather than throwing, so an email-only path would drop reports silently.
    const ticket = await this.prisma.supportTicket.create({
      data: {
        topic: args.topic,
        name: args.name,
        email: args.email,
        phone: args.phone,
        listingUrl: args.listingUrl,
        paymentId: args.paymentId,
        message: args.message,
        userId: args.userId,
        userAgent: args.userAgent?.slice(0, 500),
        ipHash: args.ip
          ? createHash('sha256').update(args.ip).digest('hex')
          : undefined,
      },
    });

    await this.persistAttachments(ticket.id, args.attachments);

    const sent = await this.notifySupport(ticket.id, args);
    if (sent) {
      await this.prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { emailSent: true },
      });
    }

    return { ticketId: ticket.id };
  }

  /** R2 write failures are logged, not thrown — the ticket text is the valuable part, and losing
   * a screenshot is not worth failing a support request the user may not be able to re-send. */
  private async persistAttachments(
    ticketId: string,
    attachments: ProcessedAttachment[],
  ): Promise<void> {
    for (const [index, attachment] of attachments.entries()) {
      const key = attachmentKey(ticketId, index);
      try {
        await this.storage.putObject(
          key,
          attachment.buffer,
          attachment.mimeType,
        );
        await this.prisma.supportAttachment.create({
          data: {
            ticketId,
            r2Key: key,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            bytes: attachment.bytes,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to store attachment ${key}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  private async notifySupport(
    ticketId: string,
    args: SubmitTicketArgs,
  ): Promise<boolean> {
    const lines = [
      `Topic:      ${CONTACT_TOPIC_LABELS[args.topic]}`,
      `From:       ${args.name} <${args.email}>`,
      args.phone ? `Phone:      ${args.phone}` : null,
      args.userId
        ? `User ID:    ${args.userId}`
        : 'User ID:    (not logged in)',
      args.listingUrl ? `Listing:    ${args.listingUrl}` : null,
      args.paymentId ? `Payment ID: ${args.paymentId}` : null,
      `Ticket ID:  ${ticketId}`,
      args.attachments.length
        ? `Attached:   ${args.attachments.length} image(s)`
        : null,
      '',
      args.message,
    ].filter((line): line is string => line !== null);

    return this.email.send(
      LEGAL_ENTITY.supportEmail,
      `[Bhavano support] ${CONTACT_TOPIC_LABELS[args.topic]} — ${args.name}`,
      lines.join('\n'),
      {
        replyTo: args.email,
        attachments: args.attachments.map((a) => ({
          filename: a.filename,
          content: a.buffer,
        })),
      },
    );
  }
}

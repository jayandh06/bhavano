import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MIN_DWELL_MS,
} from '@bhavano/types/support';
import type { CreateSupportTicketResponse } from '@bhavano/types/support';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { processAttachments } from './support-attachments';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  /** Deliberately unauthenticated: "I can't log in" is one of the topics, so requiring a session
   * would exclude the people who most need this. That makes the three guards below load-bearing
   * — throttling, the honeypot, and the dwell check — in preference to a CAPTCHA, which costs
   * real completion rate and would add a third-party script to a page kept lean for SEO. */
  @Post('tickets')
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_ATTACHMENTS, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_BYTES, files: MAX_ATTACHMENTS },
    }),
  )
  async createTicket(
    @Body() dto: CreateSupportTicketDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Req() req: Request,
  ): Promise<CreateSupportTicketResponse> {
    // Bot signals. Both answer 201 with a throwaway id rather than an error: telling a bot which
    // check it tripped just tells it what to change. A real user never reaches either branch.
    const dwell = Number(dto.dwellMs ?? 0);
    if (
      dto.website ||
      (Number.isFinite(dwell) && dwell > 0 && dwell < MIN_DWELL_MS)
    ) {
      return { ticketId: 'discarded' };
    }

    const attachments = await processAttachments(files ?? []);

    if (!dto.message.trim())
      throw new BadRequestException('message is required');

    return this.support.submit({
      topic: dto.topic,
      name: dto.name.trim(),
      email: dto.email.trim(),
      phone: dto.phone,
      listingUrl: dto.listingUrl?.trim() || undefined,
      paymentId: dto.paymentId?.trim() || undefined,
      message: dto.message.trim(),
      userId: dto.userId,
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
      attachments,
    });
  }
}

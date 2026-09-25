import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type {
  ConversationDetailDto,
  ConversationSummaryDto,
  MessageDto,
  SendFirstMessageResponseDto,
  UnreadCountDto,
} from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { PushService } from '../push/push.service';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { SendFirstMessageDto } from './dto/send-first-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('conversations')
@UseGuards(AuthGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly gateway: MessagingGateway,
    private readonly push: PushService,
  ) {}

  /** Starts a conversation and sends its first message atomically — see
   * MessagingService.sendFirstMessage's own doc for why this replaced a separate "create
   * conversation" step. Static "messages" segment, so it can't collide with `:id/messages` below
   * (different segment count) or `:id` (different path shape entirely). */
  @Post('messages')
  async sendFirstMessage(
    @Body() dto: SendFirstMessageDto,
    @CurrentUser() user: RequestUser,
  ): Promise<SendFirstMessageResponseDto> {
    const { conversationId, message, recipientId, senderName, listingTitle } =
      await this.messagingService.sendFirstMessage(dto.listingId, user.id, dto.body);
    this.gateway.broadcastMessage(conversationId, message);

    // Realtime badge + mobile push share one unread fetch so the iOS badge on the push matches
    // the in-app count the socket also delivers.
    void this.messagingService
      .getUnreadTotal(recipientId)
      .then((unreadCount) => {
        this.gateway.notifyUnread(recipientId, { conversationId, unreadCount });
        return this.push.notifyNewMessage(recipientId, message, senderName, {
          unreadCount,
          listingTitle,
        });
      })
      .catch(() => undefined);

    return { conversationId, message };
  }

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<ConversationSummaryDto[]> {
    return this.messagingService.listConversations(user.id);
  }

  /** MUST stay above `@Get(':id')` — same segment count, so a later declaration would let `:id`
   * capture "unread-count" instead. */
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: RequestUser): Promise<UnreadCountDto> {
    return { count: await this.messagingService.getUnreadTotal(user.id) };
  }

  /** Declared before `:id/messages` only for readability — Nest matches the fuller path first
   * either way, so this cannot shadow it. */
  @Get(':id')
  getConversation(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<ConversationDetailDto> {
    return this.messagingService.getConversation(id, user.id);
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<MessageDto[]> {
    return this.messagingService.getMessages(id, user.id);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: RequestUser,
  ): Promise<MessageDto> {
    const { message, recipientId, senderName, listingTitle } = await this.messagingService.sendMessage(
      id,
      user.id,
      dto.body,
    );
    this.gateway.broadcastMessage(id, message);

    // Realtime badge for the recipient's open clients, and a mobile push for the ones that
    // aren't. Both best-effort: a failure here must not fail the send the user just made.
    // One unread fetch feeds both so the push's iOS `badge` matches the socket update.
    void this.messagingService
      .getUnreadTotal(recipientId)
      .then((unreadCount) => {
        this.gateway.notifyUnread(recipientId, { conversationId: id, unreadCount });
        return this.push.notifyNewMessage(recipientId, message, senderName, {
          unreadCount,
          listingTitle,
        });
      })
      .catch(() => undefined);

    return message;
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    await this.messagingService.markRead(id, user.id);
    // Clears/decrements the badge on this user's *other* devices and tabs.
    const unreadCount = await this.messagingService.getUnreadTotal(user.id);
    this.gateway.notifyUnread(user.id, { conversationId: id, unreadCount });
  }
}

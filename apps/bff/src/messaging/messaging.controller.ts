import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type {
  ConversationDetailDto,
  ConversationSummaryDto,
  MessageDto,
  UnreadCountDto,
} from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { PushService } from '../push/push.service';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('conversations')
@UseGuards(AuthGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly gateway: MessagingGateway,
    private readonly push: PushService,
  ) {}

  @Post()
  create(@Body() dto: CreateConversationDto, @CurrentUser() user: RequestUser): Promise<{ id: string }> {
    return this.messagingService.createOrGetConversation(dto.listingId, user.id);
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
    const { message, recipientId, senderName } = await this.messagingService.sendMessage(
      id,
      user.id,
      dto.body,
    );
    this.gateway.broadcastMessage(id, message);

    // Realtime badge for the recipient's open clients, and a mobile push for the ones that
    // aren't. Both best-effort: a failure here must not fail the send the user just made.
    void this.messagingService
      .getUnreadTotal(recipientId)
      .then((unreadCount) =>
        this.gateway.notifyUnread(recipientId, { conversationId: id, unreadCount }),
      )
      .catch(() => undefined);
    void this.push.notifyNewMessage(recipientId, message, senderName).catch(() => undefined);

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

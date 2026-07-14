import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { ConversationSummaryDto, MessageDto } from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
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
  ) {}

  @Post()
  create(@Body() dto: CreateConversationDto, @CurrentUser() user: RequestUser): Promise<{ id: string }> {
    return this.messagingService.createOrGetConversation(dto.listingId, user.id);
  }

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<ConversationSummaryDto[]> {
    return this.messagingService.listConversations(user.id);
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
    const message = await this.messagingService.sendMessage(id, user.id, dto.body);
    this.gateway.broadcastMessage(id, message);
    return message;
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.messagingService.markRead(id, user.id);
  }
}

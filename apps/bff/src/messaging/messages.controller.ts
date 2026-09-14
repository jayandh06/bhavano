import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import type { MessageDto } from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';

/** Top-level `/messages/:id` — separate from MessagingController, which is fixed at the
 * `/conversations` prefix. */
@Controller('messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly gateway: MessagingGateway,
  ) {}

  @Delete(':id')
  async deleteMessage(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<MessageDto> {
    const { message, conversationId } = await this.messagingService.deleteMessage(id, user.id);
    this.gateway.broadcastMessageDeleted(conversationId, {
      messageId: message.id,
      conversationId,
      deletedAt: message.deletedAt!,
    });
    return message;
  }
}

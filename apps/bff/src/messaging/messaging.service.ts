import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConversationSummaryDto, MessageDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import type { Conversation, Message } from '@prisma/client';

function toMessageDto(message: Message): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
  };
}

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGetConversation(listingId: string, inquirerId: string): Promise<Conversation> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId === inquirerId) {
      throw new BadRequestException("You can't message yourself about your own listing");
    }

    return this.prisma.conversation.upsert({
      where: { listingId_inquirerId: { listingId, inquirerId } },
      update: {},
      create: { listingId, inquirerId, posterId: listing.ownerId },
    });
  }

  async listConversations(userId: string): Promise<ConversationSummaryDto[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ posterId: userId }, { inquirerId: userId }] },
      include: {
        listing: { select: { title: true } },
        poster: { select: { id: true, name: true, phone: true } },
        inquirer: { select: { id: true, name: true, phone: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      conversations.map(async (c) => {
        const otherParty = c.posterId === userId ? c.inquirer : c.poster;
        const unreadCount = await this.prisma.message.count({
          where: { conversationId: c.id, senderId: { not: userId }, readAt: null },
        });
        return {
          id: c.id,
          listingId: c.listingId,
          listingTitle: c.listing.title,
          otherPartyId: otherParty.id,
          otherPartyName: otherParty.name ?? otherParty.phone ?? 'User',
          lastMessage: c.messages[0] ? toMessageDto(c.messages[0]) : null,
          unreadCount,
        };
      }),
    );
  }

  async getMessages(conversationId: string, userId: string): Promise<MessageDto[]> {
    await this.assertParticipant(conversationId, userId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(toMessageDto);
  }

  async sendMessage(conversationId: string, senderId: string, body: string): Promise<MessageDto> {
    await this.assertParticipant(conversationId, senderId);
    const message = await this.prisma.message.create({ data: { conversationId, senderId, body } });
    return toMessageDto(message);
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private async assertParticipant(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.posterId !== userId && conversation.inquirerId !== userId) {
      throw new ForbiddenException('Not a participant in this conversation');
    }
    return conversation;
  }
}

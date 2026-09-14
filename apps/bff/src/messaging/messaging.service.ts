import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminConversationsPage,
  ConversationDetailDto,
  ConversationSummaryDto,
  MessageDto,
} from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import type { Conversation, Message, Prisma } from '@prisma/client';

function toMessageDto(message: Message, opts: { revealDeletedBody?: boolean } = {}): MessageDto {
  const isDeleted = message.deletedAt != null;
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: isDeleted && !opts.revealDeletedBody ? null : message.body,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Starting a conversation and sending its first message are one atomic step — there is no
   * "empty conversation" state a buyer can leave behind just by tapping Contact owner. Buyer-only
   * by construction (the ownerId === senderId guard below): a seller only ever replies on an
   * already-existing conversation via sendMessage. */
  async sendFirstMessage(
    listingId: string,
    senderId: string,
    body: string,
  ): Promise<{ conversationId: string; message: MessageDto; recipientId: string; senderName: string }> {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: listingId } });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.ownerId === senderId) {
        throw new BadRequestException("You can't message yourself about your own listing");
      }

      const conversation = await tx.conversation.upsert({
        where: { listingId_inquirerId_type: { listingId, inquirerId: senderId, type: 'inquiry' } },
        update: {},
        create: { listingId, inquirerId: senderId, posterId: listing.ownerId, type: 'inquiry' },
      });
      const [message, sender] = await Promise.all([
        tx.message.create({ data: { conversationId: conversation.id, senderId, body } }),
        tx.user.findUnique({ where: { id: senderId }, select: { name: true } }),
      ]);
      return {
        conversationId: conversation.id,
        message: toMessageDto(message),
        recipientId: listing.ownerId,
        senderName: sender?.name ?? 'Buyer',
      };
    });
  }

  /** Admin↔owner thread about a flagged listing — kept as its own `type` so it can never
   * collide with (or be mistaken for) a genuine buyer inquiry on the same listing. */
  async getOrCreateModerationThread(listingId: string, adminId: string): Promise<Conversation> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');

    return this.prisma.conversation.upsert({
      where: { listingId_inquirerId_type: { listingId, inquirerId: adminId, type: 'moderation' } },
      update: {},
      create: { listingId, inquirerId: adminId, posterId: listing.ownerId, type: 'moderation' },
    });
  }

  /** The buyer/seller inbox only — `moderation` threads (admin↔owner, auto-created just by an
   * admin opening a listing in the separate admin app, see getOrCreateModerationThread) are a
   * different surface entirely and must never leak into here. An admin who also messages
   * listings as a buyer would otherwise see a phantom "empty conversation" for every listing
   * they'd merely opened in the admin panel, alongside their real inquiry for the same listing. */
  async listConversations(userId: string): Promise<ConversationSummaryDto[]> {
    const conversations = await this.prisma.conversation.findMany({
      // `some: { deletedAt: null }`, not just `some: {}` — a conversation whose only messages
      // have all been deleted has no active content left either, so it drops out of the inbox
      // the same as one that never had a message at all. The Conversation/Message rows
      // themselves are untouched (soft-delete, kept for admin moderation) — this only changes
      // what's listed here. sendFirstMessage's upsert still finds and reuses the same row if
      // either side messages again, so nothing is lost or duplicated.
      where: {
        type: 'inquiry',
        OR: [{ posterId: userId }, { inquirerId: userId }],
        messages: { some: { deletedAt: null } },
      },
      include: {
        listing: { select: { title: true, city: { select: { name: true } }, area: { select: { name: true } } } },
        poster: { select: { id: true, name: true, phone: true } },
        inquirer: { select: { id: true, name: true, phone: true, premiumUntil: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      conversations.map(async (c) => {
        const viewerIsPoster = c.posterId === userId;
        const otherParty = viewerIsPoster ? c.inquirer : c.poster;
        const unreadCount = await this.prisma.message.count({
          where: { conversationId: c.id, senderId: { not: userId }, readAt: null, deletedAt: null },
        });
        // Only the poster (seller) sees this — the badge is about the *inquirer* being a
        // premium buyer, so it never makes sense on the seller's own side of the thread.
        const otherPartyIsVerifiedBuyer =
          viewerIsPoster && (c.inquirer.premiumUntil?.getTime() ?? 0) > Date.now();
        return {
          id: c.id,
          listingId: c.listingId,
          listingTitle: c.listing.title,
          listingArea: c.listing.area.name,
          listingCityName: c.listing.city.name,
          type: c.type,
          otherPartyId: otherParty.id,
          // Never the raw phone number — a caller with no display name previously fell through
          // to `otherParty.phone`, handing out contact info the paid reveal flow exists to gate
          // (see contact-reveal.service.ts). A role label costs nothing here: `viewerIsPoster`
          // already tells us which side of the inquiry the other party is on.
          otherPartyName:
            otherParty.name ?? (c.type === 'moderation' ? 'Bhavano Admin' : viewerIsPoster ? 'Buyer' : 'Seller'),
          otherPartyIsVerifiedBuyer,
          lastMessage: c.messages[0] ? toMessageDto(c.messages[0]) : null,
          unreadCount,
        };
      }),
    );
  }

  /** The thread's own context — who it is with and which listing it is about. Participant-gated
   * like every other read here: a conversation id is a cuid, but guessing one should not reveal
   * a listing anyone was asking about. */
  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDetailDto> {
    await this.assertParticipant(conversationId, userId);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            category: true,
            transactionType: true,
            city: { select: { name: true } },
            area: { select: { name: true } },
          },
        },
        poster: { select: { id: true, name: true, phone: true } },
        inquirer: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const viewerIsPoster = conversation.posterId === userId;
    const otherParty = viewerIsPoster
      ? conversation.inquirer
      : conversation.poster;
    return {
      id: conversation.id,
      type: conversation.type,
      // See listConversations' identical fix — never the raw phone number.
      otherPartyName:
        otherParty.name ??
        (conversation.type === 'moderation' ? 'Bhavano Admin' : viewerIsPoster ? 'Buyer' : 'Seller'),
      listing: {
        id: conversation.listing.id,
        title: conversation.listing.title,
        slug: conversation.listing.slug,
        category: conversation.listing.category,
        transactionType: conversation.listing.transactionType,
        cityName: conversation.listing.city.name,
        area: conversation.listing.area.name,
      },
    };
  }

  /** Total unread messages across every conversation this user is in, in either role — the number
   * behind the count badge on the Messages entry point. One query: the per-conversation
   * `unreadCount` that `listConversations` computes is the same count sliced by thread. Excludes
   * deleted messages — otherwise an unread message deleted before it was ever read would leave a
   * phantom badge count pointing at a conversation that may no longer even be in the inbox. */
  async getUnreadTotal(userId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        senderId: { not: userId },
        readAt: null,
        deletedAt: null,
        conversation: { OR: [{ posterId: userId }, { inquirerId: userId }] },
      },
    });
  }

  async getMessages(conversationId: string, userId: string): Promise<MessageDto[]> {
    await this.assertParticipant(conversationId, userId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((m) => toMessageDto(m));
  }

  /** One listing's admin "Messages" table — buyer-inquiry conversations only (`type: 'inquiry'`),
   * the admin↔owner moderation thread on the same listingId never appears here. */
  async listConversationsForListingAsAdmin(
    listingId: string,
    offset: number,
    limit: number,
  ): Promise<AdminConversationsPage> {
    const where: Prisma.ConversationWhereInput = { listingId, type: 'inquiry' };
    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          inquirer: {
            select: { id: true, name: true, phone: true, email: true },
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      items: rows.map((c) => {
        const last = c.messages[0];
        return {
          id: c.id,
          inquirer: c.inquirer,
          lastMessage: last ? toMessageDto(last) : null,
          unreadByOwner:
            last != null &&
            last.senderId === c.inquirerId &&
            last.readAt === null,
          createdAt: c.createdAt.toISOString(),
        };
      }),
      total,
    };
  }

  /** Admin-only read of one buyer-inquiry thread — `getMessages` above can't be reused here since
   * an admin is never a real `posterId`/`inquirerId` participant in a buyer↔seller conversation.
   * Still scoped, not a blind bypass: 404s unless the conversation actually belongs to the given
   * listing and is a genuine inquiry (not the moderation thread), so a mismatched conversationId
   * can't leak a different listing's thread onto this page. Deliberately never calls `markRead` —
   * an admin looking at a thread must never register as the owner having actually responded. */
  async getMessagesAsAdmin(
    listingId: string,
    conversationId: string,
  ): Promise<MessageDto[]> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (
      !conversation ||
      conversation.listingId !== listingId ||
      conversation.type !== 'inquiry'
    ) {
      throw new NotFoundException('Conversation not found');
    }
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((m) => toMessageDto(m, { revealDeletedBody: true }));
  }

  /** Only the sender can delete their own message. Soft-delete, not removal — `deletedAt` masks
   * the body in toMessageDto's default mapping (see its own doc), but the row (and the admin
   * read path above) keeps the original text for moderation. */
  async deleteMessage(
    messageId: string,
    userId: string,
  ): Promise<{ message: MessageDto; conversationId: string }> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
    return { message: toMessageDto(updated), conversationId: updated.conversationId };
  }

  /** Also returns the other participant's id and the sender's display name — the caller pushes a
   * realtime unread update and a mobile notification (titled with the sender's name) to the
   * recipient, and would otherwise have to re-load the conversation and the user to get either. */
  async sendMessage(
    conversationId: string,
    senderId: string,
    body: string,
  ): Promise<{ message: MessageDto; recipientId: string; senderName: string }> {
    const conversation = await this.assertParticipant(conversationId, senderId);
    const [message, sender] = await Promise.all([
      this.prisma.message.create({ data: { conversationId, senderId, body } }),
      this.prisma.user.findUnique({ where: { id: senderId }, select: { name: true, phone: true } }),
    ]);
    const recipientId =
      conversation.posterId === senderId ? conversation.inquirerId : conversation.posterId;
    // Never the raw phone number — this titles a push notification, which can sit on a locked
    // screen for anyone nearby to read. Same fix/reasoning as listConversations/getConversation.
    const senderIsPoster = conversation.posterId === senderId;
    const senderName =
      sender?.name ?? (conversation.type === 'moderation' ? 'Bhavano Admin' : senderIsPoster ? 'Seller' : 'Buyer');
    return { message: toMessageDto(message), recipientId, senderName };
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

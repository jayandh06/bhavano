import { NotFoundException } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../prisma/prisma.service';

const HOUR_MS = 60 * 60 * 1000;
const future = (hours = 1) => new Date(Date.now() + hours * HOUR_MS);
const past = (hours = 1) => new Date(Date.now() - hours * HOUR_MS);

function makeService(conversations: unknown[]) {
  const prisma = {
    conversation: { findMany: jest.fn().mockResolvedValue(conversations) },
    message: { count: jest.fn().mockResolvedValue(0) },
  } as unknown as PrismaService;
  return { service: new MessagingService(prisma), prisma };
}

function conversation(posterId: string, inquirerId: string, premiumUntil: Date | null, type: 'inquiry' | 'moderation' = 'inquiry') {
  return {
    id: 'c1',
    listingId: 'l1',
    listing: { title: 'A listing' },
    posterId,
    inquirerId,
    poster: { id: posterId, name: 'Poster', phone: null },
    inquirer: { id: inquirerId, name: 'Inquirer', phone: null, premiumUntil },
    type,
    messages: [],
  };
}

describe('MessagingService.listConversations — Verified Buyer badge (premiumUntil)', () => {
  it('shows the badge to the poster when the inquirer has an active premiumUntil', async () => {
    const { service } = makeService([conversation('poster1', 'buyer1', future())]);
    const [result] = await service.listConversations('poster1');
    expect(result.otherPartyIsVerifiedBuyer).toBe(true);
  });

  it('hides the badge from the poster once the inquirer premiumUntil has lapsed', async () => {
    const { service } = makeService([conversation('poster1', 'buyer1', past())]);
    const [result] = await service.listConversations('poster1');
    expect(result.otherPartyIsVerifiedBuyer).toBe(false);
  });

  it('hides the badge from the poster when the inquirer never subscribed', async () => {
    const { service } = makeService([conversation('poster1', 'buyer1', null)]);
    const [result] = await service.listConversations('poster1');
    expect(result.otherPartyIsVerifiedBuyer).toBe(false);
  });

  it('never shows the badge from the inquirer\'s own side, even if the inquirer is premium', async () => {
    const { service } = makeService([conversation('poster1', 'buyer1', future())]);
    const [result] = await service.listConversations('buyer1');
    expect(result.otherPartyIsVerifiedBuyer).toBe(false);
  });
});

describe('MessagingService.listConversations — excludes moderation threads', () => {
  it('queries only type: inquiry, so an admin\'s own moderation threads never appear in their inbox', async () => {
    const { service, prisma } = makeService([]);
    await service.listConversations('poster1');
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'inquiry' }),
      }),
    );
  });
});

describe('MessagingService.getUnreadTotal', () => {
  it('counts unread messages from others across every conversation the user is a participant in', async () => {
    const count = jest.fn().mockResolvedValue(4);
    const prisma = { message: { count } } as unknown as PrismaService;
    const service = new MessagingService(prisma);

    await expect(service.getUnreadTotal('u1')).resolves.toBe(4);
    expect(count).toHaveBeenCalledWith({
      where: {
        senderId: { not: 'u1' },
        readAt: null,
        conversation: { OR: [{ posterId: 'u1' }, { inquirerId: 'u1' }] },
      },
    });
  });
});

describe('MessagingService.getMessagesAsAdmin', () => {
  function makeAdminReadService(conversationRow: unknown) {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      conversation: { findUnique: jest.fn().mockResolvedValue(conversationRow) },
      message: { findMany },
    } as unknown as PrismaService;
    return { service: new MessagingService(prisma), findMany };
  }

  it('returns the thread for a genuine buyer-inquiry conversation on the given listing', async () => {
    const { service, findMany } = makeAdminReadService({
      id: 'c1',
      listingId: 'l1',
      type: 'inquiry',
      posterId: 'owner1',
      inquirerId: 'buyer1',
    });
    await service.getMessagesAsAdmin('l1', 'c1');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversationId: 'c1' } }),
    );
  });

  it('404s when the conversation belongs to a different listing', async () => {
    const { service } = makeAdminReadService({ id: 'c1', listingId: 'other-listing', type: 'inquiry' });
    await expect(service.getMessagesAsAdmin('l1', 'c1')).rejects.toThrow(NotFoundException);
  });

  it('404s on the admin↔owner moderation thread — never readable through this listing-scoped path', async () => {
    const { service } = makeAdminReadService({ id: 'c1', listingId: 'l1', type: 'moderation' });
    await expect(service.getMessagesAsAdmin('l1', 'c1')).rejects.toThrow(NotFoundException);
  });

  it('404s when the conversation does not exist at all', async () => {
    const { service } = makeAdminReadService(null);
    await expect(service.getMessagesAsAdmin('l1', 'missing')).rejects.toThrow(NotFoundException);
  });
});

describe('MessagingService.listConversationsForListingAsAdmin', () => {
  it('queries only this listing\'s type: inquiry conversations, never the moderation thread', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      conversation: { findMany, count },
    } as unknown as PrismaService;
    const service = new MessagingService(prisma);

    await service.listConversationsForListingAsAdmin('l1', 0, 25);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { listingId: 'l1', type: 'inquiry' } }),
    );
    expect(count).toHaveBeenCalledWith({ where: { listingId: 'l1', type: 'inquiry' } });
  });

  it('flags unreadByOwner only when the buyer sent the last message and the owner has not read it', async () => {
    const row = {
      id: 'c1',
      inquirer: { id: 'buyer1', name: 'Priya', phone: null, email: null },
      inquirerId: 'buyer1',
      createdAt: new Date(),
      messages: [{ id: 'm1', conversationId: 'c1', senderId: 'buyer1', body: 'hi', createdAt: new Date(), readAt: null }],
    };
    const prisma = {
      conversation: {
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;
    const service = new MessagingService(prisma);

    const result = await service.listConversationsForListingAsAdmin('l1', 0, 25);
    expect(result.items[0].unreadByOwner).toBe(true);
  });

  it('does not flag unreadByOwner when the owner sent the last message', async () => {
    const row = {
      id: 'c1',
      inquirer: { id: 'buyer1', name: 'Priya', phone: null, email: null },
      inquirerId: 'buyer1',
      createdAt: new Date(),
      messages: [{ id: 'm1', conversationId: 'c1', senderId: 'owner1', body: 'thanks', createdAt: new Date(), readAt: null }],
    };
    const prisma = {
      conversation: {
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;
    const service = new MessagingService(prisma);

    const result = await service.listConversationsForListingAsAdmin('l1', 0, 25);
    expect(result.items[0].unreadByOwner).toBe(false);
  });
});

describe('MessagingService.sendMessage', () => {
  function makeSendService(conversationRow: unknown, sender: unknown) {
    const created = {
      id: 'm1',
      conversationId: 'c1',
      senderId: 'poster1',
      body: 'hi',
      createdAt: new Date(),
      readAt: null,
    };
    const prisma = {
      conversation: { findUnique: jest.fn().mockResolvedValue(conversationRow) },
      message: { create: jest.fn().mockResolvedValue(created) },
      user: { findUnique: jest.fn().mockResolvedValue(sender) },
    } as unknown as PrismaService;
    return new MessagingService(prisma);
  }

  it('returns the other participant as recipient and the sender\'s name', async () => {
    const service = makeSendService(
      { id: 'c1', posterId: 'poster1', inquirerId: 'buyer1' },
      { name: 'Asha', phone: null },
    );
    const result = await service.sendMessage('c1', 'poster1', 'hi');
    expect(result.recipientId).toBe('buyer1');
    expect(result.senderName).toBe('Asha');
    expect(result.message.id).toBe('m1');
  });

  it('falls back to the sender\'s phone, then a generic label, when there is no name', async () => {
    const withPhone = makeSendService(
      { id: 'c1', posterId: 'p', inquirerId: 'b' },
      { name: null, phone: '9990001111' },
    );
    await expect(withPhone.sendMessage('c1', 'b', 'hi')).resolves.toMatchObject({
      recipientId: 'p',
      senderName: '9990001111',
    });

    const anon = makeSendService({ id: 'c1', posterId: 'p', inquirerId: 'b' }, null);
    await expect(anon.sendMessage('c1', 'b', 'hi')).resolves.toMatchObject({
      senderName: 'New message',
    });
  });
});

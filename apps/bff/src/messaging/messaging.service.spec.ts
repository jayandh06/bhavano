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

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

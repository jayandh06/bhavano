import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostFeedbackService, normalizePlatform, summarize } from './post-feedback.service';
import type { SavePostFeedbackDto } from './dto/save-post-feedback.dto';

function makeService(listing: { id: string; ownerId: string; category: string; transactionType: string } | null) {
  const prisma = {
    listing: { findUnique: jest.fn().mockResolvedValue(listing) },
    postFeedback: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation((args: { create: Record<string, unknown> }) =>
        Promise.resolve({ rating: null, difficulties: [], suggestion: null, canContact: false, ...args.create }),
      ),
    },
  };
  return { prisma, service: new PostFeedbackService(prisma as never) };
}

const LISTING = { id: 'l1', ownerId: 'u1', category: 'apartment', transactionType: 'rent' };
const dto = (over: Partial<SavePostFeedbackDto> = {}) => ({ listingId: 'l1', ...over }) as SavePostFeedbackDto;

describe('PostFeedbackService.save', () => {
  it('lets only the listing owner answer', async () => {
    await expect(makeService(null).service.save('u1', dto())).rejects.toBeInstanceOf(NotFoundException);
    await expect(makeService(LISTING).service.save('someone-else', dto())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('saves a star tap alone and copies the listing category and transaction type', async () => {
    const { prisma, service } = makeService(LISTING);
    const saved = await service.save('u1', dto({ rating: 4, source: 'success_screen', platform: 'web' }));
    expect(saved).toMatchObject({ listingId: 'l1', rating: 4, difficulties: [], suggestion: null, canContact: false });
    const call = prisma.postFeedback.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({ userId: 'u1', source: 'success_screen', platform: 'web', category: 'apartment', transactionType: 'rent' });
    // A later call must only change what it sends.
    expect(call.update).toEqual({ rating: 4 });
  });

  it('leaves fields it was not sent alone on update', async () => {
    const { prisma, service } = makeService(LISTING);
    await service.save('u1', dto({ suggestion: '  make photos easier  ', difficulties: ['photos', 'photos', 'price'], canContact: true }));
    expect(prisma.postFeedback.upsert.mock.calls[0][0].update).toEqual({
      suggestion: 'make photos easier',
      difficulties: ['photos', 'price'],
      canContact: true,
    });
  });

  it('stores an emptied suggestion as null and defaults the source to the web link', async () => {
    const { prisma, service } = makeService(LISTING);
    await service.save('u1', dto({ suggestion: '   ' }));
    const call = prisma.postFeedback.upsert.mock.calls[0][0];
    expect(call.update).toEqual({ suggestion: null });
    expect(call.create.source).toBe('web_link');
  });
});

describe('normalizePlatform', () => {
  it('takes the body value, then the x-client header, and drops anything else', () => {
    expect(normalizePlatform('web', 'app')).toBe('web');
    expect(normalizePlatform(undefined, 'APP')).toBe('app');
    expect(normalizePlatform('desktop', undefined)).toBeNull();
  });
});

describe('summarize', () => {
  it('averages the ratings, counts each star and ranks the difficulties', () => {
    const s = summarize([
      { rating: 5, difficulties: [], suggestion: null, canContact: false },
      { rating: 2, difficulties: ['photos', 'price'], suggestion: 'faster', canContact: true },
      { rating: null, difficulties: ['photos', 'not-a-chip'], suggestion: null, canContact: false },
    ]);
    expect(s.answered).toBe(3);
    expect(s.averageRating).toBe(3.5);
    expect(s.ratingCounts).toEqual([0, 1, 0, 0, 1]);
    expect(s.difficultyCounts).toEqual([
      { difficulty: 'photos', count: 2 },
      { difficulty: 'price', count: 1 },
    ]);
    expect(s.withSuggestion).toBe(1);
    expect(s.canContact).toBe(1);
  });

  it('has no average when nobody rated', () => {
    expect(summarize([]).averageRating).toBeNull();
  });
});

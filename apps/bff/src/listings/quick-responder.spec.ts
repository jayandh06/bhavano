import { isQuickResponder } from '@bhavano/types/quickResponder';
import { isQuickResponderOwner, setQuickResponderOwners } from './quick-responder.store';
import { QuickResponderService } from './quick-responder.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('isQuickResponder', () => {
  it('needs at least 5 enquiries', () => {
    expect(isQuickResponder(4, 4)).toBe(false);
    expect(isQuickResponder(5, 5)).toBe(true);
  });

  it('needs at least 70% quick replies', () => {
    expect(isQuickResponder(10, 7)).toBe(true);
    expect(isQuickResponder(10, 6)).toBe(false);
  });
});

describe('QuickResponderService.refresh', () => {
  afterEach(() => setQuickResponderOwners([]));

  function makeService(rows: { ownerId: string; enquiries: number; quick: number }[] | Error) {
    const queryRaw = jest.fn();
    if (rows instanceof Error) queryRaw.mockRejectedValue(rows);
    else queryRaw.mockResolvedValue(rows);
    return new QuickResponderService({ $queryRaw: queryRaw } as unknown as PrismaService);
  }

  it('badges only owners who clear the rule', async () => {
    const service = makeService([
      { ownerId: 'fast', enquiries: 10, quick: 9 },
      { ownerId: 'slow', enquiries: 10, quick: 2 },
    ]);
    await service.refresh();
    expect(isQuickResponderOwner('fast')).toBe(true);
    expect(isQuickResponderOwner('slow')).toBe(false);
    expect(isQuickResponderOwner('nobody')).toBe(false);
  });

  it('keeps the previous badges when a refresh fails', async () => {
    setQuickResponderOwners(['fast']);
    const service = makeService(new Error('db down'));
    await service.refresh();
    expect(isQuickResponderOwner('fast')).toBe(true);
  });
});

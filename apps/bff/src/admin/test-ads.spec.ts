import { AdminService, TEST_AD_TITLE_PREFIX } from './admin.service';

function makeService(rows: { id: string }[]) {
  const prisma = {
    listing: {
      count: jest.fn().mockResolvedValue(rows.length),
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
  const none = {} as never;
  const service = new AdminService(prisma as never, none, none, none, none, none, none, none, none, none, none, none, none, none, none);
  return { prisma, service };
}

describe('admin test ads (the /post test scenarios)', () => {
  it('matches only admin-owned ads whose title starts with [TEST]', async () => {
    const { prisma, service } = makeService([{ id: 'a' }, { id: 'b' }]);
    expect(await service.countTestAds()).toBe(2);
    // Both conditions together, so a real user's ad titled "[TEST] ..." is never matched.
    expect(prisma.listing.count).toHaveBeenCalledWith({ where: { title: { startsWith: TEST_AD_TITLE_PREFIX }, owner: { role: 'admin' } } });
    expect(TEST_AD_TITLE_PREFIX).toBe('[TEST]');
  });

  it('deletes every match, keeps going past one that fails, and reports both counts', async () => {
    const { prisma, service } = makeService([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const deleteListing = jest
      .spyOn(service, 'deleteListing')
      .mockImplementation((id: string) => (id === 'b' ? Promise.reject(new Error('storage down')) : Promise.resolve()));
    expect(await service.deleteTestAds('admin1')).toEqual({ deleted: 2, failed: 1 });
    expect(deleteListing.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c']);
    expect(prisma.listing.findMany.mock.calls[0][0].where).toEqual({ title: { startsWith: '[TEST]' }, owner: { role: 'admin' } });
  });

  it('does nothing when there are no test ads', async () => {
    const { service } = makeService([]);
    const deleteListing = jest.spyOn(service, 'deleteListing');
    expect(await service.deleteTestAds('admin1')).toEqual({ deleted: 0, failed: 0 });
    expect(deleteListing).not.toHaveBeenCalled();
  });
});

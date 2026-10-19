import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validateAreaOverviewContent, type AreaOverviewContent } from '@bhavano/types/areaOverview';
import { AreaOverviewsService, cleanContent, sameContent } from './area-overviews.service';

const GOOD: AreaOverviewContent = {
  about: ['Koramangala is a large neighbourhood in south-east Bengaluru, laid out in numbered blocks.'],
  gettingAround: [],
  faqs: [{ question: 'What are the blocks in Koramangala?', answer: 'It is divided into numbered blocks, from the 1st to the 8th.' }],
};

function makeService(existing: Record<string, unknown> | null = null) {
  const prisma = {
    area: { findUnique: jest.fn().mockResolvedValue({ id: 'a1' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ name: 'Priya' }) },
    areaOverview: {
      findUnique: jest.fn().mockResolvedValue(existing),
      findFirst: jest.fn(),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...data, status: 'draft', faqs: data.faqs, reviewedByName: null, reviewedAt: null, publishedAt: null, updatedAt: new Date() }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ areaId: 'a1', about: GOOD.about, gettingAround: [], faqs: GOOD.faqs, status: 'draft', reviewedByName: null, reviewedAt: null, publishedAt: null, updatedAt: new Date(), ...data }),
      ),
    },
  };
  return { service: new AreaOverviewsService(prisma as never), prisma };
}

const stored = (status: string, content: AreaOverviewContent = GOOD) => ({
  areaId: 'a1', status, about: content.about, gettingAround: content.gettingAround, faqs: content.faqs,
  reviewedByName: null, reviewedAt: null, publishedAt: null, updatedAt: new Date(),
});

describe('validateAreaOverviewContent', () => {
  it('passes good content', () => expect(validateAreaOverviewContent(GOOD)).toEqual([]));

  it('blocks prices, percentages and links', () => {
    const bad = { ...GOOD, about: ['The rent here averages ₹30,000 a month, up 10% on last year, see www.example.com.'] };
    const problems = validateAreaOverviewContent(bad).join(' ');
    expect(problems).toMatch(/prices/);
    expect(problems).toMatch(/web addresses/);
  });

  it('needs an about paragraph and a FAQ', () => {
    expect(validateAreaOverviewContent({ about: [], gettingAround: [], faqs: [] }).length).toBeGreaterThanOrEqual(2);
  });
});

describe('AreaOverviewsService', () => {
  it('saves new text as a draft', async () => {
    const { service, prisma } = makeService(null);
    const dto = await service.save('a1', GOOD, 'u1');
    expect(prisma.areaOverview.create).toHaveBeenCalled();
    expect(dto.status).toBe('draft');
  });

  it('rejects invalid text without saving', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.save('a1', { ...GOOD, about: ['too short'] }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.areaOverview.create).not.toHaveBeenCalled();
  });

  it('sends published text back to draft when it is edited', async () => {
    const { service, prisma } = makeService(stored('published'));
    await service.save('a1', { ...GOOD, about: [GOOD.about[0] + ' It borders HSR Layout and BTM Layout.'] }, 'u1');
    const data = prisma.areaOverview.update.mock.calls[0][0].data;
    expect(data.status).toBe('draft');
    expect(data.reviewedByName).toBeNull();
    expect(data.publishedAt).toBeNull();
  });

  it('leaves the status alone when the text is unchanged', async () => {
    const { service, prisma } = makeService(stored('published'));
    const dto = await service.save('a1', GOOD, 'u1');
    expect(prisma.areaOverview.update).not.toHaveBeenCalled();
    expect(dto.status).toBe('published');
  });

  it('will not publish without the checklist, and records the reviewer when it has it', async () => {
    const { service, prisma } = makeService(stored('in_review'));
    await expect(service.setStatus('a1', 'published', false, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    await service.setStatus('a1', 'published', true, 'u1');
    const data = prisma.areaOverview.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'published', reviewedById: 'u1', reviewedByName: 'Priya' });
    expect(data.reviewedAt).toBeInstanceOf(Date);
  });

  it('refuses a status change before any text is saved', async () => {
    const { service } = makeService(null);
    await expect(service.setStatus('a1', 'in_review', false, 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unpublishes back to draft and clears the approval', async () => {
    const { service, prisma } = makeService(stored('published'));
    await service.setStatus('a1', 'draft', false, 'u1');
    expect(prisma.areaOverview.update.mock.calls[0][0].data).toMatchObject({ status: 'draft', reviewedById: null, publishedAt: null });
  });
});

describe('content helpers', () => {
  it('trims and drops empty entries', () => {
    expect(cleanContent({ about: [' a ', ''], gettingAround: [' '], faqs: [{ question: ' q ', answer: ' a ' }, { question: '', answer: '' }] })).toEqual({
      about: ['a'], gettingAround: [], faqs: [{ question: 'q', answer: 'a' }],
    });
    expect(sameContent(GOOD, { ...GOOD })).toBe(true);
  });
});

describe('AreaOverviewsService.list', () => {
  const row = (areaName: string, cityName: string, activeListings: number, status: string | null, updatedAt: string | null) => ({
    areaId: `${cityName}-${areaName}`, areaName, cityName, activeListings, status, updatedAt: updatedAt ? new Date(updatedAt) : null, reviewedByName: null,
  });
  const ROWS = [
    row('HSR Layout', 'Bengaluru', 11, 'published', '2026-10-18T10:00:00Z'),
    row('Jayanagar', 'Bengaluru', 8, 'draft', '2026-10-10T10:00:00Z'),
    row('Aundh', 'Pune', 4, null, null),
    row('Wakad', 'Pune', 3, 'in_review', '2026-10-15T10:00:00Z'),
  ];
  const make = () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(ROWS) };
    return new AreaOverviewsService(prisma as never);
  };
  const names = (page: { items: { areaName: string }[] }) => page.items.map((i) => i.areaName);

  it('sorts by active listings, busiest first, by default', async () => {
    expect(names(await make().list({ offset: 0, limit: 10 }))).toEqual(['HSR Layout', 'Jayanagar', 'Aundh', 'Wakad']);
  });

  it('sorts either way by a chosen column, keeping areas with no date last', async () => {
    expect(names(await make().list({ sort: 'updated', dir: 'asc', offset: 0, limit: 10 }))).toEqual(['Jayanagar', 'Wakad', 'HSR Layout', 'Aundh']);
    expect(names(await make().list({ sort: 'updated', dir: 'desc', offset: 0, limit: 10 }))).toEqual(['HSR Layout', 'Wakad', 'Jayanagar', 'Aundh']);
  });

  it('filters by city, status and listing range, and lists every city', async () => {
    const page = await make().list({ city: 'pune', minListings: 4, offset: 0, limit: 10 });
    expect(names(page)).toEqual(['Aundh']);
    expect(page.cities).toEqual(['Bengaluru', 'Pune']);
    expect(names(await make().list({ status: 'none', offset: 0, limit: 10 }))).toEqual(['Aundh']);
    expect(names(await make().list({ status: 'draft', maxListings: 10, offset: 0, limit: 10 }))).toEqual(['Jayanagar']);
  });

  it('filters by update date in India time, inclusive, and drops areas with no date', async () => {
    const page = await make().list({ updatedFrom: '2026-10-12', updatedTo: '2026-10-18', offset: 0, limit: 10 });
    expect(names(page).sort()).toEqual(['HSR Layout', 'Wakad']);
  });

  it('searches the area name and pages the result', async () => {
    expect(names(await make().list({ q: 'lay', offset: 0, limit: 10 }))).toEqual(['HSR Layout']);
    const page = await make().list({ offset: 1, limit: 2 });
    expect(page.total).toBe(4);
    expect(names(page)).toEqual(['Jayanagar', 'Aundh']);
  });
});

describe('AreaOverviewsService.setStatusBulk', () => {
  it('refuses to publish without the confirmed checklist', async () => {
    const { service } = makeService(stored('draft'));
    await expect(service.setStatusBulk(['a1'], 'published', false, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports each area on its own, so one failure does not stop the rest', async () => {
    const { service, prisma } = makeService(null);
    prisma.areaOverview.findUnique.mockImplementation(({ where }: { where: { areaId: string } }) =>
      Promise.resolve(where.areaId === 'ok' ? stored('draft') : null),
    );
    const { results } = await service.setStatusBulk(['ok', 'missing', 'ok'], 'published', true, 'u1');
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.areaId === 'ok')?.ok).toBe(true);
    expect(results.find((r) => r.areaId === 'missing')).toMatchObject({ ok: false });
  });
});

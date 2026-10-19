import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AreaOverviewContent } from '@bhavano/types/areaOverview';
import { CityOverviewsService } from './city-overviews.service';

const GOOD: AreaOverviewContent = {
  about: ['Bengaluru is a large city in the south of India and a major centre for technology work.'],
  gettingAround: [],
  faqs: [{ question: 'Which areas of Bengaluru are popular?', answer: 'Areas such as HSR Layout and Indiranagar are widely searched.' }],
};

const stored = (status: string) => ({
  cityId: 'c1', status, about: GOOD.about, gettingAround: GOOD.gettingAround, faqs: GOOD.faqs,
  reviewedByName: null, reviewedAt: null, publishedAt: null, updatedAt: new Date(),
});

function make(existing: Record<string, unknown> | null = null) {
  const prisma = {
    city: { findUnique: jest.fn().mockResolvedValue({ id: 'c1' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ name: 'Priya' }) },
    cityOverview: {
      findUnique: jest.fn().mockResolvedValue(existing),
      findFirst: jest.fn(),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...data, status: 'draft', reviewedByName: null, reviewedAt: null, publishedAt: null, updatedAt: new Date() }),
      ),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...stored('draft'), ...data })),
    },
  };
  return { service: new CityOverviewsService(prisma as never), prisma };
}

describe('CityOverviewsService', () => {
  it('saves new text as a draft and rejects invalid text', async () => {
    const { service, prisma } = make(null);
    expect((await service.save('c1', GOOD, 'u1')).status).toBe('draft');
    await expect(service.save('c1', { ...GOOD, about: ['too short'] }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.cityOverview.create).toHaveBeenCalledTimes(1);
  });

  it('sends published text back to draft when edited, and leaves identical text alone', async () => {
    const edited = make(stored('published'));
    await edited.service.save('c1', { ...GOOD, about: [GOOD.about[0] + ' It has many neighbourhoods.'] }, 'u1');
    expect(edited.prisma.cityOverview.update.mock.calls[0][0].data).toMatchObject({ status: 'draft', publishedAt: null, reviewedByName: null });
    const same = make(stored('published'));
    expect((await same.service.save('c1', GOOD, 'u1')).status).toBe('published');
    expect(same.prisma.cityOverview.update).not.toHaveBeenCalled();
  });

  it('will not publish without the checklist, then records the reviewer', async () => {
    const { service, prisma } = make(stored('in_review'));
    await expect(service.setStatus('c1', 'published', false, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    await service.setStatus('c1', 'published', true, 'u1');
    expect(prisma.cityOverview.update.mock.calls[0][0].data).toMatchObject({ status: 'published', reviewedById: 'u1', reviewedByName: 'Priya' });
  });

  it('refuses a status change before any text is saved', async () => {
    await expect(make(null).service.setStatus('c1', 'in_review', false, 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

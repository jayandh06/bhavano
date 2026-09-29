import {
  decodeRequirementFeedQuery,
  encodeRequirementFeedQuery,
} from '@bhavano/types/requirementFeed';
import type { RequirementCriteria } from '@bhavano/types/requirementQuestions';
import {
  feedDetails,
  listingFits,
  matchFeedFilters,
  type FeedRow,
} from './requirement-feed';

const now = new Date('2026-09-29T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function row(
  criteria: Partial<RequirementCriteria> = {},
  extra: Partial<FeedRow> = {},
): FeedRow {
  return {
    criteria: {
      cityId: 'blr',
      areaIds: ['hsr', 'kor'],
      category: 'apartment',
      transactionType: 'rent',
      bedroomOptions: [2, 3],
      minPrice: 20_000,
      maxPrice: 35_000,
      attributes: {},
      ...criteria,
    },
    createdAt: new Date(now.getTime() - 2 * DAY),
    moveInBy: null,
    openToCalls: true,
    ...extra,
  };
}

const ctx = { now, fitCount: 0 };

describe('matchFeedFilters', () => {
  it('matches with no filters', () => {
    expect(matchFeedFilters(row(), {}, ctx)).toEqual({
      match: true,
      unanswered: [],
    });
  });

  it('filters on city, areas, intent, transaction and category', () => {
    expect(matchFeedFilters(row(), { city: 'chn' }, ctx).match).toBe(false);
    expect(
      matchFeedFilters(
        row(),
        { city: 'blr', areas: ['kor', 'whitefield'] },
        ctx,
      ).match,
    ).toBe(true);
    expect(matchFeedFilters(row(), { areas: ['whitefield'] }, ctx).match).toBe(
      false,
    );
    expect(
      matchFeedFilters(
        row(),
        { intent: 'rentLease', transactionType: 'rent', category: 'apartment' },
        ctx,
      ).match,
    ).toBe(true);
    expect(matchFeedFilters(row(), { intent: 'buy' }, ctx).match).toBe(false);
    expect(
      matchFeedFilters(row(), { transactionType: 'lease' }, ctx).match,
    ).toBe(false);
    expect(matchFeedFilters(row(), { category: 'villa' }, ctx).match).toBe(
      false,
    );
  });

  it('treats an older "buy" capture as a purchase', () => {
    expect(
      matchFeedFilters(
        row({ transactionType: 'buy' }),
        { intent: 'buy', transactionType: 'sell' },
        ctx,
      ).match,
    ).toBe(true);
  });

  it('matches budgets by overlap, and keeps an unanswered budget with a note', () => {
    expect(
      matchFeedFilters(row(), { minBudget: 30_000, maxBudget: 60_000 }, ctx)
        .match,
    ).toBe(true);
    expect(matchFeedFilters(row(), { minBudget: 40_000 }, ctx).match).toBe(
      false,
    );
    expect(matchFeedFilters(row(), { maxBudget: 15_000 }, ctx).match).toBe(
      false,
    );
    expect(
      matchFeedFilters(
        row({ minPrice: undefined, maxPrice: undefined }),
        { maxBudget: 15_000 },
        ctx,
      ),
    ).toEqual({
      match: true,
      unanswered: ['Budget not given'],
    });
  });

  it('matches BHK by overlap and only for categories that have bedrooms', () => {
    expect(matchFeedFilters(row(), { bedrooms: [3, 4] }, ctx).match).toBe(true);
    expect(matchFeedFilters(row(), { bedrooms: [1] }, ctx).match).toBe(false);
    expect(
      matchFeedFilters(row({ bedroomOptions: [] }), { bedrooms: [1] }, ctx)
        .unanswered,
    ).toEqual(['BHK not given']);
    expect(
      matchFeedFilters(
        row({ category: 'pg', transactionType: 'rent', bedroomOptions: [] }),
        { bedrooms: [1] },
        ctx,
      ),
    ).toEqual({
      match: true,
      unanswered: [],
    });
  });

  it('matches size in sqft for area-sized categories', () => {
    const plot = row({
      category: 'plot',
      transactionType: 'sell',
      bedroomOptions: [],
      minAreaSqft: 1200,
      maxAreaSqft: 2400,
    });
    expect(matchFeedFilters(plot, { minSqft: 2000 }, ctx).match).toBe(true);
    expect(matchFeedFilters(plot, { minSqft: 3000 }, ctx).match).toBe(false);
    expect(
      matchFeedFilters(
        {
          ...plot,
          criteria: {
            ...plot.criteria,
            minAreaSqft: undefined,
            maxAreaSqft: undefined,
          },
        },
        { maxSqft: 500 },
        ctx,
      ).unanswered,
    ).toEqual(['Size not given']);
  });

  it('matches attributes by overlap, keeping unanswered ones with their question label', () => {
    const furnished = row({ attributes: { furnished: ['semi', 'furnished'] } });
    expect(
      matchFeedFilters(
        furnished,
        { attributes: { furnished: ['furnished'] } },
        ctx,
      ).match,
    ).toBe(true);
    expect(
      matchFeedFilters(
        furnished,
        { attributes: { furnished: ['unfurnished'] } },
        ctx,
      ).match,
    ).toBe(false);
    expect(
      matchFeedFilters(
        row(),
        { attributes: { furnished: ['furnished'] } },
        ctx,
      ),
    ).toEqual({
      match: true,
      unanswered: ['Furnishing not given'],
    });
  });

  it("passes amenities only when every must-have is among the viewer's", () => {
    const wantsLift = row({
      attributes: { amenities: ['lift', 'powerBackup'] },
    });
    expect(
      matchFeedFilters(
        wantsLift,
        { amenities: ['lift', 'powerBackup', 'gym'] },
        ctx,
      ).match,
    ).toBe(true);
    expect(
      matchFeedFilters(wantsLift, { amenities: ['lift'] }, ctx).match,
    ).toBe(false);
    expect(matchFeedFilters(row(), { amenities: ['lift'] }, ctx).match).toBe(
      true,
    );
  });

  it('filters on freshness, move-in, consent and inventory fit', () => {
    expect(matchFeedFilters(row(), { postedWithinDays: 7 }, ctx).match).toBe(
      true,
    );
    expect(
      matchFeedFilters(
        row({}, { createdAt: new Date(now.getTime() - 10 * DAY) }),
        { postedWithinDays: 7 },
        ctx,
      ).match,
    ).toBe(false);

    const soon = row({}, { moveInBy: new Date(now.getTime() + 5 * DAY) });
    const later = row({}, { moveInBy: new Date(now.getTime() + 60 * DAY) });
    expect(matchFeedFilters(soon, { moveIn: 'now' }, ctx).match).toBe(true);
    expect(matchFeedFilters(later, { moveIn: 'month' }, ctx).match).toBe(false);
    expect(matchFeedFilters(later, { moveIn: 'quarter' }, ctx).match).toBe(
      true,
    );
    expect(matchFeedFilters(row(), { moveIn: 'exploring' }, ctx).match).toBe(
      true,
    );
    expect(matchFeedFilters(soon, { moveIn: 'exploring' }, ctx).match).toBe(
      false,
    );
    expect(matchFeedFilters(row(), { moveIn: 'now' }, ctx).match).toBe(false);

    expect(
      matchFeedFilters(
        row({}, { openToCalls: false }),
        { openToCalls: true },
        ctx,
      ).match,
    ).toBe(false);
    expect(
      matchFeedFilters(row(), { matchesMyListings: true }, ctx).match,
    ).toBe(false);
    expect(
      matchFeedFilters(row(), { matchesMyListings: true }, { now, fitCount: 1 })
        .match,
    ).toBe(true);
  });
});

describe('listingFits', () => {
  const criteria = row().criteria;
  it('needs the same city, category and transaction, in one of the areas', () => {
    expect(
      listingFits(criteria, {
        cityId: 'blr',
        areaId: 'kor',
        category: 'apartment',
        transactionType: 'rent',
      }),
    ).toBe(true);
    expect(
      listingFits(criteria, {
        cityId: 'blr',
        areaId: 'whitefield',
        category: 'apartment',
        transactionType: 'rent',
      }),
    ).toBe(false);
    expect(
      listingFits(criteria, {
        cityId: 'blr',
        areaId: 'kor',
        category: 'apartment',
        transactionType: 'sell',
      }),
    ).toBe(false);
    expect(
      listingFits(criteria, {
        cityId: 'blr',
        areaId: 'kor',
        category: 'villa',
        transactionType: 'rent',
      }),
    ).toBe(false);
  });
});

describe('feedDetails', () => {
  it('labels attribute answers and must-have amenities', () => {
    const details = feedDetails(
      row({ attributes: { furnished: ['semi'], amenities: ['lift'] } })
        .criteria,
    );
    expect(details[0].label).toBe('Furnishing');
    expect(details[0].values).toHaveLength(1);
    expect(details[details.length - 1]).toEqual({
      label: 'Must have',
      values: [expect.any(String)],
    });
  });
});

describe('requirement feed query codec', () => {
  it('round-trips every filter', () => {
    const query = {
      city: 'bengaluru',
      areas: 'hsr-layout,koramangala',
      intent: 'rent-lease',
      txn: 'rent',
      type: 'apartment',
      minBudget: '20000',
      maxBudget: '40000',
      bhk: '2,3',
      attr_furnished: 'semi,furnished',
      amenities: 'lift',
      posted: '7',
      movein: 'month',
      calls: '1',
      matches: '1',
      sort: 'soonest',
    };
    const filters = decodeRequirementFeedQuery(query);
    expect(filters).toMatchObject({
      city: 'bengaluru',
      areas: ['hsr-layout', 'koramangala'],
      intent: 'rentLease',
      transactionType: 'rent',
      category: 'apartment',
      bedrooms: [2, 3],
      attributes: { furnished: ['semi', 'furnished'] },
      openToCalls: true,
    });
    expect(encodeRequirementFeedQuery(filters)).toEqual(query);
  });

  it('drops values it does not recognise instead of failing', () => {
    expect(
      decodeRequirementFeedQuery({
        intent: 'nope',
        type: 'plot',
        bhk: '0,9,x',
        posted: '3',
        minBudget: '-5',
        'attr_bad key': 'x',
      }),
    ).toEqual({ category: 'plot' });
    expect(
      decodeRequirementFeedQuery({ intent: 'pg', type: 'apartment' }),
    ).toEqual({ intent: 'pg' });
  });
});

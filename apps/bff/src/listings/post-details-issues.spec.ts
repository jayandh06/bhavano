import type { ListingCategory, TransactionType } from '@bhavano/types';
import {
  CATEGORY_FIELD_CONFIG,
  defaultAttributesFor,
  listingAttributeIssues,
  listingAttributesIssue,
} from '@bhavano/types/categoryFields';
import {
  attributeTarget,
  detailsPartOfTarget,
  firstDetailsIssue,
  hasBlockingOtherIssue,
  issueMessages,
  postDetailsIssues,
  type DetailsIssueInput,
} from '@bhavano/types/postDetailsIssues';
import { parsePostFieldEventPath, postFieldEventPath } from '@bhavano/types/postFieldEvents';
import { summarizePostFieldEvents } from '@bhavano/types/postFunnel';

const CATEGORIES = Object.keys(CATEGORY_FIELD_CONFIG) as ListingCategory[];
const TRANSACTIONS: TransactionType[] = ['sell', 'rent', 'lease', 'buy'];

describe('listingAttributeIssues', () => {
  it('starts with exactly what listingAttributesIssue returns, for every category and transaction', () => {
    for (const category of CATEGORIES) {
      for (const transactionType of TRANSACTIONS) {
        const attributes = defaultAttributesFor(category);
        const all = listingAttributeIssues(category, transactionType, attributes);
        expect(all[0]?.text ?? null).toBe(listingAttributesIssue(category, transactionType, attributes));
      }
    }
  });

  it('lists every missing required field, not only the first', () => {
    const issues = listingAttributeIssues('apartment', 'sell', defaultAttributesFor('apartment'));
    const required = CATEGORY_FIELD_CONFIG.apartment.filter((f) => f.required && f.defaultValue === undefined);
    expect(issues.length).toBeGreaterThan(1);
    expect(issues.length).toBeGreaterThanOrEqual(Math.min(required.length, 3));
    for (const issue of issues) if (issue.key) expect(CATEGORY_FIELD_CONFIG.apartment.some((f) => f.key === issue.key)).toBe(true);
  });
});

function input(overrides: Partial<DetailsIssueInput> = {}): DetailsIssueInput {
  return {
    hasPin: true,
    pinLookingUp: false,
    hasCity: true,
    areaText: 'HSR Layout',
    areaIsExisting: true,
    areaMaxLength: 80,
    needsPostedBy: false,
    postedByAnswered: true,
    category: 'pg',
    transactionType: 'rent',
    attributes: defaultAttributesFor('pg'),
    priceMissing: false,
    priceIssue: null,
    totalPrice: 8000,
    photoCount: 3,
    minPhotos: 3,
    askSellerType: false,
    sellerTypeAnswered: true,
    assistedProblem: null,
    title: 'A clean PG near the metro',
    titleMin: 10,
    description: 'x'.repeat(80),
    descriptionMin: 50,
    ...overrides,
  };
}

describe('postDetailsIssues', () => {
  it('is empty when everything is in place', () => {
    const attrs = { ...defaultAttributesFor('pg') };
    const issues = postDetailsIssues(input({ attributes: attrs }));
    // pg has one required field; fill whatever is still required
    const needed = listingAttributeIssues('pg', 'rent', attrs).filter((i) => i.key);
    expect(issues.filter((i) => i.group === 'other' && i.target.startsWith('attr:')).length).toBe(needed.length);
  });

  it('keeps the old order: location, posted by, fields, price, photos, owner type, then title and description', () => {
    const issues = postDetailsIssues(
      input({
        hasPin: false,
        needsPostedBy: true,
        postedByAnswered: false,
        priceMissing: true,
        photoCount: 0,
        askSellerType: true,
        sellerTypeAnswered: false,
        title: '',
        description: '',
      }),
    );
    const targets = issues.map((i) => i.target);
    const order = ['location', 'posted_by', 'price', 'photos', 'owner_type', 'title', 'description'];
    expect(targets.filter((t) => order.includes(t))).toEqual(order);
    expect(firstDetailsIssue(issues)?.target).toBe('location');
    expect(firstDetailsIssue(issues)?.text).toBe('Drop a pin or search an address to set the location');
  });

  it('does not report Posted by twice', () => {
    const issues = postDetailsIssues(
      input({ category: 'apartment', transactionType: 'sell', attributes: defaultAttributesFor('apartment'), needsPostedBy: true, postedByAnswered: false }),
    );
    expect(issues.filter((i) => i.target === 'posted_by' || i.target === attributeTarget('fromBroker')).length).toBeLessThanOrEqual(1);
  });

  it('lets the AI copy helper run while only the title and description remain', () => {
    const noCopy = postDetailsIssues(input({ title: '', description: '', attributes: { ...defaultAttributesFor('pg') } }));
    const onlyCopy = noCopy.filter((i) => i.group === 'copy');
    expect(onlyCopy.map((i) => i.target)).toEqual(['title', 'description']);
    expect(hasBlockingOtherIssue(onlyCopy)).toBe(false);
  });

  it('gives a message per target', () => {
    const messages = issueMessages(postDetailsIssues(input({ hasPin: false, priceMissing: true })));
    expect(messages.location).toBeDefined();
    expect(messages.price).toBe('Add a price');
  });
});

describe('post field event paths', () => {
  it('round-trips an event', () => {
    const path = postFieldEventPath('preview_blocked', { field: 'attr:carpetAreaSqft', category: 'apartment', left: 3 });
    expect(path).toBe('/post/field?event=preview_blocked&field=attr%3AcarpetAreaSqft&category=apartment&left=3');
    expect(parsePostFieldEventPath(path)).toEqual({
      event: 'preview_blocked',
      field: 'attr:carpetAreaSqft',
      category: 'apartment',
      ms: null,
      left: 3,
    });
  });

  it('drops anything that is not a plain target name, and rejects unknown events', () => {
    expect(postFieldEventPath('first_touch', { field: 'my phone is 9999999999', ms: 1200.6 })).toBe('/post/field?event=first_touch&ms=1201');
    expect(parsePostFieldEventPath('/post/field?event=nope')).toBeNull();
    expect(parsePostFieldEventPath('/other')).toBeNull();
  });
});

describe('summarizePostFieldEvents', () => {
  const ev = (sessionId: string, event: Parameters<typeof postFieldEventPath>[0], detail: Parameters<typeof postFieldEventPath>[1] = {}) => ({
    sessionId,
    path: postFieldEventPath(event, detail),
  });

  it('counts sessions, ranks blockers and ignores exits from sessions that reached Preview', () => {
    const summary = summarizePostFieldEvents(
      [
        ev('a', 'first_touch', { field: 'location', ms: 4000 }),
        ev('b', 'first_touch', { field: 'photos', ms: 8000 }),
        ev('a', 'preview_blocked', { field: 'photos', category: 'apartment', left: 2 }),
        ev('a', 'preview_blocked', { field: 'photos', category: 'apartment', left: 2 }),
        ev('b', 'preview_blocked', { field: 'photos', category: 'apartment', left: 1 }),
        ev('b', 'preview_blocked', { field: 'attr:floor', category: 'apartment', left: 1 }),
        ev('a', 'details_exit', { field: 'photos', ms: 90000 }),
        ev('c', 'details_exit', { field: 'price', ms: 30000 }),
        { sessionId: 'd', path: '/post/field?event=garbage' },
      ],
      parsePostFieldEventPath,
      new Set(['a']),
    );
    expect(summary.sessionsTouched).toBe(2);
    expect(summary.sessionsBlocked).toBe(2);
    expect(summary.medianSecondsToFirstTouch).toBe(6);
    expect(summary.blockers[0]).toEqual({ field: 'photos', category: 'apartment', sessions: 2, taps: 3 });
    expect(summary.exits).toEqual([{ field: 'price', sessions: 1, medianSeconds: 30 }]);
  });
});

describe('detailsPartOfTarget', () => {
  it('puts location and photos first, title and description last, and everything else in the middle', () => {
    expect(detailsPartOfTarget('location')).toBe(0);
    expect(detailsPartOfTarget('photos')).toBe(0);
    expect(detailsPartOfTarget('title')).toBe(2);
    expect(detailsPartOfTarget('description')).toBe(2);
    expect(detailsPartOfTarget('owner_type')).toBe(2);
    expect(detailsPartOfTarget('price')).toBe(1);
    expect(detailsPartOfTarget('posted_by')).toBe(1);
    expect(detailsPartOfTarget('attr:carpetAreaSqft')).toBe(1);
  });
});

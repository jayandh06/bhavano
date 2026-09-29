import type { ListingCategory, TransactionType } from '@bhavano/types';
import type { RequirementFeedFilters } from '@bhavano/types/requirementFeed';
import {
  REQUIREMENT_ATTRIBUTE_QUESTIONS,
  REQUIREMENT_TIMELINE_OPTIONS,
  amenityOptionsFor,
  intentOf,
  sizeQuestionFor,
  type RequirementCriteria,
} from '@bhavano/types/requirementQuestions';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Listings say `sell`; some older captures said `buy`. Both mean a purchase. */
export function normalizeTransaction(
  t: TransactionType | undefined | null,
): TransactionType | undefined {
  return t === 'buy' ? 'sell' : (t ?? undefined);
}

/** One of the viewer's live listings, as far as fitting a requirement goes. */
export interface InventoryItem {
  cityId: string;
  areaId: string;
  category: ListingCategory;
  transactionType: TransactionType;
}

export interface FeedRow {
  criteria: RequirementCriteria;
  createdAt: Date;
  moveInBy: Date | null;
  openToCalls: boolean;
}

/** Same city, category and transaction, in one of the requirement's areas. */
export function listingFits(
  criteria: RequirementCriteria,
  item: InventoryItem,
): boolean {
  return (
    criteria.cityId === item.cityId &&
    criteria.category === item.category &&
    normalizeTransaction(criteria.transactionType) ===
      normalizeTransaction(item.transactionType) &&
    (criteria.areaIds ?? []).includes(item.areaId)
  );
}

function overlaps(
  aMin: number | undefined,
  aMax: number | undefined,
  bMin: number | undefined,
  bMax: number | undefined,
): boolean {
  return (aMin ?? 0) <= (bMax ?? Infinity) && (bMin ?? 0) <= (aMax ?? Infinity);
}

function intersects(
  a: readonly (string | number)[],
  b: readonly (string | number)[],
): boolean {
  return a.some((value) => b.includes(value));
}

function attributeLabel(category: ListingCategory, key: string): string {
  return (
    REQUIREMENT_ATTRIBUTE_QUESTIONS[category].find((q) => q.key === key)
      ?.label ?? key
  );
}

/**
 * Whether a requirement passes the viewer's filters.
 *
 * A seeker who skipped a question is flexible on it, so a filter on that question keeps the
 * requirement — and says so in `unanswered`, so a broad match isn't read as a precise one.
 * Amenities run the other way round: they are the seeker's must-haves, so the requirement passes
 * only when every one of them is among what the viewer's property has.
 */
export function matchFeedFilters(
  row: FeedRow,
  f: RequirementFeedFilters,
  context: { now: Date; fitCount: number },
): { match: boolean; unanswered: string[] } {
  const c = row.criteria;
  const no = { match: false, unanswered: [] };
  const unanswered: string[] = [];

  if (f.city && c.cityId !== f.city) return no;
  if (f.areas?.length && !intersects(c.areaIds ?? [], f.areas)) return no;
  if (f.intent && intentOf(c.category, c.transactionType) !== f.intent)
    return no;
  if (
    f.transactionType &&
    normalizeTransaction(c.transactionType) !==
      normalizeTransaction(f.transactionType)
  )
    return no;
  if (f.category && c.category !== f.category) return no;

  if (f.minBudget !== undefined || f.maxBudget !== undefined) {
    if (c.minPrice === undefined && c.maxPrice === undefined)
      unanswered.push('Budget not given');
    else if (!overlaps(c.minPrice, c.maxPrice, f.minBudget, f.maxBudget))
      return no;
  }

  const size = c.category ? sizeQuestionFor(c.category) : undefined;
  if (f.bedrooms?.length && size?.kind === 'bedrooms') {
    if (!c.bedroomOptions?.length) unanswered.push('BHK not given');
    else if (!intersects(c.bedroomOptions, f.bedrooms)) return no;
  }
  if (
    (f.minSqft !== undefined || f.maxSqft !== undefined) &&
    size?.kind === 'area'
  ) {
    if (c.minAreaSqft === undefined && c.maxAreaSqft === undefined)
      unanswered.push('Size not given');
    else if (!overlaps(c.minAreaSqft, c.maxAreaSqft, f.minSqft, f.maxSqft))
      return no;
  }

  for (const [key, wanted] of Object.entries(f.attributes ?? {})) {
    if (!wanted.length || !c.category) continue;
    const answer = c.attributes?.[key];
    if (!answer?.length)
      unanswered.push(`${attributeLabel(c.category, key)} not given`);
    else if (!intersects(answer, wanted)) return no;
  }
  if (f.amenities) {
    const mustHaves = c.attributes?.amenities ?? [];
    if (!mustHaves.every((a) => f.amenities!.includes(a))) return no;
  }

  if (
    f.postedWithinDays &&
    row.createdAt.getTime() <
      context.now.getTime() - f.postedWithinDays * DAY_MS
  )
    return no;
  if (f.moveIn) {
    const days = REQUIREMENT_TIMELINE_OPTIONS.find(
      (o) => o.value === f.moveIn,
    )?.days;
    if (days === undefined) {
      if (row.moveInBy) return no;
    } else if (
      !row.moveInBy ||
      row.moveInBy.getTime() > context.now.getTime() + days * DAY_MS
    ) {
      return no;
    }
  }
  if (f.openToCalls && !row.openToCalls) return no;
  if (f.matchesMyListings && context.fitCount === 0) return no;

  return { match: true, unanswered };
}

/** Attribute answers and must-have amenities with their display labels, in question order. */
export function feedDetails(
  criteria: RequirementCriteria,
): { label: string; values: string[] }[] {
  const category = criteria.category;
  if (!category) return [];
  const attributes = criteria.attributes ?? {};
  const details = REQUIREMENT_ATTRIBUTE_QUESTIONS[category]
    .filter((q) => attributes[q.key]?.length)
    .map((q) => ({
      label: q.label,
      values: attributes[q.key].map(
        (v) => q.options.find((o) => o.value === v)?.label ?? v,
      ),
    }));
  if (attributes.amenities?.length) {
    const options = amenityOptionsFor(category);
    details.push({
      label: 'Must have',
      values: attributes.amenities.map(
        (a) => options.find((o) => o.value === a)?.label ?? a,
      ),
    });
  }
  return details;
}

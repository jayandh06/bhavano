import type { PageVisitHighlights } from '@bhavano/types';

/** A listing created in the session (Listing.createSessionId), reduced to what the highlight needs. */
export interface SessionListingFacts {
  publishState: string;
  status: string;
  expiresAt: Date;
  boostedUntil: Date | null;
  /** Whether any ListingBoost row exists: the listing was featured at some point, even if it has lapsed. */
  everBoosted: boolean;
}

export interface VisitHighlightInput {
  listings: SessionListingFacts[];
  /** Every account that logged in during the session (Visit.userId plus LoginEvent), de-duplicated. */
  userIds: string[];
  /** Accounts with at least one paid Payment, ever. */
  paidUserIds: ReadonlySet<string>;
  /** Accounts holding a paid product right now: an unexpired subscription, boost or instant-alerts window. */
  activeUserIds: ReadonlySet<string>;
  now: Date;
}

/** Page-visits row highlights (docs/plans/admin-page-visit-highlights.md). Ad and featured are about what this
 * session created; purchased and active-purchase are about the person, so every later visit of a buyer shows them. */
export function visitHighlights({ listings, userIds, paidUserIds, activeUserIds, now }: VisitHighlightInput): PageVisitHighlights {
  let ad: PageVisitHighlights['ad'] = null;
  let featured: PageVisitHighlights['featured'] = null;

  for (const l of listings) {
    // "Live" is a listing a visitor can see today; "pipeline" is posted but not yet live (waiting for checkout, or scheduled).
    const live = l.publishState === 'live' && l.status === 'active' && l.expiresAt > now;
    const pipeline = l.publishState === 'pending_checkout' || l.publishState === 'scheduled';
    if (live) ad = 'live';
    else if (pipeline && ad === null) ad = 'pipeline';

    if (l.boostedUntil && l.boostedUntil > now) featured = 'active';
    else if (l.everBoosted && featured === null) featured = 'past';
  }

  return {
    ad,
    featured,
    purchased: userIds.some((id) => paidUserIds.has(id)),
    activePurchase: userIds.some((id) => activeUserIds.has(id)),
  };
}

/** True when any highlight applies, so a quiet row can be left unstyled. */
export function hasHighlight(h: PageVisitHighlights): boolean {
  return h.ad !== null || h.featured !== null || h.purchased || h.activePurchase;
}

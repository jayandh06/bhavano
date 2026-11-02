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

/** A requirement posted during the session, reduced to what the highlight needs. */
export interface SessionRequirementFacts {
  status: string;
  expiresAt: Date;
}

/** How far past a session's last activity a requirement may be created and still count as made in it (the visit's last-activity
 * stamp is written by a later request than the one that saved the requirement). */
export const REQUIREMENT_SESSION_SLACK_MS = 15 * 60 * 1000;
/** And how long before the visit row was created (clock differences between the two writes). */
export const REQUIREMENT_SESSION_LEAD_MS = 60 * 1000;

export interface VisitHighlightInput {
  listings: SessionListingFacts[];
  /** Requirements created by an account of the session while the session was running. */
  requirements?: SessionRequirementFacts[];
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
export function visitHighlights({ listings, requirements = [], userIds, paidUserIds, activeUserIds, now }: VisitHighlightInput): PageVisitHighlights {
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

  let requirement: PageVisitHighlights['requirement'] = null;
  for (const r of requirements) {
    if (r.status !== 'closed' && r.expiresAt > now) requirement = 'open';
    else if (requirement === null) requirement = 'closed';
  }

  return {
    ad,
    featured,
    requirement,
    purchased: userIds.some((id) => paidUserIds.has(id)),
    activePurchase: userIds.some((id) => activeUserIds.has(id)),
  };
}

/** True when any highlight applies, so a quiet row can be left unstyled. */
export function hasHighlight(h: PageVisitHighlights): boolean {
  return h.ad !== null || h.featured !== null || h.requirement !== null || h.purchased || h.activePurchase;
}

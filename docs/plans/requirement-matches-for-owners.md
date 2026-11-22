# Show owners the requirements that match their ad, where they already are

## Status: My listings built (2026-11-22); post-success and owner alerts not built

**As built:** BFF `listMine` adds `matchingRequirementCount` (active live ads, only when above zero) from
`countFittingRequirements` in `requirements/requirement-lead-ready.ts`, which shares `loadLeadReadyRows` with the
Requirements tab so the two cannot disagree. Web `MyListingRow` shows "N people are looking for this" linking to
`/requirements/<city>?areas=<area>&type=<category>&txn=<txn>` (`lib/requirementMatchLink.ts`). Mobile shows the same
line but can only open the Requirements tab, because that tab keeps its filters in its own state and does not read
URL params, so the list there is not narrowed to the ad (mobile needs an app release anyway). Measurement events
from the plan are not added yet.

**Idea (owner, 2026-11-22):** put seekers' requirements in front of owners as "wanted" cards so an owner can
see the need and act on it.

**Decision:** do not mix requirement cards into the main browse grid. Surface a per-ad match count where owners
already are (My listings, right after posting, later in owner alerts), linking into the existing Requirements
tab. Build My listings first.

## Why not the main grid

- The Requirements tab already exists for owners and agents (web Phase 1 built 2026-09-29, mobile 2026-10-02,
  `requirements-feed-for-owners-agents.md`). The old `/requirements/matching` page now just redirects to
  `/requirements?matches=1`.
- Volume is small: when that tab was planned there were 64 open requirements nationally (about 5 new a day, 13
  cities) and only 9 lead-ready. A mixed grid would show one uneven card every few rows.
- The grid's audience is seekers; a "Wanted" card is for owners and agents. For seekers it is noise, and it would
  expose other seekers' needs to everyone (today only eligible owners and agents see them, with consent rules in
  `requirement-leads-for-brokers.md`).
- A requirement has budget, areas and a deadline, not photos or a price, so it does not fit the listing card.

## What exists today (checked in the code)

- `RequirementFeedService.feed` builds the tab: lead-ready rows only (`leadReadyRows`: open or working, not
  expired, city, category and transaction set, not the viewer's own), for eligible viewers (owner/agent seller
  type, Agent Pro, or at least one listing).
- `listingFits(criteria, item)` in `requirement-feed.ts`: same city, same category, same transaction, and the
  listing's area is one of the requirement's areas. The feed already counts `fitCount` per requirement from it.
- `?matches=1` filters the tab to requirements the viewer's listings fit. Other filters deep-link too
  (`city`, `areas`, `intent`, `txn`, `type`, `minBudget`, `maxBudget`, `bhk`; see `requirementFeed.ts`).
- `listMatchingOwnerInventory` is a looser, owner-level match (city and category, area optional) used by the
  match email; it is not what the tab shows.
- Seekers are never identified in any of this; contact follows the consent rules in the leads plan.

## Design

### 1. My listings: "N people want this" (build first)

- **BFF:** add `matchingRequirementCount?: number` to the owner's own listing DTO (`getMine` only). Compute it
  once per request: load the lead-ready rows once (about 64 nationally, so cheap), then count per listing with
  `listingFits`. Use the same rule as the tab so the number equals what the link shows. Never returned for other
  people's listings.
- **Web:** on `MyListingRow` for active ads with a count above 0, one line: "3 people are looking for this",
  linking to `/requirements?matches=1` narrowed to the ad's city, area and type (deep-link with the existing
  filters). Nothing when 0.
- **Mobile:** same line on `my-listings/index.tsx`, opening the Requirements tab with the same filters. Needs an
  app release; web can ship first.

### 2. Right after posting

- The post-success page shows the count for the ad just published: "3 open requirements match this ad", with
  the same link. When 0: "We will tell you when someone looks for this", pointing at owner alerts. Do not
  fabricate a number; show nothing if the count could not be computed.

### 3. Owner alerts (later)

- Add "or N people are looking for this" to the interest alert only after 1 and 2 show owners use it.

### Not doing

- No requirement cards in the main grid, and no "Wanted" strip for seekers.
- No change to who may see a requirement, to consent, or to what contact detail is shown.
- No looser matching than the tab uses; a count the tab then contradicts would erode trust.

## Measure first, and after

1. Before building: how many owners open `/requirements` today, and how many act (the leads plan's contact path
   is the action). **Not measured yet.** If almost nobody opens it, that is the problem this plan addresses.
2. After: clicks on the My listings and post-success links (reuse the `/get-app?event=...&placement=...`
   page-view pattern with placement `req_match_my_listings` / `req_match_post_success`), then tab opens and
   leads acted on by owners who clicked, versus those who did not.

## Risks and open questions

- **Low counts:** with about 9 lead-ready requirements nationally, most ads will show nothing. That is correct,
  and the post-success empty state keeps the feature useful. Revisit once the Seeker campaigns raise demand.
- **Stale counts:** requirements expire; compute on request, do not cache on the listing.
- **Cost:** one extra query on My listings and post-success. Fine at this volume; if requirements grow into the
  thousands, count in SQL per city instead of loading every row.
- Open: should Featured owners see the count with detail (budgets) while others see only the number? Decide with
  the leads plan's pricing, not here.

## Rollout

1. Measure step 1 (a read-only query on requirement tab visits and lead actions).
2. BFF field and tests (`listingFits` per listing, owner-only, zero case), then web My listings, then
   post-success; ship web.
3. Mobile with the next app release.
4. Review after 2 weeks against the measurements above.

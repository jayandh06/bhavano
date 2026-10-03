# Requirements tab for owners and agents

Status: **Phase 1 (web, browse-only) built** (2026-09-29); **Phase 3 (mobile) built** (2026-10-02),
**placement revised** (2026-10-03 — see Placement below). Phases 2 and 4 are still plans.

A new **Requirements** tab where owners and agents browse every open, usable requirement that
seekers have posted, filtered by city and then by the fields that make sense for the chosen
transaction and property type.

Builds on, and must stay consistent with:

- [`property-requirements-demand-side.md`](property-requirements-demand-side.md): the capture flow,
  privacy rules, and the earlier "no separate top-level tab" decision, revisited below.
- [`requirement-refinement-questions.md`](requirement-refinement-questions.md) (built): the
  structured fields the filters are built from.
- [`requirement-leads-for-brokers.md`](requirement-leads-for-brokers.md) (plan): contact rules, the
  per-lead cap, and the lead card. This tab is where that plan's lead cards get browsed.

## Why now, and what the numbers say (production, 2026-09-29)

- **64 open requirements**, about 5 new a day since 2026-09-17, spread over 13 cities. Bengaluru has
  12; most cities have 1–6.
- **Only 9 are lead-ready** (city, 1–5 areas, transaction and property type all set). **47 have no
  transaction or property type at all**: they were captured before the refinement flow existed.
- 63 of the 64 open requirements have contact consent.
- Supply side: **199 real listing owners** (excluding Bulk Import), but `sellerType` is set on only
  11 accounts (9 owner, 2 agent). 430 users have it null. One active Agent Pro.

So today the tab would show about 9 cards nationally. The design has to work at this volume: honest
empty states, city counts, and a "tell me when new ones arrive" hook. A dense marketplace-style grid
would look broken.

The only place an owner sees demand today is `/requirements/matching`. It shows requirements that
match their own inventory and is reached only from a digest link. Agents without listings in
Bhavano's inventory never see anything.

## Revisiting "no separate top-level tab"

The demand-side plan rejected a top-level tab for two reasons:

1. The home tabs are listing intent filters (Buy, Rent & Lease, PG…).
2. The mobile bar has only 4 slots.

Both have changed enough to revisit:

- The web category row already has two non-intent links, **Tools** and **Plans**
  (`CategoryTabs.tsx`). A **Requirements** link next to them follows an existing pattern.
- On mobile the tab can be **shown only to owners and agents** (expo-router `href: null` hides a tab
  from everyone else). Seekers keep their 4-tab bar.

What that plan got right still holds:

- seekers shouldn't be pushed into a supply-side screen;
- individual requirements are never indexed;
- the tab isn't a replacement for surfacing demand where supply already is (`/my-listings`, the
  owner digest).

## Who can see what

| Visitor | What they get |
|---|---|
| Logged out | `/requirements` summary: counts per city and per type, and "Are you an owner or agent? Sign in to see them". A "Post your requirement" link for seekers. No cards. |
| Signed in, not yet an owner or agent | A one-tap question: "I'm an owner", "I'm an agent", or "I'm looking for property". The first two set `sellerType` and open the feed. The last one goes to `/my-requirements`. |
| Owner or agent | The full feed and filters. |

**Owner or agent** means any one of:

- `sellerType` is `owner` or `agent`;
- the user has at least one live listing that isn't Bulk Import;
- the user has an active Agent Pro plan (`agentProUntil` in the future);
- the user is an admin.

The role question also fills in `sellerType` for the many accounts where it's null. That helps the
Owner/Agent question on the post-ad preview, and it helps agent ranking in the leads plan.

**Never shown on a card:**

- seeker name, phone or email;
- the seeker's free-text `note`, which in practice can contain phone numbers and names;
- `adminNote`;
- the seeker's own `searchLabel` wording.

Contact is reached only through the leads plan's actions (below).

## Placement

- **Web:** a **Requirements** link in the category row after Plans, and in `HeaderDrawer`. It shows
  for every visitor, because city pages are cached for everyone; a role-dependent header would break
  that or cause layout shift. The logged-out summary page makes the link worth showing to everyone.
- **Web URLs:**
  - the feed is `/requirements` and `/requirements/{city-slug}`, matching the demand-side plan's URL
    space;
  - filters are query params made of slugs, never ids (`?intent=rent-lease&type=apartment&areas=hsr-layout,koramangala&bhk=2,3`);
  - the page is `noindex` in this plan and there is no sitemap change. Indexable city aggregates
    stay a later phase of the demand-side plan, gated on volume.
- **`/requirements/matching`** becomes the feed with the "Only ones my listings fit" toggle on. It
  301-redirects to `/requirements?matches=1`, and digest links move to the feed.
- **Mobile (2026-10-02, revised 2026-10-03):** originally a 5th bottom tab gated on
  `looksLikeOwnerOrAgent(profile)`, with an Account-screen row as the pre-eligibility fallback. Moved
  instead to a chip in `CategoryChips` (`(tabs)/index.tsx`'s Home feed), alongside PG/Furniture/
  Interiors — open to everyone the same way those are, not gated on looking like an owner/agent.
  Unlike those chips it isn't a `HomeTabValue`: tapping it pushes `/requirements` rather than
  filtering the home feed, since Requirements is its own screen with its own feed, not another slice
  of the listings one. The bottom tab bar's 5th slot now shows **My Listings** (if the viewer has a
  live listing, from `profile.activeListingCount`) or **Favourites** otherwise — unrelated to this
  feature, it just took over the slot Requirements vacated. The Account-row fallback was removed:
  its only reason to exist was finding the feature before the gated tab appeared, which no longer
  applies now that the entry point is unconditional.

## What's in the feed

- `status = open`, not expired, and **lead-ready** (`isLeadReady`). A requirement that's too vague
  to act on is never sent to a broker, and it isn't shown here either.
  - The 47 legacy rows stay hidden until the seeker completes them through the existing refine nudge
    (`refineNudgedAt`).
- Excludes the viewer's own requirements.
- Sorted newest first by default. Also sortable by "Moving in soonest" and by "Best match for my
  listings" (the existing inventory match, extended to `areaIds`).

### The card

- The refined label (`formatRequirementLabel`), e.g. "2–3 BHK apartment for rent in HSR Layout,
  Koramangala".
- Budget range (`formatCompactInr`), size or BHK, and chips for attributes and must-have amenities.
- Move-in: Immediately, Within a month, In 1–3 months, or Just exploring.
- Posted "3 days ago", and "Updated" if refined since posting.
- Consent state: **Open to calls** or **Messages only**.
- "Your listings that fit: 2", when the viewer has matching inventory.
- Once the leads plan ships: "2 of 5 spots taken" or "This lead has been taken".

## Filters

Filters follow the capture flow's order and use the same config in
`packages/types/src/requirementQuestions.ts`. The filter UI and the capture UI can't drift apart.

### Always shown

| Filter | Source | Notes |
|---|---|---|
| City | `cityId` | Taken from the path: `/requirements` is all cities and `/requirements/{city}` is one. The nav links open the city the visitor is browsing. Each city chip shows a count, and only cities with requirements are listed. |
| Areas | `areaIds` (up to 5 per requirement) | Multi-select within the city. Matches if the requirement names any selected area. |
| Intent | `REQUIREMENT_INTENTS` | Buy, Rent & Lease, PG, Furniture, Interiors. |
| Posted within | `createdAt` | Any, 7 days, 30 days. |
| Move-in | `moveInBy`, using `REQUIREMENT_TIMELINE_OPTIONS` | Immediately, Within a month, In 1–3 months, Just exploring. |
| Open to calls only | `contactConsentAt` | |
| Only ones my listings fit | inventory match | Shown only to viewers with live listings. |

### Shown once intent is chosen

| Filter | Source |
|---|---|
| Rent or lease; for furniture, buy or rent | `INTENT_TRANSACTION_CHOICES` |
| Property type | `INTENT_CATEGORIES[intent]` |
| Budget | `minPrice` and `maxPrice`. Only after the transaction is known, because a monthly rent and a sale price aren't comparable. Presets come from `budgetPresetsFor`. |

### Shown once property type is chosen

| Property type | Size filter (`sizeQuestionFor`) | Attribute filters (`REQUIREMENT_ATTRIBUTE_QUESTIONS`) | Amenities |
|---|---|---|---|
| House, apartment, villa | BHK 1–5+ (`bedroomOptions`) | Furnishing; Who's moving in? (rent and lease only) | `amenityOptionsFor(category)` |
| PG | none | Sharing, For (gender), Meals included? | yes |
| Plot | Plot size (`minAreaSqft`/`maxAreaSqft`, entered in sqft, cent, acre…) | Preferred facing | per category |
| Commercial | Floor area | What is it for?, Furnishing | per category |
| Storage | Space needed (sqft) | Access needed | per category |
| Coworking | none | Seat type | per category |
| Furniture | none | New or used?, Material | none |
| Interiors | none | What work do you need? | none |

An attribute question with `transactionTypes` set (e.g. "Who's moving in?") only appears for those
transactions.

### How a filter matches

A seeker who skipped a question is flexible on it, not excluded by it. So each filter keeps a
requirement that either matches **or didn't answer that question**:

- **BHK:** `bedroomOptions` overlaps the selected set, or is empty.
- **Budget:** the ranges overlap. A missing minimum counts as 0 and a missing maximum as no limit.
  A requirement with no budget matches any budget filter.
- **Size:** compared in sqft (`minAreaSqft`/`maxAreaSqft` are already normalised). The size filter
  converts from whichever unit the viewer picks.
- **Attributes and amenities:** for each selected key, the requirement's `attributes[key]` overlaps
  the selection, or the key is absent. Amenities are must-haves on the seeker's side, so a
  requirement matches only if **all** its must-haves are among what the viewer selected. That works
  like "can my property satisfy this".
- **Areas:** `areaIds` overlaps the selection.

Each card shows which filters matched only because the seeker didn't answer, e.g. "Budget not
given". This way a broad match isn't mistaken for a precise one.

## Actions on a card

Contact follows the leads plan exactly. This tab doesn't add a new way to reach seekers.

1. **Post a matching ad.** Opens `/post` prefilled with the requirement's city, area, transaction,
   property type and BHK.
   - This works today with no new backend: the requirement's saved-search alert (`savedSearchId`,
     created at capture when the seeker's alert allowance allows) already sends new matching
     listings to the seeker.
2. **Send a listing** (leads plan, `POST /requirements/:id/leads/send-listing`). Pick one of the
   viewer's live listings that fits. This creates a `requirement_lead` conversation in the seeker's
   inbox. It works with or without consent.
3. **View contact** (leads plan, `POST /requirements/:id/leads/reveal`). Only for consenting
   requirements. It's subject to:
   - `maxBrokersPerLead` (5) and `dailyLeadsPerBroker`;
   - a verified phone on the viewer's account;
   - the free allowance.
   It writes `RequirementLead`.

**Difference from the leads plan.** There, lead access is offered to brokers matched by inventory or
a declared service area. Here any owner or agent can browse. The proposal is that **any verified
owner or agent may open a lead within the caps**, because agents without Bhavano inventory are
exactly who this tab is for. The per-lead cap of 5 and the daily cap keep one seeker's number from
spreading. Open decision 2 below.

## API

- `GET /requirements/feed` (AuthGuard). For a signed-in user who isn't an owner or agent it
  returns 200 with `eligible: false` and no items, and the page shows the role question. Query
  params:
  - location and type: `city`, `areas`, `intent`, `txn`, `type`;
  - budget and size: `minBudget`, `maxBudget`, `bhk`, `minSqft`, `maxSqft`;
  - details: `attr_<key>` (comma-separated values), `amenities`;
  - timing and contact: `posted` (7 or 30), `movein`, `calls=1`;
  - view: `matches=1`, `sort=soonest`.

  The web page's URL uses the same parameter names, with slugs where the BFF takes ids (the city is
  in the path, areas are slugs). Both ends go through `decodeRequirementFeedQuery` and
  `encodeRequirementFeedQuery` in `packages/types/src/requirementFeed.ts`. Values that aren't
  recognised are dropped rather than refused, so a stale shared link widens the list instead of
  breaking the page.

  The response is `{ eligible, items, total, hasListings, facets }`:
  - `items` holds the first 50 cards, and `total` is the full match count. There's no cursor yet;
    add one when a single filter view regularly passes 50.
  - `facets.cities` counts under every filter except the place.
  - `facets.areas` counts within the chosen city, under every filter except the areas.
  - `facets.intents` and `facets.categories` count within the chosen place.
- `GET /requirements/feed/summary?city=<id>`: public and counts only. The web caches it for 5
  minutes.
- The DTOs live in `packages/types/src/requirementFeed.ts` (a new subpath export), and `dist/` must
  be rebuilt. The card carries only the card fields listed above, with display labels resolved on
  the server (area names, attribute labels) and never seeker fields. The label is regenerated with
  `formatRequirementLabel` rather than read from `searchLabel`.
- `RequirementFeedService` loads every open, unexpired requirement (up to 2,000) and filters in
  memory with `matchFeedFilters` (`requirement-feed.ts`). That keeps the rule that an unanswered
  question still counts as a match in one tested function instead of a SQL builder. Move the
  coarse filters (`status`, `cityId`, `category`, `transactionType`) into SQL, with a composite
  index, when open requirements approach that cap.
- Throttled to 60 requests a minute on both endpoints, so one account can't copy the whole demand
  map.

## Phases

1. **Web feed, browse-only (no schema change).**
   - The feed endpoint, summary endpoint, DTO and role check;
   - `/requirements` and `/requirements/{city}` with filters;
   - the role question writing `sellerType`;
   - the category-row and drawer links;
   - `/requirements/matching` redirects to the feed;
   - the "Post a matching ad" prefill.

   This can ship right away and needs nothing from the leads plan.

   **Built (2026-09-29):**
   - size is offered as sqft bands rather than free min/max inputs, so every filter is a plain link
     and the page works fully server-rendered;
   - the web no longer calls `GET /requirements/matching`; the BFF endpoint is left in place, unused;
   - requirements that the old matching page showed without a property type no longer appear, per
     decision 4.
2. **Contact actions:** leads plan Phase 1 (`RequirementLead`, `requirement_lead` conversation type,
   send-listing, capped reveal, the seeker's "who has my number", withdraw and report). They're
   exposed on these cards and on the digest.
3. **Mobile:** the feed screen and the filter sheet (placement below revised 2026-10-03).

   **Built (2026-10-02):**
   - `fetchRequirementsFeed`/`fetchRequirementsFeedSummary` (bffClient.ts) call the same
     `GET /requirements/feed` and `/requirements/feed/summary` web uses — `city`/`areas` are always
     plain ids on this end (mobile has no SEO path to keep them readable in, unlike web's slugs),
     which `requirement-feed.ts`'s matcher already compares by plain equality either way;
   - `RequirementsFeedFilters.tsx`: the same sections as web's `FeedFilters` sidebar, as a
     staged-then-Apply bottom sheet (same pattern as the listings `FilterSheet`) instead of web's
     plain links, since there's no URL here to drive the state from;
   - "Post a matching ad" on mobile's card opens `/post` plain, with none of web's prefill
     (city/area/transaction/property type/BHK): mobile's `PostAdWizard` has no preset props to
     receive them yet. Left for its own change rather than guessed at here.

   **Revised (2026-10-03):** the 5th-tab + Account-row placement replaced by a `CategoryChips` entry
   — see Placement above. The feed screen, filters and BFF calls above are unchanged.
4. **"New requirements in my city" alert:** a saved feed filter that joins the existing daily owner
   digest (`RequirementMatchJob`), not a separate message. It's the answer to the low-volume problem:
   check once, get told when something new fits.

## Measurement

- Weekly unique owners and agents opening the feed, and how many came from the role question.
- Feed to action: "Post a matching ad" started and finished, "Send a listing", "View contact".
- For requirements shown in the feed: share closed as "I found something" within 30 days, compared
  with before launch.
- `sellerType` null rate among active posters, which should drop.
- Guardrail: seeker reports per 100 contact actions (the leads plan's metric).

## Decisions (2026-09-29)

1. **Tab label:** "Requirements".
2. **Who may open a lead:** any verified owner or agent within the caps. This widens the leads
   plan's matched-audience rule for access from this tab. The per-lead and daily caps are unchanged.
3. **Logged-out summary:** per-city and per-type counts, no cards.
4. **Legacy vague requirements:** stay hidden until the seeker completes them.
5. **Next step:** build Phase 1 (web, browse-only).

## Open decisions

1. **Seeker note:** stays hidden for now. Revisit showing it once phone numbers and emails are
   automatically stripped from it.

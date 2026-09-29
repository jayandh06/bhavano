# Requirements tab for owners and agents

Status: **plan, not built** (2026-09-29).

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
- **Mobile:** a 5th tab, **Requirements**, in `(tabs)/_layout.tsx`, with `href: null` unless the
  user is an owner or agent. Filters open in a bottom sheet. The Account screen gets a row for the
  same screen, so the feature can be found before the tab appears.

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
| City | `cityId` | Required. Default: the city of the viewer's most recent live listing, otherwise their profile city, otherwise the city with the most requirements. Each option shows a count. |
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

- `GET /requirements/feed` (AuthGuard plus the owner-or-agent check; otherwise 403 with code
  `NOT_OWNER_OR_AGENT`, which the client turns into the role question). Query params:
  - location and type: `city`, `areas`, `intent`, `transactionType`, `category`;
  - budget and size: `minBudget`, `maxBudget`, `bhk`, `minSqft`, `maxSqft`;
  - details: `attr.<key>` (repeatable), `amenities`;
  - timing and contact: `postedWithin`, `moveIn`, `openToCalls`;
  - view: `matches`, `sort`, `cursor`.

  The response is `{ items: RequirementFeedCardDto[], total, facets }`. `facets` holds counts per
  city, intent and category under the current filters, for the "(3)" badges and the empty states.
- `GET /requirements/feed/summary?city=`: public, counts only, and cached for 5 minutes.
- `RequirementFeedCardDto` goes in `packages/types`, and `dist/` must be rebuilt. It carries only
  the card fields listed above: display labels resolved on the server (area names, attribute labels),
  never seeker fields.
- The service method is a Prisma query on `status`, `cityId`, `category`, `transactionType`,
  `createdAt`. Array overlaps on `areaIds` and `bedroomOptions` use `hasSome`, with a raw
  `jsonb ?|` for attributes. At about 100 rows no new index is needed. Add a GIN index on `areaIds`
  and a composite `[status, cityId, category, createdAt]` when the table passes about 10k rows.
- A rate limit on the feed endpoint (e.g. 60 requests a minute per user) keeps someone from scraping
  the whole demand map.

## Phases

1. **Web feed, browse-only (no schema change).**
   - The feed endpoint, summary endpoint, DTO and role check;
   - `/requirements` and `/requirements/{city}` with filters;
   - the role question writing `sellerType`;
   - the category-row and drawer links;
   - `/requirements/matching` redirects to the feed;
   - the "Post a matching ad" prefill.

   This can ship right away and needs nothing from the leads plan.
2. **Contact actions:** leads plan Phase 1 (`RequirementLead`, `requirement_lead` conversation type,
   send-listing, capped reveal, the seeker's "who has my number", withdraw and report). They're
   exposed on these cards and on the digest.
3. **Mobile:** the owner/agent-only 5th tab, the filter sheet, and the Account row.
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

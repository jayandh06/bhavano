# Requirement refinement: asking what the search couldn't tell us

**Status: Phases A (web + backend) and B (mobile) built 2026-09-28, not yet deployed.** The
migration `20260928090000_requirement_refinement` has to be applied on deploy. Phases C–D are
still plans. Where the build differs from the design below, see *What shipped in Phases A and B*,
near the end. Extends
[property-requirements-demand-side.md](property-requirements-demand-side.md) — read that first; this
doc assumes its Phase 0/1 design (one-tap capture, consent, 30-day expiry, `RequirementMatchJob`).
What a refined requirement is *for*, a lead to brokers and agents in the named areas, is planned in
[requirement-leads-for-brokers.md](requirement-leads-for-brokers.md).

## The problem

Today "Yes, find this for me" stores whatever the page happened to be showing, verbatim:

- *"Rent Properties in Chennai"* — no property type, no BHK, no budget, the whole city.
- *"Rent 1 BHK Apartments in Chennai"* — better, but still the whole city and no budget.
- *"Rent 2 BHK Houses in Bengaluru"* — a city of 700+ km².

Those rows are nearly useless to the person working the queue and to `RequirementMatchJob`: an
owner in Adyar can't tell whether a seeker who "wants something in Chennai" would take their flat,
and the admin has to phone every seeker just to learn the basics. Worse, some of the precision the
seeker *did* express is thrown away before it reaches the row:

- The web multi-select **Areas** filter is dropped (`BrowseListingsView` passes only the single
  path `areaId` — "any of these five is not a requirement").
- The BHK **set** becomes one number (`Math.min(...bedrooms)`), so "2 or 3 BHK" is stored as "2".
- Mobile's `deriveHomeRequirementCriteria` omits `areaId` entirely and, on the **All** tab, sends no
  category or transaction type at all.
- Amenities, furnishing, PG sharing, furniture condition and interiors service type — all browse
  filters today (`ListListingsDto`) — have no column to land in.

## Goal

After the seeker taps **Yes, find this for me**, ask a short, adaptive set of questions so the saved
requirement says:

1. **Transaction** — Buy / Rent & Lease / PG / Furniture / Interiors.
2. **Category** — House / Apartment / Villa / Plot / Commercial / Storage / Coworking (options depend
   on the transaction).
3. **Category-specific need** — BHK for homes, land area for plots, floor area and purpose for
   commercial, sharing and gender for PG, condition for furniture, service type for interiors.
4. **Specific areas** of the city, not the whole city.
5. **Budget**, in the unit that transaction is priced in (monthly rent, lease amount, sale price,
   per-bed, per-seat, project cost).
6. **Must-have amenities**, only those that exist for that category.
7. **Timeline** (move-in by) and an optional note. Both already exist as columns.

Success: most refined requirements name at least one area and a budget, and the one-tap capture rate
does not drop.

## The constraint this must not break

The parent plan's central finding was that **forms kill this**. `SavedSearch` sat at **0 rows**
partly because it asked people to retype criteria, and capture works because it is a one-tap
confirmation of a search the visitor already made. So:

- **Save first, then refine** (the original recommendation). "Yes" writes the row exactly as today,
  with consent and alert, and *then* the questions open against that saved row. Every answered step
  is saved as it is answered. Someone who closes the wizard after one question still leaves a
  requirement, and it is better than today's. *Reversed 2026-09-28: the requirement is now created
  at the end of the questions, complete — see "Created at the end, complete" under What shipped.*
- **Every step is skippable** ("Any" / "Skip"), prefilled from the search, and **skipped entirely
  when the search already answered it** (a `/chennai/adyar/rent/apartment?bedrooms=2` search opens
  straight at Budget).
- **One question per screen**, chips rather than inputs wherever a finite list exists, a visible
  "2 of 5" progress count that only counts the steps actually being asked.

The alternative, asking the questions *before* saving, was listed under open decisions. It gives
cleaner rows but puts a form in front of the only capture path that has ever worked. It is the one
that shipped: a vague requirement was judged worse than none.

## The question flow

Steps are driven by a shared config (see *Shared vocabulary* below) so web and mobile ask the same
things in the same order. Order is by **value to matching**, not by the user's mental model: the
earlier steps are the ones a drop-off can least afford to lose.

| # | Question | Asked when | Options | Stored as |
|---|---|---|---|---|
| 1 | What are you looking for? | No category/transaction known (mobile **All** tab, generic pages) | Buy · Rent & Lease · PG · Furniture · Interiors | `transactionType` + category group |
| 1b | Rent monthly or lease? | Rent & Lease chosen | Rent (monthly) · Lease (lump sum) | `transactionType` = `rent` \| `lease` |
| 1c | Buy or rent furniture? | Furniture chosen | Buy · Rent | `transactionType` = `sell` \| `rent` |
| 2 | What type of property? | Buy / Rent & Lease without a category | Buy: House · Apartment · Villa · Plot · Commercial. Rent & Lease: House · Apartment · Villa · Commercial · Storage · Coworking (the existing `HOME_TABS` sub-filters) | `category` |
| 3 | Category specifics | Always, unless already answered | see table below | `bedroomOptions`, `minAreaSqft`/`maxAreaSqft`, `attributes` |
| 4 | Which areas of {city}? | Always, unless the search already named areas | Multi-select from the city's areas, searchable, "nearby" suggestions, up to 5. "Anywhere in {city}" is a secondary link, not a chip | `areaIds` |
| 5 | What's your budget? | Always, unless the search had min/max | Presets for this transaction + category (below), plus "Custom" (min/max inputs) | `minPrice`/`maxPrice` |
| 6 | Any must-haves? | Only categories that declare amenities (homes, PG, coworking) | `amenityFieldsFor(category)` as multi-select chips | `attributes.amenities` |
| 7 | When do you need it? | Always | Immediately · Within a month · 1–3 months · Just exploring, plus an optional note | `moveInBy`, `note` (existing) |
| 8 | Review | Always | Regenerated label, each line tappable to jump back to its step | `searchLabel`, `refinedAt` |

Consent is **not** re-asked. It is captured on the Yes card, as today, and shown read-only on
the review screen.

### Step 3: category specifics

All options come from `CATEGORY_FIELD_CONFIG`, the posting wizard's own vocabulary, so a
requirement can never ask for a value no listing can hold.

| Category | Questions | Notes |
|---|---|---|
| House / Apartment / Villa | **BHK** (multi: 1, 2, 3, 4, 5+) · **Furnishing** (Any / Unfurnished / Semi / Furnished). Rent only: **Who's moving in?** (`preferredTenantTypes`), pets, vegetarian | BHK uses `MAX_BEDROOMS`/`bedroomLabel` like both FilterSheets |
| Plot | **Plot size** range with a unit picker (sqft / cent / acre / hectare / sqm) · facing (optional) | Normalized to sqft for matching; the unit is kept for display |
| Commercial | **Purpose** (config options) · **Floor area** range + unit · furnishing | |
| Storage | **Size** range (sqft) · access hours | |
| Coworking | **Seat type** | |
| PG | **Sharing** (multi) · **Gender** · **Meals** | Category fixed by the tab, so step 2 is skipped |
| Furniture | **Condition** · material (optional) | No item-type field exists in the config. The note ("a 3-seater sofa") carries it until one does |
| Interiors | **Service type** (replaces step 2) · home size in BHK (optional, scopes the job) | |

### Step 5: budget presets

Stored as plain `minPrice`/`maxPrice` rupees. As shipped, the only check was min ≤ max, not
`PRICE_BOUNDS` (those bound what a listing may ask, not what a seeker may offer).

**Update (2026-10-07): added a floor check, after a real example got through with no validation
at all** — "2 BHK apartment for rent in JP Nagar, Bengaluru · up to ₹7/month". The reasoning above
(a seeker's budget isn't a listing's ask) still holds for the *ceiling* — a seeker can legitimately
want to spend more than a typical listing in the category asks, so `PRICE_BOUNDS`' max is still
never applied here. But a value below `PRICE_BOUNDS`' *min* for the category/transaction (₹7 for
an apartment) was never a real figure either way — `requirementBudgetIssue()`
(`packages/types/src/priceBounds.ts`) checks only that floor, called from `RequirementsService.
create()`/`refineMine()` (BFF, the authority) and mirrored client-side in both wizards
(`RequirementRefineWizard.tsx`, web + mobile) so the warning shows at the budget step itself
rather than only after submitting. Scoped to the field(s) a given patch actually sets — a refine
that doesn't touch budget never re-validates whatever a pre-existing row already has stored, so a
row saved before this check existed (the exact ₹7 case above) stays editable for everything else.

The preset set depends on how that transaction is priced:

| Transaction / category | Unit shown | Presets |
|---|---|---|
| Rent: home | per month | < ₹10k · 10–20k · 20–35k · 35–60k · 60k–1L · 1L+ |
| Lease: home | lease amount | < ₹5L · 5–10L · 10–20L · 20L+ |
| Buy: home | total | < ₹30L · 30–60L · 60L–1Cr · 1–2Cr · 2–5Cr · 5Cr+ |
| Buy: plot | total | < ₹20L · 20–50L · 50L–1Cr · 1–3Cr · 3Cr+ |
| Commercial: rent / buy | per month / total | < ₹25k · 25–75k · 75k–2L · 2L+ / as Buy: home |
| PG | per bed per month | < ₹6k · 6–10k · 10–15k · 15k+ |
| Coworking / Storage | per seat / per month | < ₹5k · 5–10k · 10k+ |
| Furniture | total or per month | < ₹10k · 10–25k · 25–50k · 50k+ |
| Interiors | project | < ₹2L · 2–5L · 5–10L · 10L+ |

Bands are a starting guess for Tier-1/2 Indian cities and live in the shared config so they can be
tuned without touching either app. City-tier-aware bands are a later refinement, not v1.

### Step 4: areas

- The list is the city's `Area` rows, the same source as both apps' Areas filter. On web the
  searched areas are **pre-ticked**, including the multi-select `areaIds` that are currently dropped.
- **Nearby suggestions**: `Area` already has `lat`/`lng`, so once one area is picked, offer the 4–6
  nearest in the same city as one-tap additions ("Also consider Besant Nagar, Thiruvanmiyur?"). Areas
  without coordinates simply aren't suggested.
- **Cap at 5.** Beyond that it is "anywhere" again, and the owner-match fan-out stops being targeted.
- "Anywhere in {city}" stays possible, because some seekers genuinely don't care, but as a link under
  the list with a nudge ("Agents respond when you name areas"), not a peer of the area chips. A
  requirement with no areas is never sent to brokers (see below), so the nudge is true.

## When the capture is generic

Saving first means the row starts as whatever the page said. Take *"Rent 2 BHK Houses in
Bengaluru"*. The search already answered the transaction (rent), the property type (house), the size
(2 BHK) and the city, so `answeredSteps` skips steps 1–2. The wizard opens at the specifics, with
2 BHK already ticked and furnishing and who's moving in still to answer. Then come **Which areas of
Bengaluru?**, budget, must-haves and timeline. Answered,
the label becomes *"2 BHK semi-furnished house for rent in Whitefield or Marathahalli, Bengaluru ·
₹25k–35k/month · power backup, parking · within a month"*.

The hard case is the seeker who closes the wizard without answering. The rule that decides what
happens next is shared with [requirement-leads-for-brokers.md](requirement-leads-for-brokers.md):

**`isLeadReady`** (a *complete* requirement) means a city, 1 to 5 areas in `areaIds`, what they want
to do (`transactionType`) and the property type (`category`), and the row is open. Budget and size
are not required. It's computed, not stored, lives in `packages/types` (`missingForLead` lists the
gaps), and is exposed on `RequirementDto` / `AdminRequirementDto`. *Changed 2026-09-28 — see
"City first, and what makes a requirement complete" below.*

A requirement that is **not** complete (since requirements are created at the end, complete, only
rows saved before that change can be in this state):

- **Honest label.** `formatRequirementLabel` appends what's missing: *"2 BHK house for rent in
  Bengaluru — area not specified"*. Nobody reading it mistakes it for a precise need.
- **One reminder**, about 3 hours after capture, by push, WhatsApp or email (whichever the capture
  confirmation used), deep-linking to the first unanswered step. Sent at most once
  (`refineNudgedAt`), and only while the row can still be edited.
- **Admin queue:** a "needs details" badge, sorted to the top of the open list. At 1–3 captures a day,
  one call completes it.
- **Not sent to brokers or owners.** A city-wide lead reaches every agent in a 700 km² city: spam
  to them, a flood of calls for the seeker. `RequirementMatchJob` leaves the row unstamped, so it
  goes out on the next run after the seeker adds areas (within the existing 14-day cutoff).
- **The seeker's own alert still works.** Missing answers mean "any".

## Data model

Additive only. The existing single-value columns stay populated so nothing that reads them today
(admin queue, digest, `listMatchingOwnerInventory`, `notifyMatchingBuyers`) breaks before it's
upgraded.

```prisma
model Requirement {
  // ...existing columns unchanged...
  /** Multi-area want. `areaId` stays = areaIds[0] (or null) for legacy readers until they move over. */
  areaIds             String[]  @default([])
  /** BHK set, 5 = "5+" (same bucket convention as ListListingsDto.bedrooms). `bedrooms` stays = min. */
  bedroomOptions      Int[]     @default([])
  /** Plot / commercial / storage size, normalized to sqft. */
  minAreaSqft         Int?
  maxAreaSqft         Int?
  /** The unit the seeker picked, for display. Shipped as its own column rather than attributes.areaUnit. */
  areaUnit            String?
  /** Category-specific wants as Record<string, string[]> (every value is an "any of" list), keys from
   * REQUIREMENT_ATTRIBUTE_QUESTIONS: furnished, preferredTenantTypes, sharingType, gender, meals,
   * accessHours, seatType, condition, material, serviceType, facing, purpose, plus amenities.
   * Validated per category on write by sanitizeRequirementAttributes. */
  attributes          Json?
  /** The page label at capture, before refinement rewrote searchLabel. Kept for analytics:
   * "what did they search" vs "what did they actually want". */
  originalSearchLabel String?
  /** Set when the seeker reaches the review step. Null + some answers = partially refined. */
  refinedAt           DateTime?
  /** The one "finish your requirement" reminder, sent to rows still not lead-ready ~3h after capture. */
  refineNudgedAt      DateTime?
}
```

`String[]` over a join table for `areaIds`: volume is a few rows a day, Prisma supports `has` /
`hasSome`, areas are never deleted, and names are resolved on read the way `areaId` already is. If
area merges ever land, a join table becomes worth its weight. Not before.

`SavedSearch` gets the same `areaIds`, `bedroomOptions`, `minAreaSqft`/`maxAreaSqft` in Phase C, so
the alert tied to the requirement (`savedSearchId`) can honour the refinement. Amenities and other
`attributes` are **not** mirrored there (see *Matching*).

## API

- `POST /requirements`: the capture takes the page's criteria, and the web callers additionally pass
  `areaIds` and the full bedroom set instead of collapsing them. *Since 2026-09-28 it takes every
  wizard answer and refuses an incomplete requirement — see "Created at the end, complete".*
- **`PATCH /requirements/mine/:id/criteria`** (new) with `RefineRequirementDto`, all fields optional
  so each wizard step can save alone: `transactionType`, `category`, `areaIds`, `bedroomOptions`,
  `minPrice`, `maxPrice`, `minAreaSqft`, `maxAreaSqft`, `attributes`, `moveInBy`, `note`, and
  `complete: boolean` (sets `refinedAt`).
  - Validation lives in the shared config:
    - `transactionType` must be in `POSTABLE_TRANSACTION_TYPES[category]`.
    - Every `areaId` must belong to the requirement's city, with at most 5.
    - Min price must not exceed max (shipped instead of `PRICE_BOUNDS`).
    - `attributes` keys and values must be declared for that category. Anything else gets a 400,
      not silent drops. The capture endpoint, by contrast, drops them silently.
  - Side effects:
    - Regenerate `searchLabel` server-side (it has the area and city names). Copy the old one into
      `originalSearchLabel` on the first write.
    - Mirror the core criteria into the linked `SavedSearch`.
    - Keep `areaId`/`bedrooms` in sync with the first area and the minimum BHK.
    - **No second seeker message.** The capture confirmation already went out.
- **Edit window.** This relaxes Phase 1's "criteria are not editable" rule, whose reason was *"an
  admin may already have worked the queue against them"*. So the criteria stay editable only while
  that hasn't happened: `status = open`, `adminNote` null and `ownersNotifiedAt` null. After that
  the endpoint returns 409 with "close this and start a new one". In practice refinement happens
  in the minute after capture, well before the 09:00 digest and 10:00 match job.

`updateMine` (note / moveInBy) stays as-is for `/my-requirements`. Both paths write those two fields.

## Shared vocabulary (`packages/types`)

- **`requirementQuestions.ts`** (new):
  - The step list per tab and category, each step's kind (single / multi / range / budget /
    areas), and its options, derived from `CATEGORY_FIELD_CONFIG` and `HOME_TABS`' facets so
    nothing is typed twice.
  - The budget presets.
  - The skip logic, shared so both apps agree on what "already answered" means. It shipped as two
    functions: `applicableSteps(criteria)`, the steps that exist for this transaction and category,
    and `answeredSteps(criteria)`, the ones the search already answered. The wizard computes the
    answered set once, when it opens, so answering one question never makes another disappear.
- **`formatRequirementLabel(criteria, names)`** (new): the one label format, used by the BFF when
  rewriting `searchLabel` and by the review screen as a live preview. For example: *"2–3 BHK
  furnished apartment for rent in Adyar, Besant Nagar or Velachery, Chennai · ₹20k–35k/month ·
  lift, power backup · from November"*.
- `RefineRequirementInput`, plus the new fields on `RequirementDto` / `AdminRequirementDto` /
  `OwnerRequirementMatchDto`.

## UI

**Web.**
- `RequirementPrompt`'s success state opens `RequirementRefineWizard`, a client dialog, instead of
  today's "Add a budget or timeline" link. The same component also renders at
  `/my-requirements/[id]/refine` so the flow can be resumed.
- The grid and pages stay server components. Only the prompt leaf and the dialog are client code,
  per the parent plan's RSC constraint.
- `BrowseListingsView` and `ListingGrid` pass `areaIds` and the full bedroom set. The comments
  there explaining why they currently don't are updated in the same change.

**Mobile.**
- A pushed route, `app/requirement/[id]/refine.tsx`, rather than a bottom sheet. It's deep-linkable
  from the capture push/WhatsApp ("Add details so owners can find you"), survives backgrounding,
  and gets the keyboard handling for custom budget for free.
- `RequirementPrompt` navigates there after a successful create.
- `deriveHomeRequirementCriteria` stops dropping the multi-area set and the BHK set.

**Both.**
- `/my-requirements` shows a "Finish details" badge on any open row with `refinedAt` null that is
  still inside the edit window.
- The admin queue shows the refined fields, the original label and "refined / partly refined /
  not refined".

## Matching

Refinement is worth nothing if the matchers ignore it. But inventory is thin (320 listings, about
six repeat owners), so the rule is **hard on what defines the property, soft on preferences**:

| Criterion | Seeker alert (`notifyMatchingBuyers`) | Broker lead ([leads doc](requirement-leads-for-brokers.md)) |
|---|---|---|
| Complete (city, areas, buy/rent, property type) | not required | **required**: vague rows are never sent |
| City, category, transaction type | hard | hard |
| Areas | hard: listing's area ∈ `areaIds` (empty = anywhere) | listing holders or declared service areas in any of `areaIds` |
| BHK set (5 = gte 5) | hard | ranking: a listing that fits ranks first |
| Budget | hard, as today | ranking, as above |
| Plot/commercial size | hard when both sides have it | ranking |
| Amenities, furnishing, tenant type, PG/furniture/interiors attributes | **soft**: not filtered on; the alert says "has 3 of your 4 must-haves" | shown on the lead card |

Amenities stay soft because making them hard would mean a seeker who ticks "gym" never hears about
the otherwise-perfect flat without one. They can be promoted to hard later, once inventory makes
that a filter rather than a wall. Who sees the seeker's identity, and when, is decided in the leads
doc: only a capped, audited set of brokers, and only with the seeker's consent.

## Measurement

Analytics events are keyed by step: `requirement_refine_opened`, `_step_answered`, `_step_skipped`,
`_closed` (with the last step seen) and `_completed`. Watch:

- **Guardrail**: the "Yes" tap rate on the capture card. With save-first it shouldn't move. If it
  does, something in the card changed.
- Completion rate, and the drop-off by step. A step that loses more than about 30% is a candidate
  for removal or reordering.
- The share of requirements with at least one area, a budget, and a BHK/size: before vs after.
- The admin's own read: do they still need to call to learn the basics? The `adminNote` content
  will say.

## Phases

- **A — web + backend** (built 2026-09-28; see *What shipped in Phases A and B*):
  - The shared config and `formatRequirementLabel`.
  - The migration.
  - The `PATCH …/criteria` endpoint with the edit window.
  - Label regeneration and `SavedSearch` core mirroring (area/BHK columns deferred to C).
  - The web wizard and admin display.
  - Web callers pass `areaIds` and the bedroom set.
  - `isLeadReady`, the honest "not specified" label and the admin "needs details" badge.
- **B — mobile** (built 2026-09-28): the refine route, `RequirementPrompt` navigation, and
  `deriveHomeRequirementCriteria` carrying areas and the BHK set.
- **C — matching**: `SavedSearch.areaIds`/`bedroomOptions`/size columns, `notifyMatchingBuyers` and
  `listMatchingOwnerInventory` on the new fields, and the "n of your must-haves" line in alerts.
  `RequirementMatchJob` skips rows that aren't lead-ready. Broker leads build on this: see
  [requirement-leads-for-brokers.md](requirement-leads-for-brokers.md).
- **D — resume + reuse**:
  - The one reminder (`refineNudgedAt`; the column exists, nothing sends it yet). The capture
    confirmation's "Add areas, budget and more" link and the `/my-requirements` "Finish details"
    link already shipped in A.
  - The deferred standalone `/post-requirement` form becomes nearly free: it is this wizard
    starting at step 1 with a city picker. Still gated on the parent plan's condition (a reason to
    believe people will seek it out).

## What shipped in Phases A and B

Built 2026-09-28. Where this differs from the design above, this section is the current truth.

**Found while building: browse captures were losing category and transaction type.** Browse
pages passed only `query.category`/`query.transactionType` to the capture. Most browse URLs don't
set those; they use the tab vocabulary (`homeCategory` + `propertyType`). So *"Rent 1 BHK Apartments
in Chennai"* was being stored with no category and no transaction type at all. The fix is a shared
mapper, `requirementCriteriaFromBrowse` in `requirementQuestions.ts`:

- Rent & Lease maps to `rent` (the wizard's rent-or-lease question lets the seeker correct it).
- Buy maps to `sell`, PG to `rent`, and Interiors to `sell`.
- It carries the area set, the BHK set (homes only) and the furnished, sharing, condition, service
  type and amenities filters.
- More than `MAX_REQUIREMENT_AREAS` areas count as "anywhere" and are left for the areas question.

`BrowseListingsView` uses it for both the grid's empty-state card and the inline prompt.

**Capture (`POST /requirements`).**
- The label is the page's `filteredHeading ?? heading`, so a filtered page stores its filtered
  title.
- Invalid input is dropped silently, never rejected: areas outside the city, attributes the category
  doesn't declare, and duplicate BHK values. The capture must always succeed.
- `areaId`/`bedrooms` are kept equal to the first area and the smallest BHK.

**Refine (`PATCH /requirements/mine/:id/criteria`), plus `GET /requirements/mine/:id` for the page.**
- 404 if the row isn't the caller's. 409 outside the edit window (`canRefine` on the DTO: open, no
  `adminNote`, no `ownersNotifiedAt`, not expired).
- Nullable scalars clear with `null`; `areaIds`/`bedroomOptions` clear with `[]`.
- 400s:
  - A transaction the category can't have (`isValidRequirementTransaction`).
  - An area outside the city.
  - min > max for price or size.
  - An unknown attribute key or value. Only what this request sent can trigger this, so a category
    change never fails on answers stored earlier.
- A category change clears the size fields that category doesn't have. Attributes that no longer
  apply are dropped, and `attributes` is stored as SQL NULL when empty.
- The label is regenerated each time and `originalSearchLabel` is set on the first write.
  `refinedAt` is stamped only by `complete: true` (the review step's Done).
- **Alert mirroring:** `SavedSearch` still holds one area and one BHK. When the seeker picks several,
  the alert gets "any" for that field: broader, never narrower. Mirroring is best-effort; a failure
  there doesn't fail the refine. The list columns stay in Phase C.

**Web.**
- `RequirementRefineWizard` is shared by two hosts:
  - `RequirementRefineDialog`: a bottom sheet on phones, a centred card on desktop. It opens
    automatically after "Yes, find this for me". Escape or the backdrop close it.
  - `RequirementRefinePage` at `/my-requirements/[id]/refine`: noindex, login-gated, and a plain
    message when the row is past the edit window.
- After the dialog, the capture card shows the refined label, plus "Add areas, budget and more →"
  to reopen it until the review is done.
- The timeline chips are Immediately (7 days), Within a month, 1–3 months and Just exploring (no
  date).
- Area suggestions are the five nearest within 6 km of any picked area.
- `MyRequirementCard` summarises from `areaNames`/`bedroomOptions`/budget. It says what a vague row
  is missing ("Needs which areas and a budget or size…") and links to "Finish details →" / "Edit
  details →" while `canRefine`.

**Admin queue.**
- Shows all areas, the BHK set, size in the seeker's unit, attribute answers with their labels, the
  original search when it differs, and "refined / partly refined / not refined".
- Partly refined means `originalSearchLabel` is set but `refinedAt` is null.
- A "Needs details" badge appears on open rows that aren't lead-ready. It is a badge only: the
  queue isn't re-sorted by it yet.

**Mobile (Phase B).**
- `deriveHomeRequirementCriteria` now wraps `requirementCriteriaFromBrowse`, so the app stores
  captures the same way web does. It carries the area set, the BHK set, furnishing and the tab
  facet. PG maps to `rent` and Interiors to `sell`, as on web.
- `requirementCriteriaFromBrowse` keeps the BHK set while the category is still unknown ("2 BHK" on
  the Rent tab with no property type). This applies to web as well.
- A new route, `app/requirement/[id]/refine.tsx`, renders the React Native
  `RequirementRefineWizard`. It has the same steps and skip rules as web.
  - `RequirementPrompt` pushes it after a capture. When the home screen regains focus, the prompt
    refetches the row to show the refined label.
  - The requirement card links to it with "Finish details" / "Edit details". The my-requirements
    list keys each card by id, label and `refinedAt`, so a refined row replaces the card's own
    stale copy.
- Keyboard: the Back/Skip/Next footer rides on the keyboard via `KeyboardStickyView`, offset by the
  tab bar height, as the message composer does. `KeyboardAwareScrollView`'s `bottomOffset` is the
  footer's measured height plus a margin. Focusing the area search scrolls it to the top so its
  matches aren't under the keyboard.
- Tablets (700pt and up, the home grid's breakpoint) get wider side padding. Content always fills
  the full width.

**Phone browsers and tablets (web).**
- The refine page's card fills the content width.
- The dialog is a bottom sheet on phones and a centred card (640–720px) from `sm` up.
  - It pins to `window.visualViewport`, so on iOS Safari the sheet sits above the on-screen
    keyboard instead of behind it.
  - Focusing a field scrolls it into view once the keyboard has opened.
- Inputs are 16px below `sm`, per `lib/formStyles.ts`, so iOS doesn't zoom in on focus.
- Chips, link buttons and area rows get 44px tap targets on touch screens (`pointer-coarse:`),
  tablets included.
- The footer is sticky, with the safe-area inset, and Skip truncates on narrow phones.

**City first, and what makes a requirement complete (2026-09-28).** Replaces parts of the flow
table and step 4 above.
- A requirement is **complete** only with all four of: a city; 1–5 areas; what they want to do
  (buy / rent / lease, implied by PG, furniture and interiors); and the property type (house,
  apartment, plot…, again implied by PG, furniture and interiors). Anything less is vague. Budget
  and size are optional. `missingForLead` returns `city | area | transaction | propertyType`, and
  `REQUIREMENT_GAP_LABELS` / `describeRequirementGaps` give the shared wording for the label, the
  seeker's card and the admin badge.
- **No requirement without a city.** "All cities (India)" pages and the mobile home screen with no
  city show "Which city?" on the capture card (popular cities as chips, plus a search), and "Yes,
  find this for me" stays disabled until one is picked. The label is then rebuilt around the city
  with `formatRequirementLabel`, since the page heading says "India". `POST /requirements` refuses
  a missing or unknown `cityId` with 400 "Pick a city first" (older app builds without the picker
  get that message on India-wide captures).
- **Step order is now city → areas → what → property type → specifics → budget → must-haves →
  timeline.** Where comes first because nothing else is actionable without it. The city step only
  shows for rows saved before a city was required; `PATCH …/criteria` accepts `cityId` (set, never
  cleared), and a new city drops the old areas unless new ones come with it.
- **The four required steps have no Skip**, and Next stays disabled until each is answered.
  "Anywhere in {city}" is gone (open decision 3, resolved: not allowed). `stepsToAsk` also brings
  back a required step the search had answered if its answer has since gone (a new city empties
  the areas). Optional steps keep Skip.
- `PATCH …/criteria` with `complete: true` returns 400 ("Add at least one area and the property
  type first") while anything required is missing, so `refinedAt` means complete.
- Save-first was unchanged at this point; see the next section.

**Created at the end, complete (2026-09-28).** Replaces save-first. Creating a row after only the
city meant storing a requirement known to be vague, so the questions now come first and the row is
written once, at the review, with every answer.
- **Flow.** "Yes, find this for me" (with the contact-consent checkbox) now opens the questions
  instead of saving. Login is asked for *before* they open, because Google sign-in on web is a
  full-page redirect that would lose in-memory answers. The review's button reads "Find this for
  me" and does the create; closing early saves nothing.
- **Wizard modes.** `RequirementRefineWizard` (web and mobile) takes a `mode`: `create` (answers
  kept in memory, one `create(answers)` call at the review, label shown from the answers) or
  `refine` (the old per-step `PATCH`, used by `/my-requirements/[id]/refine` and the mobile refine
  route for rows saved before this change). Its input is a `RequirementWizardSubject`, the criteria
  subset of `RequirementDto`, so a not-yet-saved requirement can be passed in.
- **Hosts.** Web: `RequirementRefineDialog` is create-only; `RequirementPrompt` opens it and calls
  `createRequirementAction`. Mobile: `RequirementPrompt` stores a draft in
  `src/lib/requirementDraft.ts` (an in-memory hand-off, not route params) and pushes
  `app/requirement/new.tsx`; the created row comes back through `takeCreatedRequirement()` when the
  home screen regains focus.
- **`POST /requirements`** (`CreateRequirementDto`) also takes `minAreaSqft`, `maxAreaSqft` and
  `areaUnit`, and now validates like the refine endpoint instead of dropping silently: 400 for a
  missing city, a transaction the category can't have, min above max, or anything required missing
  ("Add at least one area and the property type first", from `describeRequirementGaps`). Areas
  outside the city are still filtered, then count as missing. BHK and size are kept only where the
  category asks for them, and attributes are sanitized. The stored label is regenerated server-side
  with `formatRequirementLabel`; the page's label goes to `originalSearchLabel`, and `refinedAt` is
  stamped at create, so every new row is complete.
- **Trade-offs.** A seeker who abandons the questions leaves no row and gets no reminder; the
  capture-rate guardrail under *Measurement* is the thing to watch. The incomplete-requirement
  reminder (`refineNudgedAt`) now only matters for legacy rows. **Old app builds** still create first
  and refine after, so their captures without an area or property type get the 400 until users
  update.

**Not done in A or B.** The analytics events under *Measurement* aren't emitted yet.
`RequirementMatchJob` does not yet skip rows that aren't lead-ready (Phase C), so vague rows still
reach owners as before.

## Open decisions

1. **Save first, then refine, or refine before saving?** Before-saving gives cleaner rows and no
   edit-window rule, but puts a form in front of the one capture path that works. *Resolved
   2026-09-28: refine before saving* — the requirement is created at the end, complete.
2. **One category or several?** "2 BHK house *or* apartment" is a common Indian ask. v1 stores one
   `category`. The cheapest extension is an "Any home (house / apartment / villa)" option that maps
   to the existing `propertyType` grouping. A `categories[]` column is the full version.
3. **Is "Anywhere in {city}" allowed at all?** *Resolved 2026-09-28: no.* At least one area is
   required for a requirement to be complete, so the areas step has no Skip.
4. **Area cap**: 5 is a guess. It now also bounds how widely a lead fans out to brokers.
5. **Amenities hard or soft in alerts**: soft for now (above).
6. **Budget bands**: accept the table above as v1, or derive them from actual listing prices per
   city (the p20/p40/p60/p80 of active listings) once there's enough inventory to make that
   meaningful.

## Critical files

- `packages/types/src/categoryFields.ts`, `postingRules.ts`, `priceBounds.ts`, `bedrooms.ts`: the
  vocabulary the questions are derived from. New: `requirementQuestions.ts`.
- `apps/bff/prisma/schema.prisma` (`Requirement`, `SavedSearch`).
- `apps/bff/src/requirements/`: `requirements.service.ts`, `requirements.controller.ts`, new
  `dto/refine-requirement.dto.ts`, `requirement-match.job.ts`, `requirement-digest.job.ts`.
- `apps/bff/src/saved-searches/saved-searches.service.ts` (`notifyMatchingBuyers`).
- Web: `components/home/RequirementPrompt.tsx`, `ListingGrid.tsx`, `BrowseListingsView.tsx`,
  `/my-requirements`, the admin Requirements queue.
- Mobile: `src/components/home/RequirementPrompt.tsx`, `src/lib/homeRequirementCriteria.ts`,
  `src/lib/bffClient.ts`, `app/my-requirements.tsx`, new `app/requirement/[id]/refine.tsx`.

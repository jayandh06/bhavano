# Post-ad funnel visibility: entry source + full step tracking

## Context

Lots of visitors reach `/post` and don't finish, but today there's no reliable way to see *where*
in the wizard they give up or *what on the site sent them there* — the two things you asked for.
Investigation found this is partly already solved and partly a real gap:

- **Web already fires a `post_step_view` GTM/GA4 event on every one of the wizard's 5 steps**
  (`category` → `transactionType` → `details` → `review` → `success`), from `StepTracker` in
  `PostAdWizard.tsx` — added in commit `0fd0f8a5` ("Measure the posting funnel before changing
  it"). But only `review` (`/post/preview`) and `success` are *also* written as a `PageView` row,
  so only those two steps are visible in the admin's own Page Visits screen — `category`,
  `transactionType` and `details` are GTM-only, invisible to anyone not digging through GA4.
- **Mobile has almost none of this** — only the final `post_ad_success` Firebase event and the
  `/post/preview` synthetic pageview. No step events, no login-wall event, no error event.
- **Entry-point attribution barely exists anywhere.** 11 web links and 4 mobile links open
  `/post` (header, footer, drawer, bottom tab, My Listings empty state, plans page, requirements
  feed, etc.) and none of them record *which* one was tapped — except `AdLandingCard`, the one
  paid-landing CTA, which already has its own click event. `Visit` (session-level attribution)
  only captures the *browser session's* first-touch source (UTM/referrer/gclid) once, at landing
  — it says nothing about an in-app click to `/post` later in the same session.

The fix reuses patterns **already established in this codebase** rather than inventing new
infrastructure: the "synthetic PageView path" trick (`/post/preview`, `/post/error?stage=...`,
`/post/boost-recovery?event=...`) is the house idiom for making an in-wizard client-state change
show up in the admin's Postgres-backed Page Visits trail, decoded by
`apps/admin/src/lib/pageTrail.ts`'s `trailEntry()`. This plan extends that idiom to cover every
step and to carry entry attribution, then adds one small aggregated admin view on top so the data
is actually readable as a funnel instead of session-by-session.

**Intended outcome:** open the admin's Page Visits (or a new funnel view) and see, for any date
range: how many sessions reached each step of `/post`, broken down by which link sent them there,
by platform, and by logged-in state — enough to point at the actual biggest drop-off with
confidence instead of a hunch.

## Scope

### A. Entry-point attribution (`?from=<slug>`)

Every internal link to `/post` gets a `from` query param naming the UI element, following the
exact pattern `RequirementsFeedPage.tsx` already uses for `?category=&transactionType=` on this
same route:

- Web (`apps/web/src/app/post/page.tsx` already reads `sp.category`/`sp.transactionType` off
  `searchParams` — add `sp.from` the same way) → `header_desktop`, `header_mobile`,
  `utility_bar`, `drawer`, `footer`, `my_listings_empty`, `plans_table`, `plans_page`,
  `requirements_feed`, `ad_landing_card` (folded into `AdLandingCard`'s existing href builder,
  `adLandingPostHref` in `apps/web/src/lib/adLandingCard.ts`), `post_another_ad`.
- Mobile: the same slugs where the same UI exists (`bottom_tab`, `utility_bar`, `drawer`,
  `requirements_feed`), read via `useLocalSearchParams()` the same way
  `app/listing/[id].tsx` already reads its own route param.
- No param present (typed URL, bookmark, back/forward) → `direct`.

`PostPageTracker` (web) and its missing mobile equivalent (new, see B) take `entry` as a prop
and include it in `post_page_view`. `PostAdWizard` takes it too and threads it into every
step's synthetic pageview (see B) as `?from=<slug>`, since `PageView.path` is free text and the
*real* `/post` document request strips query strings in `middleware.ts`
(`path: request.nextUrl.pathname`) — so entry attribution can only survive via the step-tracking
writes, not automatically.

### B. Full step-funnel visibility, both platforms

**Web** — `StepTracker` in `PostAdWizard.tsx` currently only POSTs a synthetic pageview for
`step === "review"`. Remove that gate; write one for every step, each a kebab-case path matching
the existing `/post/preview` naming convention (`/post/category`, `/post/transaction-type`,
`/post/details`), each carrying `?from=<entry>`. `success` keeps being written server-side (BFF,
on listing-live) as it already is — not touched. Also add the missing synthetic pageview at the
two existing `post_login_required` call sites (`:1534`, `:1612`) — `/post/login-required?step=...`
— mirroring `reportPostError`'s/`reportBoostRecoveryEvent`'s exact fetch-to-`/api/analytics/pageview`
shape, so the login wall shows up in the trail too, not just GTM.

**Mobile** — build the missing half from scratch, mirroring web's now-complete pattern exactly:
- A `PostPageTracker`-equivalent on mobile's `/post` screen firing a new Firebase event
  (`logPostPageView`, sibling to the existing `logPostAdSuccess` in `firebaseAnalytics.ts`) with
  `{ loggedIn, entry }`.
- A `StepTracker`-equivalent effect in mobile's `PostAdWizard.tsx` firing `logPostStepView({ step,
  entry })` (new Firebase event) **and** a `recordAppPageView` synthetic write for every step
  (today it's gated to `step === "review"` only, same as web was) — same path names as web, via
  the already-imported `recordAppPageView` (`analyticsSession.ts`).
- `post_login_required`/`post_error` parity at mobile's own two `requireLogin(...)` call sites
  (`:1405`, `:1435`) and its publish-failure `catch` (`:1548`) — same Firebase-event-plus-synthetic-
  pageview shape as web's `reportPostError`.

`trailEntry()` in `apps/admin/src/lib/pageTrail.ts` gets three more `if (path.startsWith(...))`
branches (category/transaction-type/details, login-required) alongside its existing ones, each
decoding the `?from=` query param into the readable label too (e.g. "Reached Category step — from
header (desktop)").

### C. Admin-visible aggregated funnel report

Page Visits today is a raw per-session trail — right for digging into one session, wrong for "what
% of arrivals reach step 3." Add one new small admin view (reusing `admin.service.ts`'s existing
query patterns over `PageView`+`Visit`, same join `page-visits/page.tsx` already does) showing, for
a date range: ordered step counts (`/post` arrival → category → transactionType → details →
preview → success) with %-of-previous-step, filterable by `from` (the new entry slug), by platform
(already distinguishable today via `Visit.fromApp`/device fields — the "show Android/iOS alongside
Device" work already landed), and by logged-in-at-arrival. This is the actual deliverable that
turns the new PageView rows into a funnel someone can read in one glance instead of grepping
sessions.

## Deliberately not in this iteration

- **`details` stays one step.** It bundles photos/price/location/category fields with no internal
  visibility. Once the funnel confirms whether this is the real cliff (likely, for most listing
  flows — photo upload is the usual killer), splitting it into sub-steps is the natural next
  iteration, not pre-built now on a guess.
- **`docs/plans/post-ad-via-whatsapp.md`** (proposed, not started) already targets the other
  known friction point — the login wall / unfamiliar-site OTP step — with a product fix, not a
  tracking fix. Not re-derived here; this plan's funnel data is what would validate it's worth
  building.
- **Field-level/scroll-depth tracking inside `details`** — more invasive, left for a later
  iteration once step-level data says it's needed.

## Files (representative — the entry-point wiring repeats the same one-line change across ~15 files)

- `apps/web/src/app/post/page.tsx`, `apps/web/src/components/home/PostPageTracker.tsx`,
  `apps/web/src/components/home/PostAdWizard.tsx` (`StepTracker`, `reportPostError`-style helpers)
- `apps/web/src/lib/adLandingCard.ts`
- `apps/web/src/components/home/Header.tsx`, `HeaderDrawer.tsx`, `Footer.tsx`,
  `apps/web/src/app/my-listings/page.tsx`, `PlanComparisonTable.tsx`, `PremiumPlansView.tsx`,
  `RequirementsFeedPage.tsx` (one `?from=` added to each existing `href="/post"`)
- `apps/mobile/src/lib/firebaseAnalytics.ts`, `apps/mobile/src/components/home/PostAdWizard.tsx`,
  mobile's `/post` screen
- `apps/mobile/src/components/home/BottomTabBar.tsx`, `HomeDrawer.tsx`, `UtilityBar.tsx`,
  `RequirementFeedCard.tsx`
- `apps/admin/src/lib/pageTrail.ts` (new decoder branches)
- New: a small admin funnel-report page + one `admin.service.ts` query, mirroring
  `apps/admin/src/app/page-visits/page.tsx`'s existing BFF query shape

## Verification

- Unit tests for the new `pageTrail.ts` decoder branches (mirrors its existing ones).
- Manually walk `/post` end to end from each entry point locally, confirm each step's synthetic
  `PageView` row (and `?from=`) lands correctly, then confirm the same walk on a dev build of the
  mobile app.
- Confirm the new admin funnel view's step counts against a manual count of raw `PageView` rows
  for a small local test session.

## Update (2026-10-10): `/post/success` was never recorded for any checkout-gated listing

A real user who added a Feature/Boost (or posted in a category with a nonzero platform fee) at
publish time showed every earlier step in their Page Visits trail, but no "Success" — not a
one-off, a structural gap affecting every listing that needed checkout before going live.

**Root cause:** a listing can reach `live` through two different code paths in
`ListingsService`, and `runPostLiveSideEffects`'s `/post/success` write (`listings.service.ts`
`:1489-1493`) only ever received a `sessionId` on one of them:
- **Direct publish** (`create()`, `!pendingCheckout`) — passes `input.sessionId` straight
  through. Correct.
- **Checkout-gated publish** — `create()` sets `publishState: 'pending_checkout'` and
  `input.sessionId` is simply discarded at that point, never persisted anywhere. Once Razorpay's
  webhook later calls `completePendingPublish(listingId, trackingAuthorized)` to flip the row to
  `live`, that method has no `sessionId` parameter at all to pass down — a payment webhook has no
  browser session of its own to supply one even if it tried. Same gap on the "no thanks, just
  post it" checkout-cancel path (`PaymentsService.cancelListingPublishCheckout`), which also
  routes through `completePendingPublish`.

**The fix:** persist the session at the one point it's genuinely available — `create()` time —
rather than threading it through a payment webhook that has no concept of one:
- New nullable `Listing.createSessionId` column, set unconditionally in `create()` (not gated on
  `pendingCheckout`) from `input.sessionId`.
- `completePendingPublish` reads it straight off the already-loaded `listing` row and passes it
  into `runPostLiveSideEffects` — no signature changes needed on the payments side at all, since
  neither payments call site ever needs to know a session id exists.

See `ListingsService.completePendingPublish`'s own test describe block for the regression
coverage (records the write when a session was captured at creation; skips it for an
admin/outreach-created listing with none).

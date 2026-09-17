# Property requirements: letting seekers post demand

**Status: plan, not yet implemented.** Written 2026-09-16.

## Context

Today a search that finds nothing is a dead end. `ListingGrid` renders one line — *"No listings
match your filters — try adjusting or clearing them"* — and the visitor leaves. That is the single
highest-intent moment on the site being thrown away: someone has just told us, in precise terms,
what they want and where, and we have nothing to sell them.

This feature turns that moment into a **Requirement**: a public, moderated post describing what
someone needs (category, transaction type, city, area, budget, bedrooms, timeline), visible to
owners, brokers and agents who can then reach out. Two entry points:

1. **Out of the box** — a first-class "Post a requirement" flow, reachable from the header/footer
   the way "Post a free ad" is, for someone who never searched at all.
2. **From the empty result** — when a search or an area page returns nothing, prompt to create a
   requirement **prefilled from the filters they just used**. That prefill is the whole trick: the
   URL already encodes city, area, category, transaction group and price bounds
   (`/{city}/{area}/{group}/{category}` plus `?minPrice=`/`?maxPrice=`/`?furnished=`), so the form
   opens already answered and the ask is one tap, not a form.

It also fixes a supply problem from the other side. The site has **135 cities but only 39 with a
single listing** (measured 2026-09-16), and 98 of those cities exist only because a user dropped a
map pin there. Requirements give those empty city and area pages something real to show, and give
us a reason to recruit owners into them: *"12 people are looking for a 2 BHK in Whitefield"* is a
far better pitch than a cold outreach email.

## Why this fits this codebase rather than being a new product

Almost every part already exists:

| need | what it reuses |
|---|---|
| criteria shape | `SavedSearch` already models category / transactionType / cityId / areaId / minPrice / maxPrice / bedrooms |
| matching engine | `SavedSearchesService.notifyMatchingBuyers` already matches a new *listing* against saved criteria — a requirement is the same match run in the other direction |
| contact gating | `ContactReveal` + `ContactRevealCreditBatch` already gate a seller's phone number behind credits, per-viewer, with an audit row |
| messaging | `Conversation`/`Message`, unread counts, and the mobile thread UI |
| notifications | `NotificationsService` (email + WhatsApp) and the `push` module |
| moderation | `moderationState` / `adminReviewed`, the admin queue, and the flag/approve actions |
| expiry | `Listing.expiresAt` + the renewal flow — a requirement should expire the same way |
| abuse limits | `RateLimitService` and `@Throttle`, already applied to posting |
| admin surface | the sortable/filterable table with a column selector built for listings |

The genuinely new parts are the `Requirement` model, one form, one feed, and the matching
*direction*.

## Data model

```prisma
model Requirement {
  id              String            @id @default(cuid())
  seekerId        String
  seeker          User              @relation(fields: [seekerId], references: [id])

  // Same vocabulary as SavedSearch and Listing, deliberately — so one matcher serves all three.
  category        ListingCategory?  // null = "any residential", say
  transactionType TransactionType?
  cityId          String
  city            City              @relation(fields: [cityId], references: [id])
  areaId          String?           // null = anywhere in the city
  area            Area?             @relation(fields: [areaId], references: [id])
  minPrice        Int?
  maxPrice        Int?
  bedrooms        Int?

  title           String            // generated, editable: "2 BHK apartment wanted in Koramangala"
  note            String?           // free text from the seeker, moderated
  moveInBy        DateTime?         // the demand-side signal a listing has no equivalent of

  status          RequirementStatus @default(active)   // active | fulfilled | withdrawn
  moderationState ModerationState   @default(approved)
  adminReviewed   Boolean           @default(false)
  expiresAt       DateTime
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([cityId, areaId, status])
  @@index([expiresAt])
  @@index([seekerId])
}
```

**A `Requirement` is not a `SavedSearch`, and shouldn't reuse it.** They differ on every axis that
matters: a saved search is private, permanent-until-deleted, and exists to notify *its owner*; a
requirement is public, moderated, expiring, and exists to be answered by *strangers*. Overloading
one model would put a `isPublic` flag on the critical path of the alerts matcher.

They should, however, be offered together: creating a requirement asks *"also alert me when
something matching turns up?"* and writes a `SavedSearch` too. The seeker then gets both the
inbound calls and the outbound alerts, and we get a Plus-subscription upsell in the same breath.

**Messaging.** `Conversation.listingId` is currently required, with `@@unique([listingId,
inquirerId, type])`. The cheapest correct change is to make `listingId` nullable, add a nullable
`requirementId`, and add a second unique `[requirementId, inquirerId, type]` — Postgres treats
NULLs as distinct, so the existing constraint keeps working for listing threads and does not
collapse requirement threads together. A database-level check that exactly one of the two is set
keeps the invariant honest. The alternative — a parallel thread model — would mean duplicating
unread counts, notification plumbing and the mobile thread UI, which is not worth it.

## Phase 1 — out of the box (build first)

1. **Model + migration**, plus `RequirementStatus` enum.
2. **`POST /requirements`** — login required (the OTP flow already proves a phone), rate-limited,
   `expiresAt` defaulted the way listings are.
3. **`/post-requirement` form** (web) — the same field vocabulary as the posting wizard so the
   category attributes stay consistent, but far shorter: what, where, budget, by when, a note.
4. **The empty-state prompt** — the one change with the highest leverage, at
   [ListingGrid.tsx:9](apps/web/src/components/home/ListingGrid.tsx#L9). Replace the bare line with
   a card: *"No 2 BHK apartments to rent in Koramangala right now. Tell owners what you're looking
   for — they'll come to you."* plus a button carrying the current filters into the form. Must stay
   a server-rendered leaf (no `"use client"` on the grid or page) so nothing moves out of the RSC
   output.
5. **Requirement feed for supply-side users** — `/requirements`, filterable by city/area/category,
   showing everything *except* the seeker's contact details.
6. **Admin moderation queue** — a tab reusing the listings-table machinery, since this is
   user-generated public text and will attract spam from day one.
7. **Notify matching owners** — see the anti-spam rules below.

Deliberately **not** in Phase 1: payment, SEO indexing, mobile posting, demand analytics.

## Matching and notification: the part that can go badly wrong

The naive version — email every owner in the city — is how this feature becomes a spam cannon and
burns the sender domain the notification stack depends on. Rules:

- **Match on inventory, not geography.** Notify a user only if they have (or had in the last N
  months) a listing in the same city **and** area **and** category. Someone who lists PGs in
  Bengaluru should not hear about a commercial plot in Agra.
- **Digest, not per-event.** One daily digest per owner/agent, capped, rather than a message per
  requirement. `notifySavedSearchMatch` already establishes the per-event pattern for the buyer
  side; the supply side has far more matches per recipient and needs batching.
- **Cap the fan-out per requirement** (say 20 owners, best-matched first) so one post cannot
  notify a thousand people.
- **Never include the seeker's phone or email** in the notification — or anywhere in the feed. The
  entire contact path goes through the messaging flow below; the number is never a field an API
  response carries until the seeker has replied.
- **Reuse `ListingNotificationLog`'s precedent** — record what was sent, to whom, on which channel,
  so "did this lead actually get delivered" is answerable, as it now is for listings.

## Monetization fit, and how the contact path actually works

This is the cleanest fit for **pay-per-lead**, which
[monetization-boosted-listings-premium-tiers.md](monetization-boosted-listings-premium-tiers.md)
names as pillar (3) and which the site does not yet monetize.

**Decision (2026-09-17): charge for the lead, not for the number. Pay to *message*; reveal the
phone only when the seeker replies.**

The obvious design is to gate the seeker's phone behind a contact-reveal credit, exactly as
listings do. `ContactRevealSetting` already carries the knobs (2 free reveals per user, packs of 5
for ₹125, 6-month expiry, all admin-tunable), `ContactReveal` is already unique per
(target, viewer) so a broker pays once per lead rather than per attempt, and every reveal already
writes an audit row. Renaming that constraint to `[requirementId, userId]` would be most of the
build.

That is the right *monetization* mechanism and it will be used — but on its own it is the wrong
answer to the safety problem, and the distinction is worth keeping straight: **a price makes
someone traceable and rate-limited by cost; it does not make them trustworthy.** Someone who
intends to harass one seeker pays ₹25 and is through. It is also irreversible — there is no
revoking a reveal — and the seeker has no say in *who* gets their number.

This is where requirements differ from listings. A seller who publishes an ad has opted into calls
from strangers; that is the deal. A seeker posting "I need a 2 BHK by December" has also invited
contact, but the post advertises *need and urgency*, which is a different thing to hand an unvetted
stranger, and that population skews toward people newer to the platform.

So the flow is:

1. A supply-side user spends a credit (or a free one) to **message** a requirement — not to unlock
   a phone.
2. The seeker sees it in the existing inbox, with who it is from and what listings they have, and
   replies or ignores it.
3. The number is exchanged only when the seeker **replies**, or explicitly taps "share my number".

Revenue and the audit trail are unchanged; the worst case for a seeker becomes "a message I
ignored" rather than "a stranger has my number permanently". It is also **cheaper to build** —
`Conversation`/`Message`, unread counts, push and the mobile thread UI all exist — so Phase 1 can
ship with no payment surface at all, measure whether supply-side users engage, and add the credit
gate once there is something worth charging for.

Paired controls, none of them expensive:

- **The seeker chooses their contact preference when posting**, defaulting to message-only. "Calls
  OK" becomes their explicit choice rather than the platform's default.
- **A daily cap per account even when paying** — otherwise a budget simply defeats the economic
  limit. Note the incentive here: per-reveal revenue aligns the platform with *maximising* reveals,
  so this cap needs to be a deliberate policy number, not whatever revenue drifts toward.
- Block and report on the thread; the 30-day expiry bounds the exposure window regardless.

Beyond that:
- **Agent Pro** (already planned) gets the requirement feed with filters, a daily digest, and a
  bundle of reveals — which finally gives that tier a concrete, defensible benefit instead of a
  badge.
- **Bhavano Plus** (buyer side) can get requirement *priority*: shown first in the feed, marked
  "verified seeker". A seeker paying to be contacted more is a strange ask, so I'd keep the paid
  seeker features to alerts and verification rather than placement — and treat "urgent" flags as a
  Phase 4 experiment, not a launch feature.

**iOS caveat, already established**: Apple Guideline 3.1.1 means any purchase on iOS must not go
through Razorpay in-app. The existing `Platform.OS` split (iOS opens the website, Android uses
native Razorpay) applies to requirement credits exactly as it does to boosts.

## SEO position — deliberately conservative

Requirements are user-generated, thin, near-duplicate and spam-prone: the textbook profile for a
manual action if you index them at scale. So:

- **Individual requirement pages: `noindex`.** They exist for logged-in supply-side users.
- **Aggregate pages: indexable, and genuinely useful** — one page per city (and per city+area once
  there's volume): *"Property requirements in Koramangala, Bengaluru — 14 people looking"*. Real
  content, updates on its own, and it targets a query listings can't ("tenants looking for flats in
  Koramangala").
- Those aggregates give the ~96 cities with **no listings** something legitimate to rank with,
  instead of being empty shells we link to from `/cities`.
- Needs a volume floor (don't publish a page showing 1 requirement), `sitemap.ts` entries only
  above that floor, and a canonical on any filtered variant — same rules the browse pages follow.

## Abuse and quality

- Login + verified phone to post; rate-limited per user and per IP.
- Expiry (30 days, renewable) so the feed reflects live demand — a stale requirement is worse than
  none, because a broker who wastes a call on one stops trusting the feed.
- Moderation queue, plus "mark fulfilled"/"withdraw" so seekers can close their own.
- Cap active requirements per user (one genuine need at a time; brokers posting fake demand to
  harvest owner contacts is the obvious attack).
- **Report** on both sides, and a block list. This is the feature's biggest safety surface — a
  channel from strangers toward someone who has advertised a need — which is why the contact path
  is messaging-first with the number released only on the seeker's reply (see the monetization
  section). Paying for access is a volume control, not a substitute for that.

## How it extends

1. **Demand insights for the supply side** — *"14 people want 2 BHKs in Whitefield this month; 3
   listings exist"*. Shown to owners as a reason to post, to agents as a reason to subscribe, and
   as a public "rental demand index" that is genuinely link-worthy PR.
2. **Targeted owner recruitment** — the `outreach` module already does Google-Places lead-gen. Feed
   it requirement density so it pitches *"we have 12 buyers waiting in your area"* instead of a
   cold email. This is the strongest compounding loop in the whole idea.
3. **Two-way auto-matching** — when a listing is posted, tell the owner which existing requirements
   it satisfies (and the seekers that a match arrived). One matcher, both directions.
4. **Broker pipeline** — claimed requirements with a status (contacted / shortlisted / closed), i.e.
   a thin CRM. Strong retention for Agent Pro, and it makes the reveal credit feel like a purchase
   rather than a toll.
5. **Verified seeker** — tie to the planned ID verification so brokers can filter to serious
   demand. Directly attacks the "leads are junk" objection that kills pay-per-lead products.
6. **WhatsApp-first posting** — most seekers would rather send a message than fill a form; the
   WhatsApp channel already exists for notifications.
7. **Requirement → listing nudge** — when a matching listing finally appears, notify the seeker,
   which is `notifySavedSearchMatch` again and free if the paired SavedSearch was created.
8. **Commercial/plot specialisation** — the categories where inventory is thinnest and demand
   posting is most valuable, since nobody browses a plot catalogue casually.

## Rejected alternatives

- **Making requirements public with contact details** — instant spam magnet for the seeker, and it
  gives away the only thing worth charging for.
- **Paid reveal of the seeker's number as the first contact** (i.e. listings' flow copied verbatim)
  — considered and narrowed, 2026-09-17. Right mechanism, wrong trigger: it charges for something
  irreversible that the seeker never got to consent to, and ₹25 deters bulk harvesting but not a
  single determined bad actor. Kept as the *pricing* model, moved behind a reply. See the
  monetization section.
- **Reusing `SavedSearch` as the public entity** — different lifecycle, visibility and moderation
  needs; would put a visibility flag in the alerts hot path.
- **A separate messaging stack** — duplicates unread counts, notifications and the mobile thread UI.
- **Indexing individual requirements** — thin duplicate UGC at scale; the aggregate pages get the
  same traffic with none of the risk.
- **Notifying all owners in a city** — the fastest way to destroy sender reputation.
- **Charging the seeker to post** — kills the supply of the thing that makes the feed valuable. The
  money is on the side receiving the lead.

## Open decisions (need a call before building)

1. **Who may see the feed at all** — any logged-in user, or only owners/agents (i.e. someone with a
   listing or a subscription)? Gating it tighter makes the leads more valuable and the spam lower,
   but slows adoption.
2. **Free messages to seed the market.** A pay-per-lead feed with no buyers is dead on arrival. I'd
   make messaging a requirement free at launch and price it once there's volume to price against —
   the existing `freeRevealsPerUser` knob is the precedent, and it's admin-tunable, so the free
   allowance can be dialled down without a deploy.
3. **Price per lead**, versus bundling into Agent Pro only.
4. **Phase 1 scope**: is the empty-state prompt plus the feed enough to validate demand before any
   payment work? I would ship exactly that and measure requirement-creation rate from empty
   searches first — it is a small build, and if seekers don't post, nothing downstream matters.
5. **Mobile**: read-only feed in Phase 1, or posting too? Posting needs the form; paid leads need
   the iOS payment split.
6. **Whether "calls OK" should be offerable at all**, or whether every requirement is
   messaging-only. Offering it is more useful to brokers and is the seeker's own choice; not
   offering it removes the irreversible-exposure case entirely. I lean toward offering it, default
   off, because a seeker who wants calls is expressing a real preference — but it is a judgement
   call about the platform's duty rather than a technical one.

## Critical files

- `apps/web/src/components/home/ListingGrid.tsx` — the empty state, the highest-leverage hook.
- `apps/web/src/app/[city]/[[...rest]]/page.tsx` — where filters are resolved, so where the prefill
  comes from.
- `apps/bff/src/saved-searches/saved-searches.service.ts` — `notifyMatchingBuyers` is the matcher to
  generalise.
- `apps/bff/src/contact-reveal/` — the gate to extend from listings to requirements.
- `apps/bff/prisma/schema.prisma` — `Requirement`, plus the `Conversation` nullable-FK change.
- `apps/admin/src/components/AdminListingsTable.tsx` — the table machinery the moderation queue
  should reuse rather than reinvent.

# Bhavano Referral Program: Technical Feasibility

Assessed against `docs/plans/bhavano-referral-program.md` (requirements, Oct 2, 2026). This is a
feasibility read, not an implementation plan — it answers "can we build this, on what, and where
does it actually get hard," grounded in what the codebase has today (file:line citations below),
not guesses.

## Verdict

**Feasible, and cheaper than it reads** — most of the reward/credit/admin/notification machinery
the doc asks for already exists in a different feature and is a close-to-direct clone, not new
infrastructure. The real cost is concentrated in four places: phone-based anti-abuse after account
deletion, device/payment-instrument fraud signals, deep-linking (the single biggest lift), and the
fact that "ad approved" is three separate code paths, not one. None of these are blockers; all four
are genuine scoped work, not research questions.

## Already answers one of the doc's own open questions

> "Is the user ID in the database sequential? If so, which public, non-sequential ID should serve
> as the code?"

**No** — `User.id` is `@default(cuid())` (`apps/bff/prisma/schema.prisma:281`), not sequential or
guessable. The doc's core mechanic ("the referral code is the user's ID") is sound exactly as
written. No new public-facing slug/handle field is needed.

## Already in place — close-to-direct reuse

| Requirement | What exists | Where |
|---|---|---|
| Grant a boost without payment | A skip-payment branch already exists for Agent Pro's monthly free boost: creates a `Payment` row at `amount: 0, status: 'paid'` with no Razorpay order, then calls the same `activateListingBoost` every paid boost uses | `apps/bff/src/payments/payments.service.ts:367-402` (`createBoostOrder`) |
| A redeemable, expiring credit balance | The exact shape — a credit *ledger* (not a cached counter), drawing from the batch nearest expiry first, derived by querying the log rather than trusting a running total | `ContactRevealCreditBatch`/`ContactReveal`, schema `:1271-1308`, service `apps/bff/src/contact-reveal/contact-reveal.service.ts:140-152` |
| Admin-editable settings, no release needed | Singleton-row Prisma model + NestJS DTO + Next.js admin page is an established convention, used 5 times already | `LoginNudgeSetting` (schema `:1735-1747`, admin page `apps/admin/src/app/settings/login-nudge/page.tsx`) is the template; `BoostPriceSetting`/`ContactRevealSetting` are the same shape |
| "Ad is live" message with a link, via WhatsApp | Already shipping today, sent on every successful post | `notifyListingPosted`, `apps/bff/src/notifications/notifications.service.ts:687-780`, MSG91 WhatsApp template |
| One-tap native share | Mobile already calls `Share.share` on a listing; web already has `navigator.share` + a purpose-built "share on WhatsApp" component with UTM-tagged links | Mobile: `apps/mobile/src/components/home/ListingCard.tsx:37-42`. Web: `apps/web/src/components/home/OwnerWhatsAppShare.tsx`, `apps/web/src/lib/shareLinks.ts` |
| Admin list + freeze/reverse action screen | Structurally identical to the existing moderation queue (NestJS admin controller + Next.js list/detail page) | `apps/admin/src/app/page.tsx`, `apps/bff/src/admin/admin.controller.ts:159-170` |
| New notification types (signup alert, reward alert, expiry reminder) | `NotificationsService` already has ~6 `notifyX` methods on one template (email/WhatsApp/push dispatch, logged to `ListingNotificationLog`) — adding 3 more is the same pattern, not new plumbing | `apps/bff/src/notifications/notifications.service.ts` (e.g. `notifyListingApproved:51`) |

Net effect: the reward/credit engine, the admin-settings story, the "ad is live" touchpoint, the
share UI, and the admin review screen are each a close variation of something already running in
production — this is the bulk of the doc's "Functional requirements" and "Other requirements"
sections.

## Does not fit — checked and ruled out

The doc doesn't ask for this, but it's worth stating why the *existing* promo/coupon system
(`DiscountCode`/`DiscountCodeRedemption`, schema `:1324-1351`) isn't the right base for referral
credits: it only discounts an amount already being charged (`amount * (100-pct)/100`,
`payments.service.ts:361-364`) — it has no path to a genuine ₹0 grant with no Razorpay order at
all, and a redemption isn't scoped to "who referred whom." The `ProBoostCredit` skip-payment branch
above is the correct template instead; this was checked so it isn't rediscovered mid-build.

## Real gaps — new work, not just wiring

### 1. BR-2 ("phone referred once, ever, even if the account is deleted and recreated") — not achievable as-is

Account deletion is a soft delete (`User.deletedAt`) but **phone is explicitly nulled out** on
deletion (`apps/bff/src/users/account-deletion.service.ts:45`), by design — the code's own comment
says this is deliberate, to honor the erasure request (contrast with the account-merge path, which
*does* preserve a released phone in `mergedPhone` specifically because it needs to). Once deleted,
the phone becomes reusable by a new signup with no trace.

**What this needs**: a separate, append-only table (e.g. a phone hash → "has received a referral
reward" ledger) that outlives the `User` row entirely, written at reward time, checked at
attribution time. This is a small, well-defined addition — but note the product tension it creates:
keeping a permanent record specifically to block re-referral sits in some conflict with the
erasure intent the deletion flow was built for. Worth a product/privacy call on retaining a hash
(not the raw phone) indefinitely for this one purpose, not just an engineering decision.

### 2. BR-3 (self-referral via "same phone, device ID or payment instrument") — partial signal only

Phone matching is trivial (already unique). Device ID is weaker than the doc implies: a per-install
anonymous UUID exists on both platforms (`apps/mobile/src/lib/viewerKey.ts:6-16`, and the
equivalent on web), but it's reset by a reinstall or clearing storage, isn't tied to identity or
payment, and was built for anonymous-view attribution, not fraud detection — using it for BR-3 is
better than nothing but not the "device ID" a fraud rule usually means. Payment-instrument matching
doesn't exist at all — Razorpay's payment metadata (UPI VPA / card fingerprint) isn't captured or
compared anywhere today. **New work**: decide how much of BR-3 ships in v1 (phone-only is cheap and
already works; device/payment-instrument matching is a second, separable piece of work with real
false-positive risk — e.g. two family members on one UPI ID).

### 3. Deep linking — the single biggest technical lift in the project

Checked directly: there is **no incoming deep-link handling at all** on mobile today (no
`associatedDomains`/iOS universal links, no Android `intentFilters`, no `apple-app-site-association`
or `assetlinks.json`; grepping for `expo-linking`/`Linking.parse` in `apps/mobile` returns nothing —
only outbound link-building helpers exist). Web's middleware has solid first-touch UTM attribution
(`apps/web/src/middleware.ts:37-69`) but no `?ref=` capture yet. A referral link shared on WhatsApp
needs to correctly route to the already-installed app *or* a mobile browser *or* desktop — that's
universal-link/App-Link setup on both platforms, end-to-end testing across iOS/Android/web, plus the
new `?ref=` capture on web (which can reuse the existing acquisition-cookie pattern,
`middleware.ts:130-136`, as a precedent). This is real, non-trivial infrastructure work, independent
of everything else in the program, and should be sized and possibly started first since it gates
US-1/US-2/US-5 entirely.

### 4. "First ad approved" is not one event — it's at least three

No "is this the user's first ad" concept exists anywhere (`ListingsService.create` has no such
check). More importantly, a listing becomes publicly live/approved through **three separate code
paths**: synchronous approval inside `create()`, deferred approval after checkout in
`completePendingPublish()` (`listings.service.ts:1320-1331`), and admin un-flagging via `approve()`
(`listings.service.ts:1121-1138`) — "live" itself is a repeated three-field AND
(`status`/`publishState`/`moderationState`), not a single boolean. The reward hook has to be added
to all three, and the 14-day takedown-revocation rule has to watch all three of the corresponding
takedown paths (`flag()`, `setStatusAsAdmin()`, `deleteCompletely()`). This is the kind of place a
first pass is likely to miss one path — worth explicit test coverage per path, not just a happy-path
test.

### 5. No durable server-side funnel table

Client-side step events exist (`post_step_view` via GA4) but aren't server-durable. Server-side
analytics exist per-purpose (`AnalyticsService.recordVisit`/`recordPageView`,
`apps/bff/src/analytics/analytics.service.ts`) with no generic funnel table to extend. The
dashboard's "clicks → signups → ads posted → boosts earned" needs its own new schema/counters,
following the existing raw-insert-with-dedupe convention — new work, not a reuse, but a small and
well-understood shape given the precedent.

### 6. Notification completeness

The "ad is live" WhatsApp touchpoint already exists; the *new* templates this program needs
("you earned a free boost," "a friend joined through your link," expiry reminders) require new
WhatsApp/SMS template approval (Meta/DLT), which has external lead time independent of engineering.
Also worth noting: SMS free-text fallback was deliberately removed from this codebase already
(`notifications.service.ts:644-647`, pending DLT template work) — if WhatsApp delivery fails for a
user with no email, today there's a real delivery gap for "reward confirmed by WhatsApp or SMS."

## Suggested sequencing, if this moves forward

1. **Deep linking first** (gap #3) — gates every other piece of the sharing loop and has the
   longest, least-code-dependent lead time (store/App-Link config, platform review quirks).
2. **Reward engine** (boost-credit ledger cloned from `ContactRevealCreditBatch`, skip-payment
   branch cloned from `ProBoostCredit`) — low risk, strong precedent, can be built and tested against
   fake referrals before deep linking is ready.
3. **Approval/takedown hooks** (gap #4) — needs care across all three live-transition paths; write
   it as one shared internal method the three call sites invoke, rather than three separate
   near-duplicate hook insertions, to avoid the "missed one path" risk called out above.
4. **Anti-abuse** (gaps #1, #2) — ship phone-based blocking (cheap, already unique) at launch;
   treat device/payment-instrument matching as a fast-follow once real abuse patterns are visible,
   rather than trying to fully solve BR-3 before any real traffic exists.
5. **Admin dashboard + funnel tracking** (gap #5) — can trail the above; nothing else depends on it.

## Not assessed here

Pricing/cost of a boost to Bhavano (the doc's own open question, needs a business answer, not a
technical one), the welcome-reward decision for referred users, and whether most posters are on web
or mobile (also open questions in the source doc) — these are product decisions this feasibility
pass doesn't resolve, flagged in the source doc already.

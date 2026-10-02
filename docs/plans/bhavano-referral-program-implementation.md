# Bhavano Referral Program: Implementation Plan

**Status (2026-10-02): Phases 1-6 built and verified** (deep linking + attribution capture, reward
engine, approval/takedown hooks, anti-abuse, admin dashboard + funnel, notifications + user-facing
Referrals page and free-boost redemption). Not yet deployed — holding per explicit instruction to bundle the whole feature into
one deploy rather than shipping phase by phase. See each phase's section below for what actually
landed vs. what changed from the original plan during implementation.

## Context

`docs/plans/bhavano-referral-program.md` is the approved requirements doc (share a live ad →
referred signup posts their first ad → referrer earns a free boost credit). A follow-up feasibility
pass (`docs/plans/bhavano-referral-program-feasibility.md`) found the reward/credit/admin/
notification machinery already exists in close-to-identical shape elsewhere in the codebase (clone,
don't reinvent), and narrowed the real new work to four things: deep linking (biggest lift), phone
anti-abuse surviving account deletion, centralizing the "ad approved" event, and a funnel table for
the admin dashboard. This plan sequences the build around those findings — read the feasibility doc
first if the "why" behind any phase below isn't obvious, it has the file:line evidence.

One correction verified directly against the code since that doc was written: "ad approved" is
**not** three fully separate paths. `runPostLiveSideEffects` (`listings.service.ts:1253-1317`) is
already a single shared hook called from `create()` (`:1586`), `completePendingPublish()`
(`:1347`), and the claim-and-publish path (`:2466`) — verified via `grep -n
runPostLiveSideEffects`. The one genuine outlier is admin `approve()` (`:1121-1138`), confirmed by
direct read to call no notification/hook at all. So the referral hook needs **two** call sites, not
three.

## Sequencing

Deep linking first (gates every other user-facing piece and has the longest external lead time),
then the reward engine (low-risk, strong precedent, buildable/testable before deep linking ships),
then the approval/takedown hook, then anti-abuse, then admin + funnel, then notifications/remaining
UI. This matches the feasibility doc's own recommendation.

## Phase 1 — Deep linking & attribution capture — **BUILT**

Landed close to plan, with two additions found useful during implementation (not in the original
plan text): `attributeSignupIfReferred` enforces `attributionWindowDays` server-side (defense in
depth — both web's cookie TTL and mobile's `getReferralCodeIfFresh` already refuse to send a stale
code, so this only matters against a client that doesn't), and mobile's `ReferralLinkBridge` calls
the same `/referrals/click` endpoint web's middleware does (the original plan only specified web
doing this — mobile not logging clicks at all was a real gap, fixed in the same pass once noticed).
Storage ended up as `AsyncStorage` (matching the existing `viewerKey.ts` convention for this exact
kind of per-install value), not `SecureStore` as this section originally said.

**New Prisma models** (`apps/bff/prisma/schema.prisma`)
- `Referral`: `id`, `referrerId -> User`, `referredUserId String? @unique -> User`, `status String`
  (`"clicked"|"signed_up"|"ad_posted"|"ad_approved"|"rewarded"|"blocked"|"reversed"` — plain string,
  matching this schema's existing `kind`/`source` convention, not a Prisma enum), `clickedAt`,
  `signedUpAt`, `firstAdPostedAt`, `firstAdApprovedAt`, `rewardedAt`, `createdAt`.
  `@@index([referrerId, status])`.
- `ReferralClick`: anonymous pre-signup log feeding the funnel's "clicks" count — `id`,
  `referrerId -> User`, `sessionId String`, `landingListingId String?`, `createdAt`.

**BFF**
- New `ReferralsController` + `ReferralsService`. `POST referrals/click` (public) →
  `recordClick(refCode, sessionId)`.
- `attributeSignupIfReferred(newUserId, refCode, visit)` — call it from `AuthService` right next to
  the existing `linkVisitToUser`/`linkListingViewsToUser` calls at all three signup sites:
  `apps/bff/src/auth/auth.service.ts:168` (OTP), `:275` (Google), `:344` (Apple) — all three already
  gate on `isNewUser`, fire-and-forget like their siblings (`.catch(() => undefined)`). Reject
  self-referral and anything past `ReferralSetting.attributionWindowDays` (default 30, matching
  `ACQUISITION_COOKIE_MAX_AGE_SECONDS` in `apps/web/src/middleware.ts:11`).

**Web**
- `apps/web/src/middleware.ts`: new `bhavano_ref` cookie from `?ref=<userId>`, 30-day TTL,
  **latest-wins** (overwritten on every visit carrying a `ref` param — unlike the first-touch
  `bhavano_acq` cookie at `:130-136`, per the doc's "latest link wins" rule), plus a fire-and-forget
  `POST /api/referrals/click` mirroring the existing non-blocking Visit-log pattern at `:132-136`.

**Mobile** — zero existing deep-link handling today (confirmed: no `expo-linking`/`Linking.parse`
usage anywhere in `apps/mobile`). Add: `app.json` `ios.associatedDomains` + `android.intentFilters`,
an `apple-app-site-association` + `assetlinks.json` served from the web app's domain, and a root
`Linking.useURL` listener that extracts `ref`, persists it (SecureStore) with a timestamp, and
routes to the shared listing. Send the stored ref alongside the signup call once OTP/Google/Apple
login completes.

**Confirm before building**: the cookie/header/field carrying `ref` from mobile's stored deep-link
value through to the signup API call; who owns hosting `assetlinks.json`/AASA in the prod Caddy
config; fallback UX when the app isn't installed (store redirect/smart banner — not in the source
doc).

## Phase 2 — Reward engine (credit ledger + redemption) — **BUILT**

Landed as planned. `ReferralSettingsDto`/`DEFAULT_REFERRAL_SETTINGS` added to `packages/types`
alongside the Prisma model, matching `ContactRevealSettingsDto`'s own split between the shared type
and the BFF-local default-values constant — not called out explicitly in the original plan text but
a direct consequence of following the cited convention. `useReferralCredit` on `createBoostOrder`
ignores the `boostDays` the client sent, exactly as planned — the redeemed batch's own
`daysGranted` wins.



**New Prisma models**
- `ReferralCreditBatch` (clone of `ContactRevealCreditBatch`, schema `:1271-1308`): `id`,
  `userId -> User`, `referralId String @unique -> Referral`, `daysGranted Int` (snapshot of the
  setting at grant time, so a later admin change doesn't retroactively alter an already-granted
  credit), `grantedAt @default(now())`, `expiresAt`, `redeemedAt DateTime?`,
  `redeemedListingId String?`, `redeemedPaymentId String? -> Payment`, `revokedAt DateTime?`,
  `revokedReason String?`, `bonusTier String?` (nullable — for the 3rd/5th-referral bonus, not tied
  1:1 to a single `Referral`). `@@index([userId, expiresAt])`. One batch = one credit (simpler than
  `ContactRevealCreditBatch`'s stacked-count shape, since this program grants exactly 1 per
  referral) — balance is always derived by querying this table, never a cached counter, same
  discipline as `getBalanceForUser` (`contact-reveal.service.ts:140-152`).
- `ReferralSetting` (singleton, clone of `LoginNudgeSetting`, schema `:1735-1747`): `id String @id`,
  `boostDays Int @default(3)`, `creditExpiryDays Int @default(60)`,
  `monthlyCapPerReferrer Int @default(5)`, `bonusExtraBoostAtReferrals Int @default(3)`,
  `topAgentBadgeAtReferrals Int @default(5)`, `welcomeRewardEnabled Boolean @default(false)`,
  `welcomeRewardFeaturedDays Int @default(1)`, `attributionWindowDays Int @default(30)`,
  `takedownRevocationWindowDays Int @default(14)`, `updatedAt @updatedAt`.

**BFF**
- `ReferralsService.grantReward(referral)` — creates the `ReferralCreditBatch`; BR-6/7/8 enforcement
  lands in Phase 4, but this method can be built/unit-tested now against directly-constructed
  `Referral` rows, ahead of Phase 3's real hook.
- `ReferralsService.getBalanceForUser(userId)` — mirrors `contact-reveal.service.ts:140-156`.
- `ReferralsService.redeemCreditForBoost(userId, listingId)` — picks the batch with the earliest
  `expiresAt` among `{redeemedAt: null, revokedAt: null, expiresAt: {gt: now}}`.
- `PaymentsService.createBoostOrder` (`apps/bff/src/payments/payments.service.ts:369-409`): a new
  skip-payment branch alongside the existing `ProBoostCredit` branch (`:382-409`) — identical shape
  (`Payment` row at `amount:0, status:'paid'`, no Razorpay order, then `activateListingBoost`),
  gated on a `useReferralCredit` flag from the client plus `redeemCreditForBoost` succeeding.

**Admin** — `apps/admin/src/app/settings/referrals/page.tsx` (clone of
`settings/login-nudge/page.tsx`); `admin.controller.ts`: `GET`/`PATCH admin/referral-settings`
(same pair convention as the existing settings endpoints around `:400-405`).

## Phase 3 — Centralize the "ad approved" hook — **BUILT**

Landed as planned, with the 2-not-3-call-sites correction from the Context section above
confirmed in the actual code. `recordFirstApprovedAdIfReferred` ended up taking only `ownerId` (no
`listingId`) — the check is "does this owner now have exactly one genuinely live/approved listing,"
which only needs the owner, not which specific listing triggered it. Test mocks for
`ListingsService` across both `listings.service.spec.ts` and `assisted-listing.spec.ts` needed a
real `ReferralsService` stub (not a bare `{}`) — an empty-object mock made the new fire-and-forget
call throw synchronously, which the tests' own outer `.catch(() => undefined)` silently masked
rather than catching cleanly; worth remembering for Phase 4's own tests.

- Add `ReferralsService.recordFirstApprovedAdIfReferred(ownerId, listingId)`: checks whether this is
  the owner's first-ever listing matching `publishState:'live' && moderationState:'approved' &&
  status:'active'`, and if so and a `Referral` row exists for this owner in `signed_up`/`ad_posted`
  with no `rewardedAt`, calls `grantReward`.
- Call it, fire-and-forget (matching the `.catch(() => undefined)` style already inside
  `runPostLiveSideEffects:1274`), from **two** places: the end of `runPostLiveSideEffects`, and the
  end of `approve()` (`:1121-1138`) — covers all paths a listing can first become publicly live,
  per the verified call-site count above.
- Add `ReferralsService.revokeIfTakenDown(listingId)` (BR-5), called from `flag()` (`:1100-1118`)
  and `deleteCompletely()` (`:1943`).

**Confirm before building**: does BR-5's 14-day revocation window also watch `setStatusAsAdmin()`'s
`deactivated` transition (`:1147-1163`, used for owner-support actions), or only true moderation
actions (`flag()`/`deleteCompletely()`)? Recommend scoping to the latter — `deactivated` isn't a
policy-violation takedown — and confirming with product before building the broader version.

## Phase 4 — Anti-abuse (phone-only enforcement at launch; device signal as a soft flag) — **BUILT**

**As built (2026-10-02)** — migration `20261002090000_referral_program_phase4`:
- **Where the rules run.** All reward eligibility is decided once, in
  `recordFirstApprovedAdIfReferred` → `rewardSkipReason`, when the referred user's first ad is
  approved. `firstAdApprovedAt` marks the referral as decided, so deleting the first ad and posting
  another can't re-roll a skipped reward. A skipped referral keeps its progress (`ad_approved`, or
  `blocked` for the device flag) and records why on the new `Referral.rewardSkippedReason`
  (`same_device`, `phone_already_rewarded`, `phone_missing`, `referrer_deleted`,
  `referrer_frozen`, `referrer_no_approved_ad`, `monthly_cap`; type `ReferralRewardSkipReason`),
  for the Phase 5 admin view. It still counts on the dashboard (BR-6).
- **BR-2 phone ledger.** `ReferralPhoneLedger.phoneHash` is HMAC-SHA256 of the stored phone, keyed
  with `AUTH_JWT_SECRET` (no new deploy config). Rotating that secret orphans existing rows, so
  rotate it together with a rehash. The row is written in the same transaction as the credit, so a
  concurrent second reward for one phone fails on the unique key. Checked at attribution for
  phone-OTP signups (refuse attribution) and again at reward time. Google/Apple signups have no
  phone at signup; publishing requires a verified phone, so the reward-time check always has one.
- **BR-3 device.** Not `ListingView`, as first proposed: `linkListingViewsToUser` rewrites
  `anon:<key>` to `user:<id>` on login, so it can't answer "which account first signed up on this
  device". Instead `User.firstSeenViewerKey` is set once at account creation (all three signup
  paths) and compared with the referrer's. A match creates the referral as `blocked`
  (`same_device`): flagged, never rewarded automatically. Referrers created before this column
  have no key and are never matched.
- **BR-6 cap.** Counts the referrer's base credits (`bonusTier: null`) granted since the start of
  the current calendar month **in India time** (`istMonthStart`). Bonus-tier credits are extra and
  don't use up the allowance.
- **BR-7.** Checked at reward time, not at attribution: the referrer needs at least one ad that was
  ever approved and published (`moderationState: approved`, `publishState: live`), even if since
  sold or deactivated.
- **BR-9.** `User.referralFrozenAt` / `referralFrozenReason` stop *new* grants only. Credits
  already granted stay spendable (freezing stops further abuse; it isn't a clawback). The
  freeze/unfreeze actions that set it are in Phase 5.
- **Not built:** the 3/5-referrals-a-month bonus tiers and the Top Agent badge (the schema already
  has `bonusTier`), the welcome reward, and payment-instrument matching (out of scope for v1).
- **Still needs sign-off:** keeping the phone hash after account deletion (the privacy tension
  below). The hash isn't reversible to the number, but it is retained deliberately.

Original plan:

**New Prisma model**
- `ReferralPhoneLedger` — append-only, deliberately outlives the `User` row (this is what makes
  BR-2 possible despite `account-deletion.service.ts:45` nulling `phone` on deletion): `id`,
  `phoneHash String @unique` (salted hash, never raw phone — addresses the privacy tension the
  feasibility doc raised against the deletion flow's erasure intent), `referralId String? ->
  Referral`, `rewardedAt @default(now())`. Written once, at `grantReward` time, off the referred
  user's phone; checked at both `attributeSignupIfReferred` (refuse attribution outright) and
  `grantReward` (belt-and-suspenders).

**BR enforcement**
- BR-1: already implied by `verifyOtp`'s phone-upsert uniqueness (`auth.service.ts:~152-160`) — no
  new work.
- BR-2: `ReferralPhoneLedger`, above.
- BR-3 self-referral: phone can't collide (unique). For the device signal, reuse what's already
  wired rather than build new fingerprinting: `viewerKey` is already linked to `userId` at signup
  via `linkListingViewsToUser` (verified: `auth.service.ts:168,275,344` call it;
  `apps/mobile/src/lib/viewerKey.ts:6-16` is the mobile-side persisted id). At signup, check whether
  the new user's `viewerKey` is already linked to the *referrer's* `userId` in `ListingView` — if
  so, **flag `Referral.status` for admin review, never auto-block** (matches BR-3's explicit
  "IP match flags, doesn't block" rule, and respects that `viewerKey` is resettable, not real device
  fingerprinting). Payment-instrument matching is explicitly out of scope for v1 — fast-follow once
  real abuse patterns are visible, per the feasibility doc's recommendation.
- BR-6 (5/month cap): enforced inside `grantReward` — count `ReferralCreditBatch` rows for `userId`
  with `grantedAt` in the current calendar month (default: excluding `bonusTier` rows — see open
  question below).
- BR-7 (referrer needs ≥1 approved ad): checked at `grantReward` time, not at signup/attribution —
  a signup/click is still recorded even if the referrer's own first ad isn't approved yet.
- BR-9 (freeze/reverse): add `User.referralFrozenAt DateTime?` / `referralFrozenReason String?`;
  `grantReward` records referral progress but grants no credit while frozen. New
  `ReferralAdminAction` audit log (`id`, `adminId`, `targetUserId String?`, `referralId String?`,
  `action String`, `note String?`, `createdAt`), matching the `logEdit` convention already used
  throughout `listings.service.ts` ("never silent").

**Confirm before building**: do bonus-tier credits count toward the monthly cap, or are they
additional on top of it? Does admin "freeze" also suspend spending of *already-granted* unused
credits, or only block new grants? BR-7 timing (gate at grant, as proposed, vs. at attribution)?
BR-2's phone-hash retention needs explicit privacy/product sign-off given the tension with the
account-deletion erasure flow, plus a concrete salt/hash strategy.

## Phase 5 — Admin dashboard + funnel tracking — **BUILT**

**As built (2026-10-02)** — no migration (all tables came from Phases 1-4):
- **BFF.** `ReferralsAdminService` (`apps/bff/src/referrals/referrals-admin.service.ts`), exported
  from `ReferralsModule`, which `AdminModule` now imports. Routes on `AdminController`:
  - `GET admin/referrals`: filters `status`, `frozen` (referrer frozen), `referrerId`; paginated,
    newest signup first. Also returns `flaggedTotal` (status `blocked`).
  - `GET admin/referrals/funnel?sinceDays=7|30|90` (omit for all time): link clicks, signups,
    first ad approved, credits granted, used, revoked, and expired unused, plus flagged, reversed,
    and the count of skipped rewards per `rewardSkippedReason`. Each step counts events whose own
    timestamp falls in the window, so it is an activity view, not a cohort.
  - `GET admin/referrals/:id`: the referral, referrer stats (referrals made, base credits this IST
    month, credits available, live approved ads), and the audit log (actions on this referral plus
    freeze/unfreeze on its referrer).
  - `POST admin/referrals/:id/approve {note?}`: only for `blocked` (same-device flag). If the first
    ad isn't approved yet, the referral goes back to `signed_up` and is judged normally later. If
    it is, the other Phase 4 rules run now: the credit is granted, or the remaining skip reason is
    recorded.
  - `POST admin/referrals/:id/reverse {reason}`: status `reversed`; an unused credit is revoked
    (`Reversed by admin: …`); a credit already spent isn't clawed back, same as BR-5. The BR-2
    ledger entry stays. Rejected if already reversed.
  - `POST admin/users/:id/referral-freeze {reason}` / `referral-unfreeze {note?}` (BR-9).
  - `GET/PATCH admin/referral-settings`: the `ReferralSetting` singleton (upserted).
  - Every action writes a `ReferralAdminAction` row with the admin's id (`approve_flag`,
    `reverse`, `freeze`, `unfreeze`).
- **Admin UI.** Top-level **Referrals** nav item (the open question below):
  - `/referrals`: funnel cards with 7/30/90-day and all-time presets, then filter tabs (All,
    Flagged, Awaiting first ad, Ad approved with no credit, Rewarded, Reversed, Frozen referrers)
    over a table linking to both users and the detail page.
  - `/referrals/[id]`: details, credit state, Clear flag / Reverse / Freeze or Unfreeze referrer
    (reason prompts), referrer stats, and the action log.
  - `/settings/referrals` (**Referral rewards** in the nav): edits the settings. Changes apply only
    to credits granted afterwards, because each credit snapshots its boost length and expiry.
- **Not built:** a per-user referral section on `/users/[id]` (use `/referrals?referrerId=…`, linked
  from the detail page). Freezing is done from a referral's page.

Original plan:

**BFF** — new routes on the existing single `AdminController` (matches how every other admin
feature works today, confirmed no per-feature controllers exist): `GET admin/referrals` (list +
filters: status, frozen, flagged-for-review), `GET admin/referrals/:id`, `POST
admin/referrals/:id/reverse` (thin DTO, `{ reason: string }`, same convention as `FlagListingDto`),
`POST admin/users/:id/referral-freeze` / `referral-unfreeze`, `GET admin/referrals/funnel`
(aggregated live from `ReferralClick`/`Referral` timestamps, not a cached table — same "derive from
the log" discipline as contact-reveal balances).

**Admin UI** — `apps/admin/src/app/referrals/page.tsx` (clone of `apps/admin/src/app/page.tsx`'s
list+filter-tabs shape); `apps/admin/src/app/referrals/[id]/page.tsx` (clone of
`apps/admin/src/app/listings/[id]/page.tsx`'s detail+action-panel shape).

Because `Referral` already carries `clickedAt`/`signedUpAt`/`firstAdPostedAt`/`firstAdApprovedAt`/
`rewardedAt` from earlier phases, both the per-user and admin-wide funnels are aggregate queries
over existing rows — `ReferralClick` (Phase 1) is the only genuinely new schema this phase needs.

**Confirm before building**: exact admin nav placement — a new top-level "Referrals" admin section,
or nested under an existing "Users" area?

## Phase 6 — Notifications + remaining UI touchpoints — **BUILT**

**As built (2026-10-02)** — migration `20261002100000_referral_program_phase6` adds
`ReferralCreditBatch.expiryReminderSentAt DateTime?`.
- **BFF summary.** `GET referrals/me` (`ReferralsService.getMine`, logged in): referral code (the
  user id), the current settings (boost days, credit expiry, monthly cap), base credits granted this
  IST month, unspent credits soonest-expiring first, counts (joined, first ad approved, rewarded),
  and the 20 latest referrals. Referred people are shown by **first name only**, and the skip reason
  is never returned. `previewBoostPricing` now also returns `referralCredit` (`{days, expiresAt,
  available}` or null) from `getRedeemableCreditSummary`, so the boost pickers learn about the
  credit without an extra request.
- **Notifications.** `ReferralNotificationsService` sends **email + push** for: friend signed up
  (skipped for same-device signups, which are flagged), reward granted, credit expiring, and credit
  revoked (takedown under BR-5, or an admin reversal). All are fire-and-forget; failures are
  swallowed. Email templates: `referral-signup`, `referral-reward`, `referral-credit-expiring`,
  `referral-credit-revoked`. Delivery goes through `dispatchEmailPreferWhatsapp`, so a user with no
  email gets nothing by WhatsApp until MSG91 templates are approved, and a phone-only web user
  without the app gets nothing at all for now. Push uses the listing-activity channel with
  `data.path = '/referrals'`, so a tap opens the app's Referrals screen.
- **Expiry reminder.** `ReferralCreditExpiryReminderJob`, `@Cron('0 10 * * *', IST)`: credits
  unspent, unrevoked, not yet reminded, expiring within 7 days. One reminder per user, about the
  soonest credit; all of that user's matching credits are then marked `expiryReminderSentAt`, so
  a user holding several credits isn't reminded every day.
- **Ad-posted email.** `notifyListingPosted` takes the owner's id and puts `&ref=` on the email's
  WhatsApp share link, with a one-line reward mention in `listing-posted/body.txt`.
- **Decision (2026-10-02): no share link in Bhavano's own WhatsApp messages.** The MSG91
  `listing_posted` template stays as it is, and no referral template carries a share or invite
  link. Sharing to WhatsApp happens only from the owner's own WhatsApp, started in the app or on
  the website (the share buttons above and below), so the message friends receive comes from
  someone they know. This replaces the requirements doc's "ad is live message carries the share
  link" touchpoint. The referral alert templates (signup, reward, expiring, revoked) are still
  wanted for users with no email, but they only link to Bhavano pages (My listings, Referrals).
- **Web.**
  - Owner shares carry `?ref=<userId>`: post success (`OwnerWhatsAppShare` prominent variant, which
    then leads with "Share your ad and earn a free boost" and links to `/referrals`), My listings
    (compact share), and the share icon on listing cards of the viewer's own ads. The code comes
    from the listing itself: the BFF sets `viewerReferralCode` on cards and details only when the
    viewer owns the listing, and never for Bulk Import-owned (admin-assisted or scraped) ones. So a
    poster who logs in at Publish, or an admin posting their own ad, still gets it.
  - `/referrals` (server page, `robots: noindex`, set in page metadata rather than `robots.txt`):
    balance and next expiry, the invite link (homepage + `ref`, campaign `referral_invite`) with
    copy and WhatsApp, counts, referred people, and how it works. Linked from Profile.
  - My listings banner (any visit with an active ad): the balance when there is one, otherwise
    the pitch, linking to `/referrals`.
  - `BoostBundlePicker` (post success and the My listings Boost dialog) shows **Use free N-day
    boost** when `referralCredit` is set; it calls `createBoostOrder` with `useReferralCredit`,
    which activates at once. When admin has moved paid options to the preview step, the picker
    still renders the free-boost block alone instead of nothing.
- **Mobile.**
  - Owner shares carry `ref` (post success, and the share button on the owner's own listing
    cards), using the user id decoded from the session.
  - `app/referrals/index.tsx`: same content as web; invite via WhatsApp or the native share sheet
    (which covers copy, since the app has no clipboard module). Linked from Account.
  - Android's `BoostBundleCard` and My listings `BoostModal` show the same free-boost block
    (`ReferralFreeBoost`). iOS keeps sending boosts to the website, which has it.
- **Not built in Phase 6:**
  - the welcome reward, the 3/5-referral bonus tiers and the Top Agent badge (see Phase 4);
  - the header balance chip and the "earn a free boost by inviting a friend" cross-sell line on
    the paid boost screen;
  - the landing banner for referred visitors;
  - spending a credit from the post-ad wizard's preview-step selector (it's offered after the ad
    is created instead);
  - the "clicks" step of the user-facing funnel (shown: joined, posted an ad, boosts earned).

Original plan:

**BFF** — new methods on `NotificationsService`'s existing `notifyX` template (e.g.
`notifyListingApproved:51`): `notifyReferralSignup`, `notifyReferralRewardGranted`,
`notifyReferralCreditExpiring`, `notifyReferralCreditRevoked`. Update `notifyListingPosted`
(`:704-780`) to append the share link (`?ref=<ownerId>`) and a one-line reward mention.
**Start the new/updated MSG91 WhatsApp template approval in Phase 1, not Phase 6** — external
approval lead time shouldn't gate on five phases of engineering first.

**Cron** — `ReferralCreditExpiryReminderJob`, direct clone of
`apps/bff/src/seller-jobs/listing-expiry-reminder.job.ts` (`@Cron('0 9 * * *', {timeZone:
'Asia/Kolkata'})`, `running` boolean guard, idempotent via a "no log row yet for this kind" check,
registered by adding to a module's `providers` array — `ScheduleModule.forRoot()` is already global
in `app.module.ts`), querying `ReferralCreditBatch` for `expiresAt` 7 days out and
unredeemed/unrevoked.

**Web**
- Share screen: `runPostLiveSideEffects` already logs a `/post/success` page view (`:1270`) — build
  the Share screen within that existing success page rather than a new route. Reuse
  `apps/web/src/components/home/OwnerWhatsAppShare.tsx` and `apps/web/src/lib/shareLinks.ts`
  (`taggedShareUrl`, `whatsappShareHref`) wholesale; only new bit is appending `?ref=<userId>` and
  the invite copy line.
- `apps/web/src/app/referrals/page.tsx`, linked from `apps/web/src/app/profile/page.tsx` the same
  outline-button way `my-listings`/`my-requirements` already are (`profile/page.tsx:43-55`).
- `BoostPlanSelector.tsx:77-98` — new "Use free boost" block in the same slot/styling convention
  already used for the platform-fee banner (`opt.free` text styling at `:64`; confirmed no
  `ProBoostCredit` UI exists there today, so this is genuinely new UI, not a toggle on existing UI).

**Mobile**
- Equivalent post-success Share screen; reuse `ListingCard.tsx:37-42`'s `Share.share` for the native
  sheet.
- `apps/mobile/app/referrals/index.tsx` — new top-level route (not a bottom tab), linked from
  `apps/mobile/app/(tabs)/account.tsx` the same way `my-listings`/`purchases` already are
  (`account.tsx:732-738`).
- `BoostPlanSelector.tsx:94-103` mirrors the web slot.

**Other touchpoints** (My Ads balance banner, header balance chip, Boost-screen cross-sell line,
Top Agent badge) are new small components with no closer existing analog to clone than the app's
general card/banner idioms already in use.

## Critical files

- `apps/bff/prisma/schema.prisma` — 5 new models (`Referral`, `ReferralClick`,
  `ReferralCreditBatch`, `ReferralSetting`, `ReferralPhoneLedger`, `ReferralAdminAction`) + 2 new
  `User` fields (`referralFrozenAt`, `referralFrozenReason`).
- `apps/bff/src/referrals/` (new module) — `ReferralsService`, `ReferralsController`.
- `apps/bff/src/listings/listings.service.ts` — the 2 hook call sites (`runPostLiveSideEffects`,
  `approve()`) and 2 revocation call sites (`flag()`, `deleteCompletely()`).
- `apps/bff/src/auth/auth.service.ts` — 3 signup call sites for `attributeSignupIfReferred`.
- `apps/bff/src/payments/payments.service.ts` — new skip-payment branch in `createBoostOrder`.
- `apps/bff/src/admin/admin.controller.ts` — new referral admin routes.
- `apps/web/src/middleware.ts` — `bhavano_ref` cookie + click-log call.
- `apps/web/src/components/home/BoostPlanSelector.tsx` /
  `apps/mobile/src/components/home/BoostPlanSelector.tsx` — "use free boost" UI.
- `apps/web/src/app/referrals/page.tsx` / `apps/mobile/app/referrals/index.tsx` — new screens.
- `apps/admin/src/app/referrals/` — new admin list+detail screens.
- `apps/bff/src/notifications/notifications.service.ts` — 4 new `notifyX` methods.
- `apps/bff/src/seller-jobs/` — new `ReferralCreditExpiryReminderJob`.

## Verification

- Per phase: unit tests following existing patterns (`listings.service.spec.ts`-style mocked-prisma
  tests for `ReferralsService`; a payments test for the new skip-payment branch mirroring however
  `ProBoostCredit`'s branch is tested today).
- End-to-end, before calling v1 done: every acceptance criterion already listed in
  `docs/plans/bhavano-referral-program.md`'s "Rollout, acceptance criteria and open questions"
  section — share → signup → first-ad-approval → credit → redemption → expiry → admin
  freeze/reverse → outage-doesn't-block-posting, exercised against real test accounts across both
  platforms, per that doc's own rollout plan.
- Deep linking specifically needs manual device testing (both platforms, app-installed and
  not-installed states) before anything downstream is demoed — it's the one piece that can't be
  verified by a unit test.

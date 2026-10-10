# Owner win-back: posted-ad reminder (email/WhatsApp) + mobile email-capture dialog

## Context

Earlier this session we found and fixed a real-money leak in the Google Ads account: owners who
already have a Bhavano account were being re-acquired through a *second paid ad click* instead of
coming back directly, because nothing proactively invites them back. We added an audience
exclusion on the ads side (stop paying for it), but the root cause is a retention gap in the
product itself:

- The only existing owner-facing touchpoint after posting is `ListingExpiryReminderJob`, which
  fires **once**, 30 days after posting, and only nudges toward Renew — there's no earlier
  "how's it going?" nudge, and nothing fires again after that single email.
- Phone-only signups (the common case for Indian mobile users) have no email on file at all, so
  even that one reminder reaches them only if a WhatsApp template happens to exist for it.
- There's already a shipped mechanism for *collecting* a missing email after login
  (`ProfileCompletionDialog` on web) — it's just never been ported to the mobile app, where
  phone-only signups are actually most common.

This plan covers four related pieces:

**Part A** — a new job that reminds an owner a few days after posting, via push/email/WhatsApp in
that preference order — closing the "no early touchpoint" gap.

**Part B** — port the existing, already-tuned `ProfileCompletionDialog` to mobile, so phone-only
owners get asked (and can verify) an email, making them reachable by Part A's job and any future
email-based nudge. **Decision already made:** reuse the exact existing cadence (any return login,
capped at 3 nudges, 7-day snooze) rather than building a new "exactly login #2" rule — it's
already-tuned, shipped UX, and a strict login-#2-only rule would need new login-counting logic for
no clear benefit over what's already there.

**Part C** — a new daily digest ("N views, N favourites, N new messages since yesterday") sent
push-first, then email, then WhatsApp. **Important scope decision, already confirmed:** push,
email and WhatsApp notifications for new messages, favourites, and "interested" taps **already
exist today and fire in real time** (push always; email/WhatsApp only while Instant Alerts/Boost —
a paid feature — is active). This digest is an **additional, separate layer on top of that
existing real-time behavior, which is left completely unchanged** — nothing about Instant Alerts'
or Boost's current paid differentiation changes. The push > email > WhatsApp preference order is
new and applies only to this digest and to Part A's reminder; it does not retrofit onto the
existing real-time triggers.

**Part D** — a new admin page showing, per calendar day, how many notifications went out on each
channel (email/WhatsApp/push), with the actual user/listing list for a given day lazy-loaded only
when that day is clicked — covering every notification kind in the system (the existing real-time
ones, plus Parts A and C's new ones), not just the new ones.

## Status

- **Part A: implemented** (this commit). `ListingPostedReminderJob`, the new
  `dispatchPushPreferEmailPreferWhatsapp` dispatcher, `notifyListingPostedReminder` +
  `notifyDailyActivityDigest` on `NotificationsService`, the matching `PushService` typed methods,
  the four email template folders (two for Part A, two reserved for Part C), the six WhatsApp
  reference-copy folders + three `whatsapp_create_*_template.py` submission scripts, and full test
  coverage (27 new tests) are all in. WhatsApp sending for both reminder variants is gated behind
  `WHATSAPP_LISTING_POSTED_REMINDER_TEMPLATE` / `WHATSAPP_LISTING_POSTED_REMINDER_FEATURED_TEMPLATE`
  — unset until the two Meta template submissions are actually approved; email and push work today.
- **Part C: implemented** (this commit). `DailyActivityDigestJob` runs daily at 8am IST, batch-
  aggregates views/favourites/received-messages per owner across all their live listings (same
  bounded-batch + in-memory-aggregation pattern `listPerformanceForAdmin` already uses, not a
  per-owner query loop), skips owners with nothing to report, and dedups same-day re-runs via a
  `UserNotificationLog` check before dispatching. 8 new tests, all passing; full BFF suite clean
  (939 passed, same 2 pre-existing unrelated failures).
- **Part D: implemented** (this commit). `AdminService.getNotificationDailySummary` /
  `getNotificationDayDetail` bucket `ListingNotificationLog` + `UserNotificationLog` rows by IST
  calendar day and channel (`istDateKey` helper — the first day-bucketing convention in this
  codebase, following `getPostFunnel`'s fetch-then-bucket-in-JS style rather than raw-SQL date
  truncation); two new `GET /admin/notifications/daily-summary` /
  `.../daily-summary/detail?date=` routes. New admin page `/notification-log` — date-range filter
  (`DateRangeFilter`, 7-day default like post-funnel), one row per day with Email/WhatsApp/Push/Total
  columns; `NotificationLogTable` copies `PageVisitsTable`'s exact lazy-load-per-row pattern
  (`expandedDays: Set<string>` + fetch-once `details` cache keyed by date) for the per-day
  user/listing drilldown, via new server action `fetchNotificationDayDetailAction`. New nav entry
  in `AdminNav.tsx`. 6 new BFF tests; `tsc --noEmit` and `next build` both clean on the admin side.
- **Part B: not yet implemented** — plan below stands as written for it.

## Part A — "You posted recently" reminder job

**New job**: `apps/bff/src/seller-jobs/listing-posted-reminder.job.ts`, copying
`listing-expiry-reminder.job.ts`'s exact shape — `@Cron('0 9 * * *', { timeZone: 'Asia/Kolkata' })`,
a `running` guard, a `REMINDER_KIND` string constant (`'listing_posted_reminder'` — confirmed
`ListingNotificationLog.kind` is a plain `String` column, schema.prisma:1455, no migration needed),
and the same per-listing try/catch loop that only writes a `ListingNotificationLog` row on a
non-null channel. The one real difference: window on `createdAt` (not `expiresAt`), `[now - 3d,
now - 3d + 1d)` — 3 days chosen the same way `boost-nudge.job.ts` picked its 24-72h window ("most
ads get only a couple of views in their first week"); keep it a named constant so it's a one-line
tune. Registered in `apps/bff/src/seller-jobs/seller-jobs.module.ts`'s providers, alongside the
existing job.

**New shared dispatcher — push first, reused by Parts A and C.** `NotificationsService` and
`PushService` were separate, parallel systems — every real-time push/email/WhatsApp call site
calls whichever one or two of them it needs directly (e.g. `MessagingController` calls
`PushService.notifyNewMessage` directly; `MessagingService` separately calls
`NotificationsService.notifyNewMessage` for the Instant-Alerts-gated email/WhatsApp leg). Neither
service depended on the other before this. For a real push-else-email-else-WhatsApp *preference
order* (not two independent calls), added one new private method to `NotificationsService`:

```ts
private async dispatchPushPreferEmailPreferWhatsapp(
  userId: string,
  user: NotifiableUser,
  pushSend: () => Promise<void>,
  email: { subject: string; text: string; html?: string; bcc?: string },
  whatsapp?: { template: string; params: string[] | Record<string, string>; buttonUrlSuffix?: string },
): Promise<'push' | 'email' | 'whatsapp' | null> {
  const hasPush = await this.prisma.pushToken.findFirst({ where: { userId }, select: { id: true } });
  if (hasPush) { await pushSend(); return 'push'; }
  return this.dispatchEmailPreferWhatsapp(user, email, whatsapp);
}
```
This adds `PushService` as a new constructor dependency of `NotificationsService` (`PushModule` is
imported into `NotificationsModule`) — just to call its typed `notifyXxx` methods via the
`pushSend` thunk the caller passes in, it doesn't duplicate push-sending logic. Confirmed
`PushModule` does not import `NotificationsModule`, so no circular dependency. Push is checked by
token existence, not delivery success — matches every existing push call site already treating
sends as fire-and-forget (`PushService`'s methods return `Promise<void>`, never report
success/failure, same accepted gap this plan inherits rather than tries to fix).

**New `NotificationsService` method**: `notifyListingPostedReminder(userId, user, listingTitle,
isBoosted)`, calling the new dispatcher above. Email content modeled on
`notifyListingExpiryReminder`'s template load/render; WhatsApp arg shape modeled on `notifyWelcome`.
**Note**: `notifyListingPosted` (the same-day "your ad is live" confirmation) is a different,
bespoke path using MSG91's `Msg91Provider` — not modeled on for the email/WhatsApp legs here;
`notifyWelcome`'s plain shape is the simpler precedent, already shared by four other notifications
in this file. The job computes `isBoosted` the same way `listings.service.ts` already does
elsewhere: `(listing.boostedUntil?.getTime() ?? 0) > Date.now()`.

**Conditional Featured push — the reminder's actual point when not already boosted.** Per explicit
instruction: if the listing is **not** currently Featured, the reminder actively pushes the
upgrade, not just mentions it softly; if it **is** already Featured, it skips any Featured mention
entirely (nothing to upsell). Since a WhatsApp template's text is fixed once Meta-approved — no
in-message conditionals — the fix was **two separate template directories per channel**, selected
by `isBoosted`, not one template with a soft optional line:

- `email/listing-posted-reminder/` — **not boosted** variant: leads with the Featured push
  (subject "Get seen first — feature ...", body makes the case directly: ad isn't featured yet,
  Featured ranks above regular listings and gets more views, button "Feature my ad").
- `email/listing-posted-reminder-featured/` — **already boosted** variant: plain "checking in"
  copy only, no Featured mention anywhere, button "Manage my ad" → `/my-listings`.
- Both variants avoid "free"/"post free" framing (the exact anchoring problem fixed in this
  account's Google Ads copy earlier this session).
- `notifyListingPostedReminder` just does
  `loadTemplate(isBoosted ? 'email/listing-posted-reminder-featured' : 'email/listing-posted-reminder')`
  — one `if`, no template-engine conditionals needed.

**WhatsApp — two approved templates instead of one, same reason.** Two template submissions, not
one: `apps/bff/notification-templates/whatsapp/listing-posted-reminder/` (push copy) and
`whatsapp/listing-posted-reminder-featured/` (plain copy), each with its own
`whatsapp_create_*_template.py` submission script (static `/my-listings` button, not a dynamic
deep link — this reminder doesn't need a per-send URL variable the way `listing_posted_v2` does).
Two env vars once Meta approves them: `WHATSAPP_LISTING_POSTED_REMINDER_TEMPLATE` and
`WHATSAPP_LISTING_POSTED_REMINDER_FEATURED_TEMPLATE` — same gated pattern `WHATSAPP_WELCOME_TEMPLATE`
already uses. **This does not block shipping the job**: `dispatchEmailPreferWhatsapp` already
handles an absent `whatsapp` arg cleanly (phone-only owners with no push token are skipped, no
error — the same documented gap four other notifications already accept). Email-holding (or
push-registered) owners get reminded immediately; phone-only owners start getting reminded the
moment the env vars are set post-approval, with no second deploy.

**Tests**: `listing-posted-reminder.job.spec.ts` mirrors
`referral-credit-expiry-reminder.job.spec.ts`'s shape (fixed `now`, window/dedup assertions,
`isBoosted` computed and passed through for both a boosted and unboosted fixture, continues past a
per-listing throw). `notifications.service.spec.ts` gained a block covering: push-preferred when a
token exists (and email/WhatsApp are never touched), fallback to email, the not-boosted vs
already-boosted template selection, WhatsApp skipped cleanly with no env var, WhatsApp sent once
the env var is set, and the same push/email branches for the digest method. 27 new tests, all
passing; full BFF suite re-run clean (932 unaffected, the same 2 pre-existing failures from earlier
this session — `jose`/`jwks-rsa` ESM parse error and an order-dependent "Furnishing is required"
flake — confirmed via `git stash` to predate this change).

## Part B — mobile port of the email-capture dialog

**Backend: zero changes.** Everything needed already exists and is reused as-is:
`GET /users/me/profile-nudge` → `UsersService.getProfileNudge` (`users.service.ts:46`, returns
`{ show, missing: ("email"|"phone")[] }`), `POST /users/me/profile-nudge/snooze`,
`POST /users/me/email/request-code` / `POST /users/me/email/verify`
(`email-verification.service.ts:44/86`), `POST /users/me/merge/confirm`.

**`apps/mobile/src/lib/bffClient.ts`** — two new thin wrappers (everything else needed —
`requestEmailCode` :1000, `verifyEmail` :1007, `linkPhone` :1020, `confirmAccountMerge` :1030 —
already exists, confirmed):
```ts
export function fetchProfileNudge(accessToken: string): Promise<ProfileNudgeDto> { ... }
export function snoozeProfileNudge(accessToken: string): Promise<{ success: true }> { ... }
```
Also **widen** `verifyOtp` (:687), `loginWithGoogle` (:699), `loginWithApple` (:715)'s return types
to include `isNewUser?: boolean` — confirmed the BFF already returns it on every one of these
(`auth.service.ts:554-563 issueSession`, called with `isNewUser` on all three login paths,
:180/291/364), the mobile client's TS types just currently narrow it away; this is a type-only fix,
nothing server-side to change.

**`apps/mobile/src/context/HomeSheetsProvider.tsx`** — add `isNewUser` state, widen
`onLoginSuccess(accessToken: string)` (:522) to `onLoginSuccess(accessToken: string, isNewUser =
false)`, and pass `session.isNewUser` at its three call sites (:645, 667, 700 — confirmed all three
currently pass only `session.accessToken`, dropping the rest). Expose `isNewUser` on
`HomeSheetsContextValue`.

**Cold-start caveat, accepted as-is**: a session restored from `SecureStore` on app relaunch never
calls `onLoginSuccess`, so `isNewUser` has no persisted value across restarts (unlike web's
NextAuth cookie). Defaulting to `false` on restore means a fresh signup is correctly suppressed for
the rest of *that* session, and any later cold start is treated as a return visit — which is fine,
since `getProfileNudge`'s own cap/snooze is the real backstop against over-showing either way.

**New file: `apps/mobile/src/components/home/ProfileCompletionDialog.tsx`** — port of
`apps/web/src/components/home/ProfileCompletionDialog.tsx`'s exact state machine (`Step =
"askPhone" | "askOtp" | "askEmail" | "askEmailCode" | "confirmMerge" | "done"`) onto RN primitives:

- Gate: after first navigation post-mount (mirror web's `initialPath`/checkedRef wait), if
  `isLoggedIn && !isNewUser`, call `fetchProfileNudge`; if `!nudge.show || nudge.missing.length ===
  0` do nothing; else open asking for whichever of `missing` applies (prefer `"phone"` if both,
  matching web's own `want` precedence).
- "Shown once" gate: no `sessionStorage` equivalent needed — a module-level `let shownThisLaunch =
  false` flag is enough, since `getProfileNudge`'s cap/snooze already caps repeats across restarts;
  this only prevents re-showing twice in the *same* app launch.
- Phone step: `sendOtp` → `linkPhone(accessToken, phone, otp)`. Email step:
  `requestEmailCode(accessToken, email)` → `verifyEmail(accessToken, email, code)`. Both already in
  `bffClient.ts`.
- **Three-way result branch, exactly mirroring web's `handleLinkResult`** (ProfileCompletionDialog.tsx:96-105) — both `linkPhone`/`verifyEmail` return `LinkIdentifierResult`
  (`packages/types/src/index.ts:2246-2256`):
  - `{status: "linked"}` → close dialog, refresh profile.
  - `{status: "merged", reauthRequired}` → close dialog; if `reauthRequired`, log out (force
    re-auth) instead of just refreshing — **conditional**, not automatic.
  - `{status: "confirm", summary}` → switch to the `confirmMerge` step (below), **not** an error.
- `confirmMerge` step: render the same itemized sentence web builds from `AccountMergeSummary`
  (`listings`/`conversations`/`favourites`/`payments`/`activeSubscription` counts, comma-joined,
  "some activity" fallback when all zero — ProfileCompletionDialog.tsx:284-298). Three actions:
  **Merge the accounts** → `confirmAccountMerge(accessToken, {phone|email, code})` →  on success,
  **always** log out (web's `onConfirmMerge` calls `succeed(true)` unconditionally here, unlike the
  automatic-merge branch above — confirmed at ProfileCompletionDialog.tsx:149-162). **Use a
  different {email/phone}** → back to the input step. **Not now** → dismiss + snooze.
- Dismiss (any step): close + fire-and-forget `snoozeProfileNudge(accessToken)`.
- UI: a plain RN `Modal` (`transparent`, `animationType="fade"`), styled off `useAppTheme()`'s
  `colors` the same way `ProfileCompletionBanner.tsx` and the login sheet in `HomeSheetsProvider`
  already do — reuse that login sheet's input/button visual language rather than inventing new
  styles.

**Mount point**: `apps/mobile/app/_layout.tsx`, as a sibling of `PushBridge`/`GuestSavesSync`
inside `AppCrashBoundary`'s children — root-level, not tab-level, since the dialog needs to be
reachable from any screen, same as web's isn't scoped to the homepage. **Keep
`ProfileCompletionBanner.tsx` as-is** — it's a separate, permanent-dismiss, no-nag channel; the
dialog is the capped/snoozed one. No change needed there.

## Part C — daily activity digest (views / favourites / new messages) — implemented

**Open assumption, flagged for review rather than guessed past**: "viewing" is read here as raw
`ListingView` rows — a signal that currently triggers **no notification of any kind**, real-time
or otherwise (confirmed: only the explicit "interested" tap and favourites have existing
notifications; plain page views don't). If "viewing" actually meant the existing interest-tap
signal, the digest would double-count what's already real-time-notified — flag this during review
if the assumption is wrong.

**New job**: `apps/bff/src/seller-jobs/daily-activity-digest.job.ts`, a different shape from Part
A's (recurring per-user digest, not a once-ever per-listing reminder):
- `@Cron('0 8 * * *', { timeZone: 'Asia/Kolkata' })` — a different hour from the existing 9am jobs,
  spreading cron load rather than batching everything at once.
- For each user who owns at least one live listing: count `ListingView` rows, `Favourite` rows, and
  received `Message` rows **in the trailing 24h**, across all of that user's listings. No new
  "last digest sent at" field needed — a fixed trailing-24h window, run once daily, is simpler than
  tracking per-user digest state and self-corrects if a run is ever missed (next day's window just
  starts from "yesterday" again, not from whenever the last successful run was).
- Skip entirely (no notification, no log row) when all three counts are zero — most days for most
  listings, matching the "don't notify about nothing" principle `notifyListingExpiryReminder`
  already follows for its own trigger condition.
- Dispatch via the same `dispatchPushPreferEmailPreferWhatsapp` helper from Part A. Log via
  `UserNotificationLog` (not `ListingNotificationLog` — this is user-scoped, aggregated across
  potentially several listings, not any one listing's own event), `kind: 'daily_activity_digest'`.
- Same-day dedup: before aggregating, reads existing `UserNotificationLog` rows with
  `kind: 'daily_activity_digest'` and `sentAt` on today's calendar day, and skips any owner already
  in that set — protects a manual re-run on the same day from double-sending.

**`NotificationsService.notifyDailyActivityDigest`, `PushService.notifyDailyActivityDigest`, and
the `email/daily-activity-digest/` + `whatsapp/daily-activity-digest/` template folders and
`whatsapp_create_daily_activity_digest_template.py` submission script** were built alongside Part
A, sharing the same dispatcher. The job itself (`daily-activity-digest.job.ts`) reads real
view/favourite/message counts via one `listing.findMany` plus two `groupBy`s and one
`conversation`/`message` pair — the same bounded-batch + in-memory-aggregation shape
`listPerformanceForAdmin` already uses, not a per-owner query loop — and calls this method on the
8am IST schedule.

## Part D — admin notification log page

**New BFF endpoints** in `apps/bff/src/admin/admin.service.ts`, following `getPostFunnel`'s own
fetch-then-bucket-in-JS style rather than inventing raw-SQL date truncation — confirmed no
day-bucketing convention exists anywhere in this codebase yet, so this is the first:
- `getNotificationDailySummary(from, to)` → `{ date: string; email: number; whatsapp: number; push: number }[]`.
  Fetches every `ListingNotificationLog` and every `UserNotificationLog` row with `sentAt` in
  range, buckets by IST calendar day (same `istDayStart`/`istDayEnd` convention the admin app
  already uses elsewhere) and by `channel` in JS after the fetch.
- `getNotificationDayDetail(date)` → list of `{ kind, channel, sentAt, userId, userName, userPhone,
  userEmail, listingId?, listingTitle? }`, fetched **only when a specific day is requested** — this
  is the lazy part. `ListingNotificationLog` rows need a join through `Listing.owner` to resolve
  user identity (the row only has `listingId`); `UserNotificationLog` rows already have `userId`
  directly.
- Controller routes: `GET /admin/notifications/daily-summary`, `GET /admin/notifications/daily-summary/detail?date=...`.

**New admin page**: `apps/admin/src/app/notification-log/page.tsx` — date-range filter (reuse
`DateRangeFilter`, same convention as every other admin screen this session touched), one row per
day with three count columns (Email/WhatsApp/Push). Clicking a day's row lazy-loads and expands its
detail list, **copying `PageVisitsTable.tsx`'s exact pattern** (confirmed precedent, not invented
fresh): `expandedDays: Set<string>` tracks which days are open, `details: Record<string,
NotificationDayDetailDto[] | "loading" | "error">` is the fetch-once cache keyed by date string —
toggling a day checks `if (details[date] !== undefined) return` before fetching, so each day's
detail is fetched at most once regardless of later collapse/expand. New server action
`fetchNotificationDayDetailAction(date)` in `apps/admin/src/app/actions/admin.ts`, same
`{success:true,data}|{success:false,error}` shape `fetchSessionTrailAction` already uses. Add the
new page to `AdminNav.tsx`'s nav list.

## Verification

**Part A** — done, see Status above.

**Part B**:
1. `pnpm --filter @bhavano/mobile typecheck` after wiring the new `bffClient.ts` functions/types —
   catches any `ProfileNudgeDto`/`LinkIdentifierResult` mismatch immediately.
2. No new BFF surface — nothing there should need a new test.
3. Manual device/simulator pass, seeding a test user directly in the dev DB (`email: null,
   profileNudgeCount: 0, profileNudgeSnoozedUntil: null`) rather than driving a real signup to get
   a "fresh-but-aged" account:
   - Fresh signup this launch → dialog does **not** appear (`isNewUser` true).
   - Log out, log back in → navigate once → dialog appears asking for email.
   - Force-quit/reopen without logging out (SecureStore-restored session) → dialog still eligible,
     confirming the cold-start default behaves as intended.
   - Email happy path: request code → check dev inbox → verify → dialog closes, profile updates.
   - Merge-confirm path: pre-seed a second test user already verified on the email you're about to
     enter on the first; confirm the three-option panel renders with the right summary, "Merge the
     accounts" succeeds and forces logout, "Use a different email" returns to input.
   - Snooze/cap: "Not now" → confirm `profileNudgeSnoozedUntil` advances ~7 days via
     `GET /users/me/profile-nudge`; force `profileNudgeCount` to 3 directly in the DB → confirm
     `show: false` thereafter (only the separate banner shows).
   - Confirm the dialog never blocks Post Ad / messaging / contact-reveal underneath it.

**Part C** — done. 8 tests in `daily-activity-digest.job.spec.ts`: no live listings → no-op; zero
counts → skipped; views/favourites aggregated across all of an owner's listings; messages counted
only when received (not the owner's own replies); no log row when the channel is null; same-day
dedup skips an already-notified owner; a throw on one owner doesn't stop the rest; the view/
favourite window is bounded to the trailing 24h ending at `now`.

**Part D** — done. `tsc --noEmit` clean on both `@bhavano/bff` and `admin`; `pnpm --filter admin
build` clean (Turbopack production build, `/notification-log` registered as a dynamic route). 6
new BFF tests (`admin.service.spec.ts`) covering the IST-day bucketing and the per-day detail join
through `Listing.owner`. The manual spot-check (counts against a direct
`SELECT count(*) FROM "ListingNotificationLog" WHERE ...`, confirming a day's detail fetches
exactly once across expand/collapse/expand) is still outside what this session can run — no
running BFF/admin instance or seeded data to click through — so it remains an open manual
follow-up, not blocking since both apps build and typecheck clean.

### Critical files
- `apps/bff/src/seller-jobs/listing-posted-reminder.job.ts` — **done**
- `apps/bff/src/seller-jobs/seller-jobs.module.ts` — **done**
- `apps/bff/src/notifications/notifications.service.ts` (`dispatchPushPreferEmailPreferWhatsapp`,
  `notifyListingPostedReminder`, `notifyDailyActivityDigest`) — **done**
- `apps/bff/src/push/push.service.ts` (`notifyListingPostedReminder`, `notifyDailyActivityDigest`)
  — **done**
- `apps/bff/notification-templates/email/listing-posted-reminder/` +
  `email/listing-posted-reminder-featured/` + `email/daily-activity-digest/` +
  `whatsapp/listing-posted-reminder/` + `whatsapp/listing-posted-reminder-featured/` +
  `whatsapp/daily-activity-digest/` — **done**
- `whatsapp_create_listing_posted_reminder_template.py` +
  `whatsapp_create_listing_posted_reminder_featured_template.py` +
  `whatsapp_create_daily_activity_digest_template.py` — **done** (preview-only until submitted)
- `apps/mobile/src/lib/bffClient.ts` (`fetchProfileNudge`/`snoozeProfileNudge`, widened login
  return types) — not started
- `apps/mobile/src/context/HomeSheetsProvider.tsx` (`isNewUser` passthrough) — not started
- `apps/mobile/src/components/home/ProfileCompletionDialog.tsx` (new) — not started
- `apps/mobile/app/_layout.tsx` (mount point) — not started
- `apps/bff/src/seller-jobs/daily-activity-digest.job.ts` (new, Part C) — **done**
- `apps/bff/src/admin/admin.service.ts` + `admin.controller.ts` (new
  `getNotificationDailySummary`/`getNotificationDayDetail` endpoints, Part D) — **done**
- `apps/admin/src/app/notification-log/page.tsx` (new, Part D) — **done**
- `apps/admin/src/components/NotificationLogTable.tsx` (new, Part D) — **done**
- `apps/admin/src/app/actions/admin.ts` (new `fetchNotificationDayDetailAction`, Part D) — **done**
- `apps/admin/src/components/AdminNav.tsx` (new nav entry, Part D) — **done**

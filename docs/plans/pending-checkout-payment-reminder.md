# Pending-checkout payment reminder ("finish posting your ad")

## Context

A listing that needs a platform fee or an elected Boost stays in `publishState: 'pending_checkout'`
until payment completes — confirmed (research agent + direct code read) that this state has
**no expiry and no cleanup job**: `apps/bff/src/listings/listings.service.ts:1850` sets it at
creation time and nothing ever times it out or deletes it. The only way an owner discovers they
have one waiting is if they happen to log back into the app themselves — `getSellerAttention`
(`listings.service.ts:2372-2397`) surfaces it reactively via `?openPublishCheckout=<id>` on
`/my-listings`, read by `AutoOpenPublishCheckout` (`apps/web/src/components/home/
PublishCheckoutRecovery.tsx:58-80`) — but nobody who doesn't come back gets told at all. This is
the same push→email→WhatsApp gap the owner win-back plan (`docs/plans/
owner-win-back-notifications-and-mobile-email-capture.md`) already closed for "ad posted, not
boosted" and "daily activity" — this plan closes it for "ad never actually went live."

**Confirmed decision:** a single one-shot reminder at ~3-4 hours after the listing entered
`pending_checkout`, never repeated — same cart-abandonment timing reasoning (same-day intent is
highest) and the same one-shot dedup convention `ListingPostedReminderJob` already uses.

**Reuses, rather than reinvents, almost everything:**
- The exact `pending_checkout` → fresh-order resume flow is already correct and tested — this plan
  only adds the *notification*, not any change to checkout/payment logic.
- The notification's link target, `/my-listings?openPublishCheckout=<id>`, is **already wired** on
  web (`AutoOpenPublishCheckout`) and needs **no mobile code change** either —
  `onNotificationTap` (`apps/mobile/src/lib/push.ts:152-182`) already forwards a push's bare
  `data.path` string straight into `router.push`, so a push with `path: '/my-listings?
  openPublishCheckout=<id>'` opens the exact same recovery modal with zero new mobile code.
- Push and email continue to be attempted along with WhatsApp for this reminder. The WhatsApp leg
  uses MSG91, matching the proven welcome and ad-posted confirmation paths.
- `AdminService.getNotificationDayDetail` already resolves any `ListingNotificationLog` row's
  recipient from `listing.owner` for every kind except `saved_search_match` — this new kind needs
  **no admin-side code change** to show up correctly in the notification log.

**Copy, learned from a same-day incident:** no benefit/comparison language, no boost/Featured pitch
— purely "your ad isn't live yet, finish paying to publish it." The WhatsApp `_v1→_v2` MARKETING
reclassification earlier this session was caused by exactly that kind of language; this one has
nothing to sell, just a status + an action, so it should read as UTILITY cleanly from the start.

**Volume note:** this adds to the same Zoho/ZeptoMail email pipeline already stressed by a
saved-search-match flood earlier the same day. Volume should be modest (one-shot, only listings
that both needed payment *and* sat unpaid 3+ hours), but worth being aware it's additive, not free.

## Implementation

**New job** — `apps/bff/src/seller-jobs/pending-checkout-reminder.job.ts`, copying
`listing-posted-reminder.job.ts`'s exact shape (constructor, `running` guard, injectable `now`
param, try/catch-per-listing loop, dedup via `notificationLogs: { none: { kind: REMINDER_KIND } }`).
Two real differences:
- **Hourly cron**, not daily — `@Cron('20 * * * *', { timeZone: 'Asia/Kolkata' })` (20 minutes past
  the hour, avoiding `outreach-campaign.job.ts`'s own `0 * * * *` slot — hourly cadence has
  precedent in this codebase at that file and `boost-nudge.job.ts`'s `15 10-19 * * *`). A 3-4h
  window needs to be checked roughly hourly to land reliably within that band regardless of what
  time of day the listing was created; the existing once-daily jobs' 24h-wide windows don't fit a
  same-day target.
- Window is `[now - 4h, now - 3h)` — contiguous across consecutive hourly runs (an hour later the
  window shifts by exactly 1h, so every listing crosses the band exactly once).
- Query: `publishState: 'pending_checkout'` (current state, not a snapshot — a listing paid for in
  the meantime is naturally excluded), `createdAt` in that window, `notificationLogs: { none: {
  kind: 'pending_checkout_reminder' } }`, include `owner`.
- `REMINDER_KIND = 'pending_checkout_reminder'`, logged via `ListingNotificationLog` (listing-scoped,
  same as `listing_posted_reminder` — not `UserNotificationLog`).

**Register it** in `apps/bff/src/seller-jobs/seller-jobs.module.ts`'s `providers` array, alongside
the other three.

**New `NotificationsService` method** — `notifyPendingCheckoutReminder(userId, user, listingTitle,
listingId)`, modeled directly on `notifyListingPostedReminder` (`notifications.service.ts:762-806`):
loads `email/pending-checkout-reminder` via `loadTemplate`, renders through `renderEmail`, button
links to `${site}/my-listings?openPublishCheckout=${listingId}` (not the bare `/my-listings` the
posted-reminder uses — this one needs the specific listing's modal to auto-open), and attempts
push, email, and MSG91 WhatsApp independently. The WhatsApp template uses named params `{name,
title}` and a dynamic URL button containing the listing id.

**New `PushService` method** — `notifyPendingCheckoutReminder(recipientId, listingTitle, listingId)`,
modeled on `notifyListingPostedReminder` (`push.service.ts:258-275`): `data: { kind:
'pending_checkout_reminder', path: `/my-listings?openPublishCheckout=${listingId}` }`. Body copy:
plain status + action, e.g. `"Finish posting \"${listingTitle}\" — it's not live yet"`.

**Email template** — `apps/bff/notification-templates/email/pending-checkout-reminder/` (5 files:
subject/heading/preheader/body/buttonLabel, same shape as `listing-posted-reminder/`). Subject/
heading something like "Complete payment to publish" (the exact phrase `PublishCheckoutRecovery.tsx`
already uses, for consistency); body states the ad is saved but not live, nothing else needed to
finish it; button label "Complete payment".

**WhatsApp template** — `apps/bff/notification-templates/whatsapp/pending-checkout-reminder/`,
using the **dynamic-button** folder shape `listing-posted/` already established (`header.txt`,
`body.txt`, `footer.txt`, `buttonLabel.txt`, `buttonUrlBase.txt` =
`https://www.bhavano.com/my-listings?openPublishCheckout=`, `buttonUrlExample.txt` = a sample
listing id), not the static-button shape `listing-posted-reminder/` used. New submission script
`whatsapp_create_pending_checkout_reminder_template.py`, copying `whatsapp_create_listing_posted_
template.py`'s dynamic-button payload shape (`BUTTONS` component with `"url":
BUTTON_URL_BASE + "{{1}}"` and `"example": [BUTTON_URL_BASE + BUTTON_URL_EXAMPLE]`) — preview-only
by default, `--submit` to submit it to Meta. The app sends through MSG91, not the Meta-direct
provider: register/sync the approved template in MSG91 and configure
`MSG91_WHATSAPP_PENDING_CHECKOUT_REMINDER_TEMPLATE_NAME` and its own
`MSG91_WHATSAPP_PENDING_CHECKOUT_REMINDER_NAMESPACE` from the MSG91 dashboard's "Code" snippet.
The integrated sender number is shared with the welcome/ad-posted templates. Missing MSG91
template configuration skips only WhatsApp; push/email remain available.

**Tests**:
- `pending-checkout-reminder.job.spec.ts`, mirroring `listing-posted-reminder.job.spec.ts` — fixed
  `now`, assert the 3-4h window and the `publishState`/dedup query, assert a listing paid in the
  interim (now `live`) is excluded, assert a listing created 2h or 5h ago is excluded (window
  boundaries).
- Provider and service tests cover the MSG91 payload shape, dynamic checkout URL, skipped/missing
  template behavior, delivery failure handling, and multi-channel sends.

No DB migration, no admin-side change, no web/mobile frontend change — the existing deep-link
mechanics on both platforms already handle this notification's target.

### Critical files
- `apps/bff/src/seller-jobs/pending-checkout-reminder.job.ts` (new)
- `apps/bff/src/seller-jobs/pending-checkout-reminder.job.spec.ts` (new)
- `apps/bff/src/seller-jobs/seller-jobs.module.ts` (register the job)
- `apps/bff/src/notifications/notifications.service.ts` (new `notifyPendingCheckoutReminder`)
- `apps/bff/src/push/push.service.ts` (new `notifyPendingCheckoutReminder`)
- `apps/bff/notification-templates/email/pending-checkout-reminder/` (new, 5 files)
- `apps/bff/notification-templates/whatsapp/pending-checkout-reminder/` (5 files as of v3 —
  header/body/buttonLabel/buttonUrlBase/buttonUrlExample; footer.txt removed, see v3 update below)
- `whatsapp_create_pending_checkout_reminder_template.py` (new, repo root)

## Verification

1. `pnpm --filter @bhavano/bff test -- pending-checkout-reminder notifications.service` — new unit
   tests pass; window math, dedup, and dispatch-channel branches all covered.
2. Manual, no date-faking needed since `sendReminders` takes `now` as a parameter: a short
   one-off script constructing the job directly and calling `job.sendReminders(new Date(testListing
   .createdAt.getTime() + 3.5*60*60*1000))` for one real `pending_checkout` test listing. Confirm a
   `ListingNotificationLog` row is created once, a second identical call sends nothing (dedup), and
   the email's button actually opens the right listing's checkout modal on `/my-listings`.
3. Run `python whatsapp_create_pending_checkout_reminder_template.py` (preview only) to confirm
   character limits and the rendered dynamic-button URL before ever submitting to Meta.
4. Full `pnpm --filter bff test` — same pre-existing 2 unrelated failures only, no new ones.
5. Deploy and confirm in the admin Notification Log page (`/notification-log`) that a
   `pending_checkout_reminder` row shows the correct owner as recipient (no admin-code change
   needed, but worth confirming against this specific new kind once real data exists).

## Status

Implemented (job, services, templates, tests all in — see commits `9d0185f5`/`b3d6ca20`).

**Update (2026-10-11):** the WhatsApp `_v1` submission came back classified MARKETING instead of
the declared UTILITY — despite having no benefit/comparison language, the body's call-to-action
("finish paying and publish it") and the button ("Complete payment") both explicitly framed the
message around completing a payment, which reads as commercial intent to Meta's classifier
regardless of it being a payment the owner themselves already started. Same lesson as
`listing_posted_reminder_v1`'s own reclassification (see
`owner-win-back-notifications-and-mobile-email-capture.md`'s matching update), just triggered by
payment-completion language instead of benefit language. Rewrote as `_v2` — plain status
statement ("ad is saved, not live"), neutral button ("View my ad"), no payment-completion
language in either — in `apps/bff/notification-templates/whatsapp/pending-checkout-reminder/` and
bumped `TEMPLATE_NAME` in `whatsapp_create_pending_checkout_reminder_template.py` to match. The
email variant keeps its direct "Complete payment" wording, since email isn't subject to Meta's
classifier.

**Update (2026-10-11, same day): `_v2` was *also* classified MARKETING.** Header/body/button were
already a plain status statement with no payment-completion language, so the only copy left in
common with every other template that's hit this reclassification — `listing_posted_reminder_v1`,
and now this one twice — is the one piece v2 never touched: the shared footer, "Bhavano.com — Buy.
Sell. Connect. Anywhere in India." Three imperative verbs in a row reads close to the shape of ad
copy to Meta's classifier regardless of how neutral the rest of the message is, and every WhatsApp
template in this app carries some variant of it. Rather than word a slogan-less substitute that
might still read as promotional, `_v3` drops the FOOTER component entirely — a utility template
has no obligation to carry a tagline. `footer.txt` removed from the template folder (no longer
read by the script); `TEMPLATE_NAME` bumped to `pending_checkout_reminder_v3`.

**Update (2026-10-11): `pending_checkout_reminder_v3` approved as UTILITY by Meta.** This
approval alone does not configure the MSG91 delivery path; the template must also be available
through the MSG91 account and its own name/namespace must be set in production. Worth noting the
footer theory above isn't fully confirmed: the other templates sharing
that exact footer (`listing_posted_v2`, `listing_posted_reminder_v2`,
`listing_posted_reminder_featured_v2`, `daily_activity_digest_v1`) were all approved as UTILITY
*with* it still in place, so the footer alone isn't a sufficient explanation — something about
this specific template's combination of copy and/or submission order may also have mattered. Not
investigated further since `_v3` is approved and working; flagging only in case a future template
hits the same reclassification and this theory needs revisiting.

**Update (2026-10-11): fixed a real "missed cycle" gap in the job's own window.** The original
window (`createdAt` in `[now-4h, now-3h)`, a closed band) gave each listing exactly one eligible
hourly run ever — miss that one run (container mid-deploy, a DB hiccup, anything) and every later
run's window has already moved past it, so it silently never got reminded at all, forever. Changed
to open-ended (`createdAt <= now - 3h`, no upper bound) — `WINDOW_START_HOURS`/`WINDOW_END_HOURS`
replaced by a single `MIN_AGE_HOURS = 3`. The existing dedup check (`notificationLogs: { none: {
kind: 'pending_checkout_reminder' } }`) is what actually prevents a double-send, so the window
didn't need an upper bound to do that job too — this makes the job self-healing: any still-pending,
never-notified listing is caught on the very next hourly run no matter how long it's been stuck,
instead of only in its one original 1-hour window. Tests updated to assert the open-ended shape
and that a listing well past the old 3-4h band (5h old) is still queried for.

**Production follow-up (2026-10-12):** the original direct-Meta reminder path was reaching Meta with
`https://graph.facebook.com//<phone-number-id>/messages` because Docker Compose supplies an
unset `WHATSAPP_API_VERSION` as an empty string, while the provider only defaulted when it was
`undefined`. The provider now treats blank/whitespace values as unset and uses `v23.0`. A
read-only check against Meta using the production token and configured sender ID still returned
OAuth error 200 (`API access blocked`) for both the sender lookup and token-permissions endpoint.
The app now routes this reminder through MSG91 like welcome and ad-posted notifications. Meta
template approval does not automatically provide an MSG91 template namespace; the MSG91 dashboard
template configuration is still required before this route can send.

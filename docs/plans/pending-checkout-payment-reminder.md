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
- `NotificationsService.dispatchPushPreferEmailPreferWhatsapp` (`notifications.service.ts:734-760`,
  used by `notifyListingPostedReminder`/`notifyDailyActivityDigest`) is reused as-is for the
  push→email→WhatsApp preference order.
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
posted-reminder uses — this one needs the specific listing's modal to auto-open), calls
`dispatchPushPreferEmailPreferWhatsapp` with the push thunk below and the WhatsApp args (named
params `{name, title}`, `buttonUrlSuffix: listingId` — this template needs a **dynamic** URL button,
unlike `listing-posted-reminder`'s static one, since it must land on the right listing).

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
by default, `--submit` to actually submit. New env var
`WHATSAPP_PENDING_CHECKOUT_REMINDER_TEMPLATE`, read the same gated way the other two already are
(unset = WhatsApp leg skipped, no error; email/push work from day one).

**Tests**:
- `pending-checkout-reminder.job.spec.ts`, mirroring `listing-posted-reminder.job.spec.ts` — fixed
  `now`, assert the 3-4h window and the `publishState`/dedup query, assert a listing paid in the
  interim (now `live`) is excluded, assert a listing created 2h or 5h ago is excluded (window
  boundaries).
- A block in `notifications.service.spec.ts` near the existing `notifyListingPostedReminder` tests:
  email-sent case, WhatsApp-sent case (template env var set), WhatsApp-skipped case (unset), push-
  present case (no email/WhatsApp attempted).

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
read by the script); `TEMPLATE_NAME` bumped to `pending_checkout_reminder_v3`. Not yet resubmitted
to Meta. If `_v3` is also reclassified, the other templates sharing this exact footer
(`listing-posted`, `listing-posted-reminder{,-featured}`, `welcome`, `daily-activity-digest`,
`claim-listing`) are worth auditing too, not just this one in isolation.

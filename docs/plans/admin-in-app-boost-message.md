# In-app "Bhavano Admin" Boost message (manual + automatic)

## Status: built 2026-09-28 — the automatic nudge ships **switched off**

Follows [`boost-offer-conversion-2026-09.md`](boost-offer-conversion-2026-09.md): almost every boost
is bought within ten minutes of posting and nobody comes back later, so the offer needs a second
moment, and the existing admin "Send boost promo" only reaches people by email/WhatsApp. This adds the
same pitch as a message inside the app: free, shows in the owner's Messages inbox, and pushes to the
mobile app for owners who have it.

Related: [`instant-alerts-paid-message-notifications.md`](instant-alerts-paid-message-notifications.md),
[`boost-instant-alerts-preview-selector.md`](boost-instant-alerts-preview-selector.md),
[`unread-message-badge-and-mobile-push.md`](unread-message-badge-and-mobile-push.md).

## What it does

- **New conversation type `announcement`** (`ConversationType`, migration
  `20260928180000_conversation_type_announcement`). One thread per listing per sending admin, exactly
  like the existing `moderation` thread, but a separate type so a sales message can never land in a
  takedown conversation. Buyer-inquiry counts and the admin "Messages" table only ever look at
  `inquiry`, so they are unaffected.
- **The owner sees "Bhavano Admin", never the admin's name.** `STAFF_SENDER_LABEL` is used for the inbox
  list, the thread header and the push title/sender. A message carries only `senderId`, never a name,
  and the tests pin that the sending admin's display name does not appear in the inbox response. The web
  and mobile inbox lists show the same "From Bhavano" tag they show for moderation threads.
- **Admin Listings page:** a new **"Send boost message (in-app)"** button next to "Send boost promo"
  (select one or more rows; one row = "send from a listing"). The **Boost promo** column now counts
  `N× in-app` alongside email and WhatsApp, with the last-sent date — that is the tracking. Each send
  writes a `ListingNotificationLog` row (`kind: boost_promo`, `channel: in_app`,
  `providerMessageId` = the message id), the same log the email/WhatsApp promo uses.
- **Same rules as the email promo** (it is the same method, `AdminService.sendBoostPromotion` with
  `channel: 'in_app'`): live ads only, not already boosted *and* on Instant Alerts, no bulk-import
  placeholder owner, prices from the live settings with the active promo quoted. **Its own 14-day
  cooldown**, separate from the email/WhatsApp one, so an email yesterday does not block the in-app
  message. Endpoint: `POST /admin/listings/notify-boost-message`.
- **Wording** (`admin/boost-message.ts`, pure and tested; updated 2026-09-28 when Instant Alerts became part of every boost, see [`boost-30-day-and-included-alerts.md`](boost-30-day-and-included-alerts.md) — the message now describes alerts as included, quotes the 30-day price, and an already-boosted ad is skipped): the whole pitch is the first sentence,
  because that sentence is the push preview. "Ads without a boost get very few views in their first
  week" (measured: 1.6 average vs 18.9 boosted, small sample — re-check it), "above unboosted
  listings, with a Featured label" (not "top of results": the featured tier is capped at 8 slots).
- **Why in-app in addition to email/WhatsApp:** the WhatsApp promo template can only be sent while a
  discount has an end date; after the 50% code ends (30 Sep) it cannot be sent at all. The in-app
  message has no such dependency. Reach is limited: ad-acquired sellers post from mobile web and few
  come back, so keep WhatsApp for one-off reminders to people who abandoned a checkout.

## Automatic nudge (`admin/boost-nudge.job.ts`) — off by default

Hourly at :15, 10:00–19:59 IST, **only if `BOOST_NUDGE_AUTO_ENABLED=true`**. Finds live, approved,
unboosted ads 24–72 hours old with **≤ 2 views**, owned by a non-admin, never nudged in-app, and whose
owner has had no in-app boost message on any ad in 14 days; sends **at most one per owner and 25 per
run** through `sendBoostPromotion`, so every rule above applies. Sender is
`BOOST_NUDGE_SENDER_USER_ID` or the oldest admin user (never shown to owners).

To turn it on: set `BOOST_NUDGE_AUTO_ENABLED=true` in the BFF environment and restart. Suggested
order: send a handful by hand from the Listings page first, read them in the app, then enable.

## Not done / caveats

- **Replies:** an owner can reply in the thread; the reply goes to the sending admin's own inbox (same
  as moderation threads). Nobody is watching that inbox for these, so a reply is currently unanswered.
  Worth deciding: make announcement threads read-only, or route replies to support.
- **Unread badge:** these messages count toward the owner's unread total (like any message) and clear
  when the thread is opened.
- **Mobile app:** the inbox tag needs the next mobile build/OTA. The "Bhavano Admin" label itself is
  served by the BFF, so it is correct in every existing app version.
- The 50% discount code expires 2026-09-30; the message quotes the price in force when it is sent.

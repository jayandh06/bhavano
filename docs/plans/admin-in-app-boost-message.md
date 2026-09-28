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

## The message as a card, and counting boosts it sells (added 2026-09-28)

- **Card, not a wall of text.** `Message.card` (JSON, migration `20260928210000_message_card`) holds
  a `BoostOfferMessageCardDto` built by `buildBoostMessageCard`. It has:
  - the ad's cover photo (the small `preview` variant, the same one the push uses), shown on the
    left of the title;
  - the title in bold, and the "Area, City" location with a pin icon;
  - the headline ("Boost it for 7 days for ₹99"), plus a highlighted offer line while a promo is
    live;
  - the same paragraphs as before;
  - a green **Boost my ad · ₹X** button instead of the raw link.

  Web (`BoostOfferMessageCard.tsx`) and mobile (`BoostOfferMessageCard.tsx`) draw the card whenever
  `message.card.kind === "boost_offer"`.
- **`body` is unchanged plain text,** built from the same sentences (`buildBoostMessageBody`). Older
  app builds, the push preview, the inbox's last-message line and the admin message views all keep
  using it, so nothing breaks for clients that don't know the card.
- **The mobile button follows `BoostButton`.** iOS opens the website's boost dialog, because of
  Apple Guideline 3.1.1. Android opens `BoostBundleCard` in a modal, with the promo auto-applied and
  `ignorePlacementSetting`, so the "show selector on preview" setting doesn't hide it. The card
  needs the next mobile build; until then the app shows the text version.
- **Counting boosts from the message.** New column `Payment.source` (migration
  `20260928210100_payment_source`); the allowed values are in `@bhavano/types/purchaseSource`
  (`admin_boost_message`). How it gets there:
  - Both the card button and the text link go to
    `/my-listings?openBoost=<id>&src=admin_boost_message` (`boostMessagePath`).
  - Web: `AutoOpenPurchaseModal` reads `src`, and it travels through `BoostProvider`,
    `BoostBundlePicker`, `startBoostCheckout` and `createBoostOrderAction` to
    `POST /payments/orders { source }`.
  - Android: the card passes `source` to `BoostBundleCard` itself.
  - The BFF only accepts listed values (`@IsIn(PURCHASE_SOURCES)`) and stores the value on the
    payment, including a free Agent Pro credit boost.
  - Web GTM `begin_checkout_boost` and `boost_purchase` events carry `source` too.
- **Where to see it:** the admin Payments page (`/subscriptions`) has a **Source** column and a
  **Source** filter. Set Source = "Admin boost message" and Status = Paid to list every boost the
  message sold.
- **Limitation:** this counts boosts bought *through the message's button or link*. A seller who
  reads the message and later boosts from My Listings isn't tagged. Comparing boost dates against
  the in-app `ListingNotificationLog` rows would catch those, if a looser "after the message"
  figure is ever wanted.

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

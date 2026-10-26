# Featured-ad expiry reminders (3 days and 1 day before) with a renew link

Status: built 2026-10-26. Related: [`admin-in-app-boost-message.md`](admin-in-app-boost-message.md) (the message type reused here),
[`boost-30-day-and-included-alerts.md`](boost-30-day-and-included-alerts.md), [`listing-expiry-renew-past-listings.md`](listing-expiry-renew-past-listings.md)
(that is about the *listing's* 30 days, not the Featured period) and [`hold-user-on-featured-offer.md`](hold-user-on-featured-offer.md).

## What was missing (checked 2026-10-26)
- Nothing told a seller their Featured period was ending. Sellers got a message when Feature started, a daily activity digest while it ran,
  a 30-day "listing is old" reminder, and a referral-credit expiry reminder. The automatic Boost nudge only targets ads that were **never**
  featured, so a seller whose Feature ended heard nothing and the ad quietly dropped back into normal order.
- Two product gaps made a reminder useless on its own:
  1. **My listings hid the Feature button while an ad was Featured** (web and app), so there was nothing to tap to renew.
  2. **Buying Feature again replaced the end date** (`boostedUntil = now + days`) instead of extending it, so renewing with 3 days left
     would have thrown the 3 days away.

## What it does
- **A daily job** (`FeaturedExpiryReminderJob`, 10:00 IST) finds live, approved ads whose `boostedUntil` falls in the next 3 days or the next day.
  - **3-day reminder:** `boostedUntil` between 2 and 3 days away. Skipped when the Feature period was 3 days or shorter (it would fire on day one).
  - **1-day reminder:** `boostedUntil` within the next 24 hours.
  - At most one reminder of each kind per Feature period: the log (`ListingNotificationLog`, kinds `featured_expiry_3d` and `featured_expiry_1d`,
    channel `in_app`) is checked against the start of the **latest** Feature period, so a seller who renews gets reminders again next time.
  - Owner must be a real user (not the bulk-import placeholder). Per-run cap of 300. Switch off with `FEATURED_EXPIRY_REMINDER_ENABLED=false`
    (on by default: this is about something the seller already paid for, not a sales pitch like the quiet-ad nudge).
- **The message** is the existing in-app "Bhavano Admin" announcement (thread per listing, mobile push, unread badge), drawn as the same card
  (`kind: "boost_offer"`) so every current web and app build renders it; older builds show the plain text. Wording lives in
  `admin/boost-message.ts` (`buildExpiryReminderBody` / `buildExpiryReminderCard`):
  - Opening (also the push preview): `Your Featured ad "<title>" ends in 3 days (on 29 Oct). Renew to keep it above other listings.`
    (`ends tomorrow (...)` for the 1-day one).
  - Says what changes (the ad stays live and free; it goes back to normal order and loses the Featured label) and quotes the price.
  - The days left are **added** to a renewal: "Renewing now adds 7 days after the current ones end."
  - Button: **Renew Feature · ₹X**, going to `/my-listings?openBoost=<id>&src=featured_expiry_message`.
- **Renew from anywhere.** My listings (web and app) now shows **Renew Feature** on an ad that is Featured with 3 days or less left
  (`featuredEndsSoon`, shared), opening the same Feature dialog. Outside that window a Featured ad still shows no button.
- **Extend, not replace.** `PaymentsService.activateListingBoost` now starts the new period at the current end when the ad is still featured:
  `boostedUntil = max(now, current end) + days`.
- **Counted.** New purchase source `featured_expiry_message` ("Featured expiry reminder"), so Payments shows what the reminders sell.

## Decisions and caveats
- Quoted price is the plain 7-day (default) price from live settings. An active promo code is not quoted (checkout applies it), so the message
  can only under-promise.
- No email/WhatsApp copy: in-app plus push reaches the people who use the app; the WhatsApp templates need Meta approval and a new template.
  Revisit if open rates on the in-app message are low (the admin Messages screen shows who read what).
- Sending hour is 10:00 IST so a push does not land at night.
- The app's Renew button and the card need a store build or OTA; the in-app message and push work today for every installed build.

## How to check it worked
Admin → Payments, filter by source "Featured expiry reminder"; Admin → Messages (type Announcement) for the sent messages and read state;
Listings → notification history shows `featured_expiry_3d` / `featured_expiry_1d` rows.

## Follow-ups after posting (added 2026-10-26)
Asked for in the same session: an automatic in-app reminder to feature an ad **4 hours, 1 day and 3 days after it goes live**, reusing the
existing Boost message.
- `BoostFollowupJob` (hourly, 09:05–20:05 IST) sends the existing in-app Boost message (`AdminService.sendBoostPromotion`, channel `in_app`:
  same card, push, price quoting and skip rules: live ads only, not already Featured, no bulk-import owner) for ads of these ages:
  4 hours to 20 hours, 24 to 60 hours, 72 to 120 hours. A stage that comes due overnight goes out the next morning.
- **Once per stage per ad** (marker rows `boost_followup_4h|1d|3d` in `ListingNotificationLog`; `channel: skipped` when the ad turned out not sendable,
  such as already Featured, so it is not retried hourly; a failed send is retried next hour).
- **Past the 14-day cooldown** (`skipCooldown`), because the stages are meant to follow each other, with their own **12-hour minimum gap** per ad.
- One message per owner per run, 40 per run. **On unless `BOOST_FOLLOWUP_ENABLED=false`.**
- It replaces the older quiet-ad nudge (`BOOST_NUDGE_AUTO_ENABLED`, off by default): keep that off or owners get both.
- First run after release: ads already 4 to 120 hours old fall into a stage, so up to 40 owners per hour get a message until they are caught up
  (then the steady state is only newly posted ads).
- Not changed: the manual "Send boost message" button and its 14-day cooldown.

## Controlled from admin (added 2026-10-26)
**Admin → Settings → Featured reminders** (`/settings/reminders`) sets both reminders. Stored in `ReminderSetting` (singleton row `default`,
migration `20261026140000_reminder_settings`); the jobs read it at the start of every run, so a change applies to the next run with no deploy.
- **Nudge a new ad to go Featured:** on/off and the hours after the ad goes live (default `4, 24, 72`; 1 to 5 values, each 1 to 720). A stage runs until
  the next one begins and at most 48 hours late. Whole days keep their original marker names (`boost_followup_1d`), other values use `boost_followup_<h>h`.
- **Warn before a Featured period ends:** on/off and the days before the end (default `3, 1`; 1 to 4 values, each 1 to 14). A Feature period no longer
  than a stage's days skips that stage. Markers are `featured_expiry_<d>d`.
- The environment switches (`BOOST_FOLLOWUP_ENABLED=false`, `FEATURED_EXPIRY_REMINDER_ENABLED=false`) still work as a hard off. If the settings table cannot be
  read the defaults apply. Not on the page (fixed in code): the 09:05 to 20:05 IST window and 40 a run for the nudge, 10:00 IST for the expiry reminder,
  the 12-hour minimum gap between messages for one ad.


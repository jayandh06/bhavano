# Owner alerts: channel preference and escalation (2026-10-27)

Status: first version built 2026-10-27 (preference, dispatcher, message / interest / reveal alerts, web and app UI). Escalation, quiet hours and the weekly summary are not built; WhatsApp and SMS stay dormant until their templates are approved and named in env. Related: [`notification-delivery-tracking-and-engagement-alerts.md`](notification-delivery-tracking-and-engagement-alerts.md), [`instant-alerts-paid-message-notifications.md`](instant-alerts-paid-message-notifications.md),
[`contact-owner-message-notifications.md`](contact-owner-message-notifications.md), [`whatsapp-conversational-posting.md`](whatsapp-conversational-posting.md).

## The idea
Let an owner say how to reach them (app notification, WhatsApp, SMS, email, in an order), and alert them in that order when a seeker contacts them.

## What exists today (code and production, 2026-10-27)
- **Hard-coded channels.** Events call `dispatchEmailPreferWhatsapp`: email first, WhatsApp only if a template is passed. New message, "I'm interested" and likes pass **no WhatsApp template** (`notifyNewMessage`, `notifyListingInterest`, `notifyListingLiked`),
  so an owner without an email receives nothing on those events. Push is separate and always sent (to those with the app). Email and WhatsApp for these events are a Featured (Instant Alerts) benefit.
- **Who can be reached (613 active owners who posted themselves):** 212 have an email (35%), **401 are phone-only (65%)**, **25 have a push token (4%)**. So for these events the effective reach today is email for about a third of Featured owners and push for 4%.
  Contact reveals and plain views notify no one; the daily digest covers Featured ads only.
- Delivery tracking exists for WhatsApp (MSG91 status webhook) and push, which is what makes "did they see it" possible.

## Verdict
A preference is worth having but is **second-order**. First fix reach: build the WhatsApp templates for the events that have none, because WhatsApp is the only channel that reaches the phone-only majority. Then add the preference and, more valuable than a fixed order, **escalation**.

## Design
1. **WhatsApp templates (needs Meta/MSG91 approval, a human step):** new message, interested buyer, number revealed, weekly activity summary. WhatsApp utility templates are cheap; push and email are free; SMS needs DLT-registered templates.
2. **`NotificationPreference` per user:** ordered list of channels (default derived from what the user has: push if a token exists, else WhatsApp, then email, then SMS), plus quiet hours (no alerts 22:00 to 07:00 except a morning digest).
3. **Dispatcher:** for each event send on the first usable channel (push only with a token; email only with an address; WhatsApp only with a phone and opt-in and an approved template; SMS only with a DLT template). **Escalate** a message enquiry to the next channel if it is not opened within about 30 minutes.
4. **Ask once, lightly:** on the post-success screen ("Where should we alert you when someone contacts you?" WhatsApp / App / Email / SMS, one primary, others follow the default order), and editable in Profile. Dragging an order is too heavy on a phone. The answer is also the WhatsApp opt-in record.
5. **Free ads get alerts too** (a plain "someone messaged you" at least on the preferred channel; keep rich detail, instant speed and the weekly report as Featured benefits).

## Effort and order
Templates (approval takes days) in parallel with the model and dispatcher (about a week), then the question and Profile screen, then escalation. Measure: share of enquiries answered within an hour, owner repeat rate, cost per alert.

## As built (2026-10-27)
- **Data:** `OwnerAlertPreference` (`userId`, ordered `channels`, always all four; no row = not chosen yet, default order push, WhatsApp, SMS, email). Shared helpers in `@bhavano/types/ownerAlerts`.
- **API:** `GET` / `PUT /users/me/alert-preferences`. `available` says which channels can reach the account (device, phone, email); `confirmed` is false until the owner chooses.
- **Dispatcher:** `OwnerAlertsService.alert(ownerId, {kind, ...})` walks the owner's order and stops at the first channel that delivers. A channel that cannot reach the account, or whose template env is unset, is skipped. Never throws.
  "Push" counts as delivered when the owner has a device: message and interest pushes are sent by their own code paths (always, unchanged payloads); only the reveal sends its own push (`PushService.notifyContactRevealed`, anonymous).
- **Events:** new message (first unread message of a thread, as before), interested view (still Featured-only, as before), and **number revealed (new, all owners, unclaimed bulk-import ads excluded)**.
  **Free versus Featured:** push and email are free for every ad; WhatsApp and SMS cost per message and are used for **Featured ads only** (every boost includes Instant Alerts, so Featured = `instantAlertsUntil` active). The dispatcher skips them on a free ad and falls to the free channels. Message and reveal alerts therefore now reach every owner by push or email, where before only Instant Alerts owners were told (a phone-only free owner still gets nothing until they have the app or an email). Rich detail, the daily digest and a weekly report remain Featured benefits.
- **Logging:** `ListingNotificationLog` rows with `kind` `new_message` / `listing_interest` / `contact_revealed` and the channel that delivered (push rows for message and interest are written by their existing callers).
- **Required on the Preview step (replaces the post-success question):** a card just above Post on web and in the app. Pre-filled with the best free channel (app if installed, else email), WhatsApp / SMS tagged *Featured* and unlocked when a Featured plan is picked on that page. Saved when the ad is posted. It blocks posting only when nothing can reach the owner for this ad (typically phone-only, no app, free): they then tick "I'll check Messages myself", add a verified email, or go Featured. A hard block on every phone-only owner was rejected as too costly for the posting funnel. Not shown in assisted mode (the seller is someone else). A Profile / Account card edits the same choice.
- **Install-the-app prompt:** while the owner has no app installed (web) or notifications off (app), a prominent banner on the Preview card and the Profile card says to install the free app to get instant alerts and reply to seekers right away (Android only; no iOS app yet).
- **Templates to approve** (wording and slot order in `apps/bff/notification-templates/whatsapp/owner-alert-*`): `owner_alert_message`, `owner_alert_interest`, `owner_alert_reveal`. Env: `MSG91_WHATSAPP_OWNER_{MESSAGE|INTEREST|REVEAL}_TEMPLATE_NAME` (+ optional `_NAMESPACE`).
  SMS (DLT Flow, `VAR1` = name, `VAR2` = ad title; reveal has `VAR1` = ad title only): `MSG91_OWNER_{MESSAGE|INTEREST|REVEAL}_SMS_TEMPLATE_ID`. Suggested SMS text: `{#var#} messaged you about {#var#} on Bhavano. Reply: bhavano.com/messages` (register the link per DLT rules).
  Verify each against the template's MSG91 "Code" snippet before enabling; the shape in `Msg91Provider.sendOwnerAlert` follows the other templates, not this one's snippet.
- **Known limits:** if an owner ranks WhatsApp above the app, the app push still goes (it is sent by the message / interest paths before the dispatcher runs) and they also get WhatsApp. Push is free, so accepted for now. The email for a reveal is new (`email/contact-revealed`).
- **Not built (phase 2):** escalation when unread after about 30 minutes, quiet hours, the weekly activity summary for all ads, a way to switch a channel off entirely.
- **Add an email without leaving the card (2026-10-28):** a phone-only owner has no free channel unless they have the app, so the Preview card and the Profile / Account card now show an inline "Add your email to get free alerts" step (email, then the 6-digit code, the same verified flow as the profile's email link). If the address already belongs to another account it points to the Profile page, where the merge approval lives. Independent of the email-login switch ([email-login-switch.md](email-login-switch.md)): that setting only governs signing in with Google / Apple, never collecting an email.
- **Coverage note (2026-10-28):** only owners who post through the new Preview step (web now, app after the next build) or open the Profile / Account card have a saved choice, so most existing owners show "not chosen yet" in Admin. That is not "no alerts": the default order (app, then WhatsApp / SMS for Featured ads, then email) applies until they choose.

## Paid channels for ads that are not Featured: admin switch (2026-10-29)
**Why:** a free ad whose owner has only a phone (no app, no email) could not be alerted at all: on 29 Oct a buyer viewed and revealed the number on a free Bengaluru ad and nothing reached the owner, because WhatsApp / SMS were Featured-only and push / email had nobody to reach. A reveal is the strongest buying signal an owner ever gets, and the best moment to offer Featured.
**What:** `OwnerAlertSetting` (id `default`; `whatsappForFreeAds`, `smsForFreeAds`, both default off), edited at **Admin -> Settings -> Owner alerts**. When on, the dispatcher uses that paid channel for any ad (not only while `instantAlertsUntil` is active) for the two events routed through it for every owner: **a message** and **a number reveal**. "Viewed your ad" (interest) alerts stay Featured-only: they are frequent and the login dialog will make them more so.
- Read failure counts as off (a settings fault must never start paid sends). The owner's own ranking still applies; unreachable channels are still skipped.
- `GET /users/me/alert-preferences` now returns `freeAdChannels`, and the Preview card, Profile and Account cards stop calling an open channel a Featured benefit (`ownerAlertPricingNote`, `paidChannelOpen`, `effectiveOwnerAlertChannel(..., freeAds)` in `@bhavano/types/ownerAlerts`). An older app that does not send the field is unaffected.
- Cost: a WhatsApp utility message is roughly 30 to 50 paise; SMS costs more. Watch `ListingNotificationLog` rows with channel `whatsapp` and kinds `new_message` / `contact_revealed` for volume.
- **Live setting on 2026-10-29:** WhatsApp on for all ads, SMS off.

## Staff never trigger owner alerts (2026-10-29)
A listing-details view, a contact reveal or a favourite **by an admin account** (checking, testing, moderating) sends the owner nothing on any channel: no push, email, WhatsApp or SMS. Enforced in `ListingsService.notifyOwnerOfInterest` and `notifyOwnerOfLike` (the acting user's `role === 'admin'` returns before any send) and in `ContactRevealService.revealContact` (the alert is skipped when the revealer is an admin). The interest row is still recorded, so it can still appear in the owner's "interested" list; the one-off backfill scripts (24 h and 3 days, 2026-10-29) excluded admin accounts the same way.

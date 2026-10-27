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
  Message alerts now reach **every** owner on their chosen channel, not only those with Instant Alerts. This widens a former Featured benefit on purpose (a phone-only owner used to get nothing); set `OWNER_ALERTS_FEATURED_ONLY=true` to restore the old rule. Rich detail, the daily digest and a weekly report remain Featured benefits.
- **Logging:** `ListingNotificationLog` rows with `kind` `new_message` / `listing_interest` / `contact_revealed` and the channel that delivered (push rows for message and interest are written by their existing callers).
- **Ask once:** a compact question on the post-success screen (web and app) and a card on Profile / Account. One primary channel is chosen; the rest keep their order as fallbacks.
- **Templates to approve** (wording and slot order in `apps/bff/notification-templates/whatsapp/owner-alert-*`): `owner_alert_message`, `owner_alert_interest`, `owner_alert_reveal`. Env: `MSG91_WHATSAPP_OWNER_{MESSAGE|INTEREST|REVEAL}_TEMPLATE_NAME` (+ optional `_NAMESPACE`).
  SMS (DLT Flow, `VAR1` = name, `VAR2` = ad title; reveal has `VAR1` = ad title only): `MSG91_OWNER_{MESSAGE|INTEREST|REVEAL}_SMS_TEMPLATE_ID`. Suggested SMS text: `{#var#} messaged you about {#var#} on Bhavano. Reply: bhavano.com/messages` (register the link per DLT rules).
  Verify each against the template's MSG91 "Code" snippet before enabling; the shape in `Msg91Provider.sendOwnerAlert` follows the other templates, not this one's snippet.
- **Known limits:** if an owner ranks WhatsApp above the app, the app push still goes (it is sent by the message / interest paths before the dispatcher runs) and they also get WhatsApp. Push is free, so accepted for now. The email for a reveal is new (`email/contact-revealed`).
- **Not built (phase 2):** escalation when unread after about 30 minutes, quiet hours, the weekly activity summary for all ads, a way to switch a channel off entirely.

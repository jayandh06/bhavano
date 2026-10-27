# Owner alerts: channel preference and escalation (2026-10-27)

Status: plan, nothing built. Related: [`notification-delivery-tracking-and-engagement-alerts.md`](notification-delivery-tracking-and-engagement-alerts.md), [`instant-alerts-paid-message-notifications.md`](instant-alerts-paid-message-notifications.md),
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

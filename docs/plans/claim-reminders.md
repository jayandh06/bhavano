# Claim reminders: the second and third claim message

Requested 2026-10-24. Bulk-imported businesses (PG, coworking…) get a listing created for them and a
"claim your listing" message (WhatsApp and email, `OutreachService.sendClaimVerification`). Until now
a repeat could only be sent by selecting contacts by hand, a page at a time, with no spacing.

## What it does
- **Admin → Outreach → Contacts → "Claim reminders"** panel, using the page's filters (city, area,
  category, status, scrape run).
- Pick the message number (2nd = sent once before, 3rd = sent twice, up to the 4th), the minimum days
  since the last message (default 7) and a cap per run (default 100, max 300).
- **Preview who gets it** shows how many match across all pages and the names of the first few, and
  sends nothing. **Send to N** asks to confirm, then sends in batches of 10 with a progress count and
  a summary of how many went and why the rest did not.
- **Same message.** Every reminder reuses the one approved claim WhatsApp template and the claim email;
  nothing new needs approving.

## Who is picked (`OutreachService.claimReminderAudience`, `GET /admin/outreach/contacts/claim-reminder-audience`)
Contact has a linked listing that is still unclaimed; `contactedCount` equals message number minus 1;
not opted out; has a city and an area (the template names both); has a phone or an email; never
messaged, or last messaged at least N days ago. Longest-waiting first.

## What still decides at send time
Each contact goes through the existing `send-claim-verification`, which re-checks opt-out, suppression
list, missing details and the marketing-enabled switch (`MSG91_MARKETING_ENABLED`). `contactedCount`
goes up only when a message actually went on some channel, which is what makes "sent once" mean once.

## Limits
- The cap is per click: with more matches than the cap, click again after the spacing allows (the
  next click picks the ones not yet reminded at that number).
- The sender is the admin's browser session driving the batches: closing the tab mid-run stops it
  after the current batch, and a rerun only picks contacts not yet at the next count.
- WhatsApp delivery and claim attribution are unchanged (`?via=whatsapp` / `?via=email`).

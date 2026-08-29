# Telling someone their ad went live

## The gap

`ListingsService.create` notifies *other* people — `savedSearchesService.notifyMatchingBuyers`
alerts buyers whose saved search matches. It sends nothing to the person who just posted.

Everything else that happens to a listing is announced:

| Trigger | Channels today |
|---|---|
| First login (welcome) | email + SMS + WhatsApp |
| Listing flagged by an admin | email + SMS |
| Listing approved by an admin | email + SMS |
| Someone favourites your ad | email + SMS *(boosted only)* |
| Saved-search match | email + SMS |
| Listing about to expire | email, else SMS |
| **Ad posted** | **nothing** |

## Why it is worth doing now

The ad campaigns were just re-pointed at people who want to *post*
(`ads_retarget_owners.py`). Finishing a post is the highest-intent moment those campaigns can
produce, and right now it ends in silence — no receipt, no link, no expiry date, nothing to
return to.

It is also the one message with obvious utility rather than noise: it carries the live URL of the
thing they just made.

## What it says

- The ad is live (listings default to `moderationState: approved`, so this is true immediately —
  confirm that still holds before writing the copy).
- Its title, so the message is identifiable among several.
- **A link to the live ad.** The whole point.
- The expiry date, and a link to `/my-listings` to manage or renew.

## Channel: `dispatchEmailPreferSms`, not `dispatch`

Two dispatch helpers already exist and they behave differently:

- `dispatch` sends to email **and** SMS whenever the user has both — the same message twice.
- `dispatchEmailPreferSms` sends email if present, else SMS. Only the expiry reminder uses it.

Use the second. Most flagged/approved/liked notifications double-send today, which is tolerable
for rare admin events and wrong for something that fires on every post.

WhatsApp is **not** in the first cut — see below.

---

## Four things that will bite

### 1. The listing URL is built in the wrong app

`buildListingPath` lives in `apps/web/src/lib/listingPath.ts`. The BFF has no way to build a
listing URL, and it needs one.

Do **not** copy the format into the BFF. The URL grammar changed twice this week
(`all-cities-default-and-national-routes.md`), and a second definition would have silently drifted
both times. Move `buildListingPath` — and the trivial `transactionGroupFor` it depends on — into
`packages/types`, which both apps already consume, and re-export from the web module so no web
import changes.

Listing URLs specifically were left untouched by the recent refactor, so this is a move, not a
change of shape.

### 2. Indian SMS cannot carry arbitrary text

`sendTransactionalSms` posts the whole message as `VAR1` into
`MSG91_TRANSACTIONAL_TEMPLATE_ID` — a DLT-registered template. Indian regulation requires the
delivered text to match the approved template, so whether a free-form body actually arrives
depends entirely on how that template was registered.

`msg91-sms-otp-activation.md` records how much time the OTP template cost. **Send one real test
SMS through this path before assuming it works** — the existing callers may have been failing
silently all along, and nothing in the logs would have said so beyond a warning.

If the template will not carry free text, the SMS variant needs its own registered template with
proper variables, which is days of approval, not minutes.

### 3. `PUBLIC_SITE_URL` is not set in production

`notifyListingExpiryReminder` already builds links from it and falls back to `https://bhavano.com`
— the apex, which now 301s to `www`. Links work, but they take an extra hop and contradict the
canonical host that `visitor-location-default-city.md` work just standardised on.

Set `PUBLIC_SITE_URL=https://www.bhavano.com` on the app instance. One line, fixes every existing
notification link as well as this one.

### 4. It must never affect the post itself

Follow the `notifyMatchingBuyers` precedent exactly: fire-and-forget, `.catch(() => undefined)`.
A slow SMTP handshake or a failing MSG91 call must not add latency to — or fail — the submission
of an ad that has already been written to the database. The user has finished; the notification is
our problem, not theirs.

---

## Work

1. Move `buildListingPath` + `transactionGroupFor` to `packages/types`; re-export from
   `apps/web/src/lib/listingPath.ts`.
2. `NotificationsService.notifyListingPosted(user, listing, url, expiresAt)`, modelled on
   `notifyListingExpiryReminder` — same shape, same `dispatchEmailPreferSms` return so the caller
   can log which channel was used.
3. Call it fire-and-forget from `ListingsService.create`, beside `notifyMatchingBuyers`.
4. Set `PUBLIC_SITE_URL` on prod.
5. Unit test alongside the existing `listings.service.spec.ts` notification tests: fires once on
   create, and a rejected notification still returns the listing.

## Out of scope

- **WhatsApp.** `sendWhatsapp` exists and `notifyWelcome` calls it, but
  `MSG91_WHATSAPP_INTEGRATED_NUMBER` and `MSG91_WHATSAPP_TEMPLATE_NAME` are unset in production,
  so it has never sent anything. It needs a registered WhatsApp Business sender and an approved
  template, and the code carries its own warning that it was written against MSG91's WhatsApp API
  without ever being exercised. Add it once the sender is approved and the method is verified —
  not as part of a change that should ship this week.
- **Notification preferences.** There is no preference column, and routing is presence-based.
  Worth having eventually; not worth blocking a first acknowledgement on.
- **Edit/renew acknowledgements.** Same machinery, different triggers, decide separately.

## Verification

- Post an ad as an email-only user → one email, no SMS.
- Post as a phone-only user → one SMS, no email. **Confirm it actually arrives**, per §2.
- Post as a user with both → exactly one message, on email.
- Click the link in the message → lands on the live ad, not a redirect or a 404.
- Point SMTP at a dead host and post → the ad is still created and returned.

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

## Channel: email, else WhatsApp. No SMS.

```
user has an email  ->  email
otherwise          ->  WhatsApp
```

One message, never two. Neither existing helper does this — `dispatch` sends to email *and* SMS
whenever the user has both, and `dispatchEmailPreferSms` falls back to SMS. This needs a third:
`dispatchEmailPreferWhatsapp`.

**This makes WhatsApp a blocker rather than a follow-up**, and that is the main consequence of
choosing it. `sendWhatsapp` exists but `MSG91_WHATSAPP_INTEGRATED_NUMBER` and
`MSG91_WHATSAPP_TEMPLATE_NAME` are unset in production, so it has never sent a single message —
`notifyWelcome` already calls it and that call has always logged-and-skipped. Until the sender and
template are live, a phone-only poster gets **nothing**. Most posters are phone-only.

Worth stating plainly: with no SMS fallback, a failed WhatsApp send means that user is never told
their ad went live. That is the trade being made. It is recoverable — the ad is still there under
`/my-listings` — but it is a real silence, not a degraded message.

### What WhatsApp needs before this can ship

1. **A registered WhatsApp Business sender number** in MSG91 — its own onboarding, separate from
   the SMS sender that `msg91-sms-otp-activation.md` covers.
2. **An approved template**, categorised as **utility** rather than marketing. A confirmation of
   something the user just did is exactly what the utility category is for, and it avoids the
   opt-in requirements marketing templates carry. Approval is Meta's, not MSG91's, and takes days.
3. **A single body variable.** `sendWhatsapp` sends the whole message as `body_1`, mirroring the
   SMS provider's `VAR1`. A template with several variables will not work without changing the
   provider.
4. **Verification of the endpoint itself.** The method carries its own warning: the URL and
   payload shape were written against MSG91's docs and never exercised, and that API surface has
   changed over time. Send one real message through it before trusting it.
5. **Per-conversation pricing.** WhatsApp Business bills per conversation window, unlike the SMS
   allowance already being paid for. Utility conversations in India are cheap, not free.

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

### 2. Indian SMS cannot carry arbitrary text — no longer blocking, still worth knowing

`sendTransactionalSms` posts the whole message as `VAR1` into
`MSG91_TRANSACTIONAL_TEMPLATE_ID` — a DLT-registered template. Indian regulation requires the
delivered text to match the approved template, so whether a free-form body actually arrives
depends entirely on how that template was registered.

`msg91-sms-otp-activation.md` records how much time the OTP template cost. **Send one real test
SMS through this path before assuming it works** — the existing callers may have been failing
silently all along, and nothing in the logs would have said so beyond a warning.

Not a blocker for this feature any more, since the acknowledgement goes over WhatsApp. But the
flagged, approved and saved-search notifications all still go through `sendTransactionalSms` — so
if free text does not survive that template, those have been failing silently all along. That is a
bigger finding than this feature.

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
2. `dispatchEmailPreferWhatsapp` alongside the two existing dispatch helpers.
3. `NotificationsService.notifyListingPosted(user, listing, url, expiresAt)`, modelled on
   `notifyListingExpiryReminder` — same shape, returning which channel was used so the caller can
   log it.
4. Call it fire-and-forget from `ListingsService.create`, beside `notifyMatchingBuyers`.
5. Set `PUBLIC_SITE_URL` on prod.
6. Register the WhatsApp sender and template, set the two env vars, and verify one real send.
7. Unit test alongside the existing `listings.service.spec.ts` notification tests: fires once on
   create, and a rejected notification still returns the listing.

## Out of scope

- **SMS.** Deliberately not a fallback for this message. It does mean the DLT-template question
  in §2 no longer blocks *this* feature — but it still needs answering, because the flagged,
  approved and saved-search notifications all go through that path.
- **Notification preferences.** There is no preference column, and routing is presence-based.
  Worth having eventually; not worth blocking a first acknowledgement on.
- **Edit/renew acknowledgements.** Same machinery, different triggers, decide separately.

## Verification

- Post an ad as an email-only user → one email, no SMS.
- Post as a phone-only user → one WhatsApp message, no email, no SMS. **Confirm it actually
  arrives** — nothing has ever been delivered down this path.
- Post as a user with both → exactly one message, on email.
- Post as a phone-only user while WhatsApp is still unconfigured → the ad is created, the skip is
  logged, nothing throws.
- Click the link in the message → lands on the live ad, not a redirect or a 404.
- Point SMTP at a dead host and post → the ad is still created and returned.

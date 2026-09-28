# Post an ad from WhatsApp

## Status: proposed (2026-09-28) — not started

## Context

Most sellers who arrive from Google Ads are phone-first and already live in WhatsApp. Two things
lose them on the web form today:

1. **The OTP step.** Publishing needs an account, and the account needs an SMS OTP. A missed or late
   SMS ends the attempt.
2. **Starting on an unfamiliar site.** Messaging a business on WhatsApp feels lower-commitment
   than filling a form on a site the seller has never heard of.

WhatsApp already proves which phone number is sending the message. That is the same fact the OTP
exists to establish, so a seller who messages us can be logged in without one.

### What exists today

- **Sending:** `WhatsappProvider` (`apps/bff/src/notifications/providers/whatsapp.provider.ts`) sends
  approved *template* messages through Meta's Cloud API directly (`WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_ACCESS_TOKEN` — both set in production). `Msg91Provider` sends the welcome, ad-posted,
  claim and boost-promo templates through MSG91's WhatsApp integration
  (`MSG91_WHATSAPP_INTEGRATED_NUMBER` etc. — also set in production).
- **Receiving:** only delivery/read *status* callbacks, via `WhatsappWebhookController`
  (`POST /webhooks/msg91-whatsapp-status/:secret`). **Nothing receives messages a user sends us.**
- **Login:** `AuthService.verifyOtp` upserts the user by phone, then runs the first-login welcome,
  the signup conversion report (with the web visit's attribution), `recordLogin`, and the
  visit/viewer linking, and issues the session. The web signs in through the NextAuth
  `phone-otp` Credentials provider in `apps/web/src/auth.ts`.
- **Drafts:** the web wizard already saves drafts on the device (`docs/plans/post-ad-draft-autosave.md`),
  and publishing already runs the price range check and the platform-fee checkout gate
  (`docs/plans/listing-platform-fee-and-checkout-gate.md`).
- `docs/plans/property-requirements-demand-side.md` lists "WhatsApp-first posting" as a future idea
  for buyer requirements. This plan is the seller-side version; the same inbound channel would
  serve both.

## Approaches considered

| | What the seller does in WhatsApp | Effort | Kept? |
|---|---|---|---|
| **1. Doorway + login link** | Sends any message, gets a one-tap link that opens `/post` already logged in | A few days | **Phase 1** |
| **2. Send the ad, we draft it** | Sends their usual ad text and photos; AI fills a draft; they check it and publish on the site | 1–2 weeks | **Phase 2**, only if Phase 1 shows people use the channel |
| **3. Whole form in WhatsApp** | Fills the full form in WhatsApp Flows (native in-app forms) or a question-by-question bot | 3–4+ weeks | Rejected — see below |

**Why the website stays the place where you publish, in every phase.** Publishing depends on
several things the website already does:

- the fields each category requires;
- the price range check, including price per unit (`listingPriceIssue`);
- the location pin;
- shrinking photos and the "Preparing media…" gating;
- the platform-fee and Boost checkout.

Rebuilding any of these in WhatsApp means maintaining two copies. Any paid step would need a link
back to the website anyway.

---

## Phase 0 — Check before building (no code)

1. **Which number receives messages.** Production has both a Meta Cloud API number
   (`WHATSAPP_PHONE_NUMBER_ID`) and an MSG91-integrated number. Confirm whether they are the same
   number, and which one the Google Ads, the site and outgoing templates should point people at.
2. **How incoming messages reach us.** One of these:
   - **Meta webhook to our own app (preferred).** Subscribe our Meta app to the WhatsApp Business
     Account (`POST /{waba-id}/subscribed_apps`) and set the callback URL and verify token in the app
     dashboard. More than one app can be subscribed to the same account, so this works even if MSG91
     also receives the messages.
   - **MSG91's inbound-message webhook (fallback),** if the number is only reachable through MSG91.
     Its payload shape would need confirming against a real message, the same way the status webhook
     was confirmed on 2026-09-08.
3. **App secret.** The Meta app secret is needed to check the `X-Hub-Signature-256` on each webhook.
   Store it as `WHATSAPP_APP_SECRET` in the production env only.
4. **Cost check.** Replies to a message the user sent first, within the 24-hour window, are free
   service messages; no template is needed for them. Conversations that start from a Click-to-WhatsApp
   ad get a longer free window. Confirm this against the current Meta rate card for India before
   launch.

---

## Phase 1 — WhatsApp doorway with a one-tap login link

### Seller experience

1. The seller taps a WhatsApp button: on `/post`, on the homepage, in a Google Ad, or by scanning a
   QR code. The button is a `wa.me/<number>?text=Post%20my%20ad` link.
2. WhatsApp opens with "Post my ad" already typed. The seller sends it, or anything else.
3. We reply straight away with an interactive message that has a button:
   > Hi! Tap below to post your free ad on Bhavano — you're already signed in with this number.
   > The link works once and expires in 15 minutes.
   > **[Post my ad]**
4. Tapping opens `https://www.bhavano.com/wa/<token>`. It signs them in and redirects to `/post`.
   The rest is the normal wizard, with draft saving, price checks, photo shrinking and checkout.
5. If the link has expired or been used, the page says so and tells them to send another message
   on WhatsApp for a fresh one. It also offers the normal OTP login.

### BFF

**New `WhatsappInboundController`**, in `apps/bff/src/notifications/`, with no auth guard:

- `GET /webhooks/whatsapp`: Meta's subscription check. Echo `hub.challenge` when `hub.mode` is
  `subscribe` and `hub.verify_token` equals `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; otherwise return 403.
- `POST /webhooks/whatsapp`:
  1. Verify `X-Hub-Signature-256`. It is an HMAC-SHA256 of `req.rawBody` using
     `WHATSAPP_APP_SECRET`, compared in constant time. `rawBody: true` is already on in `main.ts`
     for Razorpay. On a mismatch return 403 and do nothing else.
  2. Answer 200 quickly and do the work afterwards. Meta retries slow or failed deliveries, and a
     retry must not send a second reply.
  3. For each `entry[].changes[].value.messages[]`, deduplicate on the WhatsApp message id
     (`messages[].id`) with a unique insert into `WhatsappInboundMessage`. If the id already
     exists, stop.
  4. Ignore `statuses[]` here; delivery status stays on the existing MSG91 status webhook.
  5. Handle the message:
     - **"STOP" or "unsubscribe":** set a WhatsApp opt-out flag on the user, if we have one, and
       reply confirming it.
     - **Any other text, image, button reply and so on:** send the login-link reply below.
       Phase 1 does not try to understand what the message says.

**New `WhatsappLoginLinkService`:**

- `issue(fromPhone)`:
  - Normalise Meta's `from` number (`919876543210`) to the stored 10-digit form (`9876543210`), the
    same assumption `WhatsappProvider` makes in reverse.
  - Only accept Indian mobile numbers (`91` followed by 10 digits starting 6–9). Otherwise reply
    that posting is for Indian numbers only.
  - Rate limit: at most 3 links per phone per hour. Beyond that, reply "check your earlier message"
    without issuing a new token.
  - Create a random token of 32 bytes, base64url-encoded. Store only its SHA-256 hash, with the
    phone, `expiresAt` (now plus 15 minutes) and `usedAt` set to null.
  - Return the URL `${WEB_BASE_URL}/wa/<token>`.
- `consume(token, visit)`:
  - Look up the hash where `usedAt` is null and `expiresAt` is after now, and set `usedAt` in the
    same statement (`updateMany` with `count === 1`) so two taps can't both succeed.
  - Then run `AuthService.loginWithWhatsappLink(phone, visit)`.

**New `AuthService.loginWithWhatsappLink(phone, visit)`.** It is the same as `verifyOtp` minus the
OTP check:

- upsert the user by phone with `phoneVerifiedAt: now` and `acquisitionCreateFields(visit)`;
- promote to admin if allowlisted;
- run `welcomeIfFirstLogin`;
- run `reportSignupConversion(visit)` if the user is new;
- `recordLogin(userId, 'whatsapp', sessionId)`, which widens the `method` union;
- link the visit and listing views to the user;
- `issueSession`.

The user is created when the link is **opened**, not when the WhatsApp message arrives. That means
the web visit, with its gclid and UTM attribution, is available for the signup conversion, just as
it is for OTP. A message that is never followed by a tap creates no account.

`POST /auth/whatsapp-link`, body `{ token, visit }`:

- `ThrottlerGuard`, 10 per minute, the same as `verify-otp`;
- a bad or expired token returns 401 with a message the web page can show.

**Sending the reply.** Add `WhatsappProvider.sendCtaUrl(phone, bodyText, buttonText, url)`, which
sends an `interactive` message of type `cta_url`. It is only valid inside the 24-hour window, and
that is always the case here because we're replying to an incoming message. It follows the same
best-effort, `logThirdPartyCall`, masked-phone pattern as `sendTemplate`.

**Prisma.** One migration with two models:

```prisma
model WhatsappInboundMessage {
  id          String   @id @default(cuid())
  waMessageId String   @unique
  fromPhone   String
  type        String
  text        String?
  raw         Json
  receivedAt  DateTime @default(now())
  @@index([fromPhone, receivedAt])
}

model WhatsappLoginToken {
  id        String    @id @default(cuid())
  tokenHash String    @unique
  phone     String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  @@index([phone, createdAt])
}
```

- `WhatsappInboundMessage` also gives the admin a record of who messaged. Phase 2 reads message
  text from it.
- Old tokens can be deleted by the existing cleanup jobs, if any, or by a simple daily delete of
  rows older than 7 days.

### Web

**New route `apps/web/src/app/wa/[token]/page.tsx`:**

- `robots: { index: false, follow: false }` in `metadata`;
- not added to the sitemap;
- `robots.txt` left untouched, per the SEO rule;
- the token must not appear in analytics page-view URLs, so strip it before `PostPageTracker` or
  any page-view logging sees the path.

The page is a small client component. It calls `signIn("whatsapp-link", { token, redirect: false })`
and on success does `router.replace("/post")`. On failure it shows the expired message and a
"Log in with OTP instead" button.

**New NextAuth Credentials provider `whatsapp-link` in `apps/web/src/auth.ts`.** It mirrors
`phone-otp`: `authorize` calls the BFF's `POST /auth/whatsapp-link` and returns `id`, `name`,
`accessToken` and `isNewUser`. The existing `jwt` callback already handles `user.accessToken`, so
no change is needed there. `session.provider` becomes `"whatsapp-link"`, so signup analytics can
tell these signups apart.

**"Post via WhatsApp" entry points:**

- a secondary button on `/post` for visitors who are not logged in;
- optionally, the homepage "Post a free ad" area.

Both use `NEXT_PUBLIC_WHATSAPP_POST_NUMBER` so the number isn't hard-coded.

### Mobile

Nothing in Phase 1. The link opens in the phone's browser, which is fine because the web wizard
works on mobile. Opening the app from the link (universal or app links) can come later.

### Security

- **A forwarded link logs in the forwarder.** It works like an email magic link. Limits:
  - it can be used once;
  - it expires after 15 minutes;
  - it is only ever sent to the WhatsApp number it logs into.

  That is no weaker than an OTP read aloud to someone. Deleting the account, changing the phone
  number and payouts should still require their existing checks.
- **Fake webhook calls:** blocked by the signature check. The verify token only protects the
  one-time subscription handshake.
- **Using the endpoint to spam:** we only ever reply to someone who messaged us first, and replies
  are rate-limited per phone.
- **Logs:**
  - never log the raw token or the link URL;
  - mask phone numbers with `maskPhone`;
  - `WhatsappInboundMessage.raw` holds message text and phone numbers, so it follows the same
    admin-only access as other message tables.
- **Secrets:** `WHATSAPP_APP_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` go only in the production
  env. They are never committed, including to `.env.production.example` values.

### Tests

- **BFF unit tests:**
  - the signature check accepts and rejects correctly;
  - the verify-token handshake;
  - a duplicate WhatsApp message id sends no second reply;
  - STOP handling;
  - the rate limit;
  - a token can't be used twice (two concurrent consumes, only one succeeds);
  - an expired token is rejected;
  - `loginWithWhatsappLink` for a new user and an existing user (welcome and conversion are
    called only for the new one).
- **Manual in production:**
  - message the number from a test phone and tap the link. Check you land on `/post` logged in,
    `UserLogin.method = 'whatsapp'`, and the signup conversion row has the web visit's
    attribution;
  - tap the same link again and see the expired page;
  - send STOP.

### Rollout

1. Deploy the BFF with the webhook, which does nothing until Meta is pointed at it. Then deploy the
   web with the `/wa` route and the provider, and no public buttons yet.
2. Set the callback URL and subscribe the app (Phase 0), then test from team phones.
3. Turn on the `/post` button, then add a Click-to-WhatsApp ad variant in Google Ads and compare
   its posting rate with the current landing-page ads.

**Success measures:**

- the share of WhatsApp conversations that result in a tapped link;
- the share of links that result in a published ad;
- how that published-ad rate compares with visitors who arrive at `/post` without an account.

---

## Phase 2 — "Send us your ad" drafting (only if Phase 1 shows demand)

Sketch only. Write a proper plan before building.

**Seller experience.** The seller sends the ad text they already forward to WhatsApp groups, plus
photos. We reply "Got it — here's your ad, check and publish" with the same kind of login link,
and it opens `/post` with the wizard already filled in.

**New parts:**

- **Downloading media.** A message only carries a media id. `GET /{media-id}` returns a download
  URL that expires in about 5 minutes, so download it straight away and store it like the website
  stores uploads. WhatsApp already compresses photos, so the 4 MB limit is rarely a problem. Videos
  over the WhatsApp limit never reach us.
- **Grouping messages into one ad.** Text and several photos arrive as separate messages. Treat
  everything from one phone until 2 minutes of quiet as one ad.
- **Pulling out the details.** An AI model fills a structured draft:
  - category and sale or rent;
  - price, and whether it is per unit or total;
  - area and unit;
  - city and locality;
  - title and description;
  - the fields that category needs.

  Check the result against the same rules the website uses, and never fill a field the model
  wasn't sure about.
- **Server-side draft.** Today's drafts live only on the device (`postAdDraft.ts`). Phase 2 needs
  a server draft the wizard can load from the link token. Either reuse the draft shape in
  `apps/web/src/lib/postAdDraft.ts` stored against the user, or create an unpublished `Listing`
  with a draft status; pick one in the Phase 2 plan.
- **Asking for what's missing.** If the category or city can't be found, reply with WhatsApp list
  or button messages, which are free inside the 24-hour window. Keep this to one or two questions
  and let the website form handle the rest.

## Rejected: the whole form inside WhatsApp (approach 3)

- **WhatsApp Flows** can show forms, and now photo pickers. But city and locality search needs an
  encrypted data endpoint (RSA key exchange, AES-GCM on every request). Each category's required
  fields would need a separate Flow design approved in Meta's tools. Every future form change would
  then have to be made twice.
- **A question-by-question bot** is fragile with free-typed answers, needs a conversation state
  machine, and is slower for the seller than one web form.
- **Neither one can take payment,** so the platform fee or a Boost still sends the seller to the
  website.

The drop-off we're trying to fix is at the *start*: the OTP and an unfamiliar site. Phases 1 and 2
fix the start and keep one form.

## Open questions

- Are the Meta Cloud API number and the MSG91 number the same number? (Phase 0.1)
- Should the WhatsApp button appear to logged-in users too, as a way to get help, or only to
  visitors who aren't logged in?
- Language: the reply is English only for now. Should we add a Hindi or Telugu version, based on
  where the ad traffic comes from?
- Which AI model for Phase 2, and where it runs (cost per ad, where data is stored).

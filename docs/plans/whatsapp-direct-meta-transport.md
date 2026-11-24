# WhatsApp: send directly through Meta's Cloud API instead of MSG91 (flag-gated)

**Status: built 2026-11-18 behind `WHATSAPP_TRANSPORT=meta`. Default is unchanged (`msg91`).**

## Why
From 2026-11-17 ~16:11 IST no WhatsApp message reached a phone: MSG91 accepted every send ("request is in
process") but its failed logs said *Object with ID '1288806974321435' does not exist, cannot be loaded due to
missing permissions* and its webhooks said *WhatsApp not integrated*. Meta showed the number Offline, with the
WhatsApp account shared with a partner app (**Interakt ISV**, MSG91's provider) and a missing payment method on
the account. Login OTPs kept saying "on WhatsApp" for a code that never came (SMS only appears after 20 s).

Recovery path taken on 2026-11-18, all on Meta's side:
1. Payment method added to the WhatsApp account (Visa on the Bhavano billing account).
2. System user `BhavanoServer` got the WhatsApp account (**real id `2981345262200997`**, not the
   `1078221144990307` shown in older Business Settings links) with Full control.
3. App `Bhavano Integrations` had no WhatsApp use case: added "Connect with customers through WhatsApp"
   (permissions `whatsapp_business_messaging` and `whatsapp_business_management`); a non-expiring system-user token
   was generated with both.
4. The partner (Interakt/MSG91) was detached. That dropped the number to DISCONNECTED/ON_PREMISE; the register
   API answered "not available for SMB businesses", so it was re-added through the app's API Setup > Add phone
   number flow (SMS verification). Number now CONNECTED, CLOUD_API.
5. A direct template send to a test number returned `accepted` and arrived.

Correct ids: **Phone Number ID `1288806974321435`** (the old `WHATSAPP_PHONE_NUMBER_ID=1335971556260745` was wrong),
**WABA `2981345262200997`**. Number +91 86674 96339. Display name still pending review, so messaging limit is LIMITED.

## What this change does
`Msg91Provider` builds the payload for seven WhatsApp sends (welcome, OTP, ad-posted, pending-checkout, boost
promotion, claim verification, owner alerts). Each already builds `body_*` / `button_*` components keyed for MSG91.
Rather than rewrite seven methods, they now call one private `waFetch()`:
- `WHATSAPP_TRANSPORT` unset or `msg91`: identical to before (a plain `fetch` to MSG91).
- `WHATSAPP_TRANSPORT=meta`: the same payload is translated by `whatsapp-components.ts` into Meta components and
  sent with `WhatsappProvider.sendTemplateComponents`; the result is wrapped in a `Response` shaped like MSG91's
  (`request_id` = the Meta message id `wamid...`), so every caller (and `providerMessageId` tracking) is unchanged.
  Not configured or a Meta error returns a failing response, so the OTP path falls back to SMS as before.

Translation rules (templates are named exactly as in MSG91, language `en`):
- `body_<name>` with `parameter_name` becomes a named parameter; `body_N` becomes positional parameter N.
- `button_N` (url) becomes a `button` component with `index = N - 1` and the suffix as its text parameter.
  The `whatsapp_otp` AUTHENTICATION template takes the code as body `{{1}}` and as its copy-code button parameter.

Delivery reports: Meta posts to **`/webhooks/whatsapp-meta`** (GET verify with `WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
POST checked against `X-Hub-Signature-256` using `WHATSAPP_APP_SECRET`). Statuses update
`ListingNotificationLog.deliveryStatus` by message id (same as the MSG91 webhook) and failures are logged with
Meta's error code. Every call is stored in `WhatsappWebhookEvent`.

## Rollout (nothing changes until step 3)
1. Merge and deploy. Behaviour is unchanged while `WHATSAPP_TRANSPORT` is unset.
2. In prod `.env`: `WHATSAPP_ACCESS_TOKEN` = the system-user token, `WHATSAPP_PHONE_NUMBER_ID=1288806974321435`,
   `WHATSAPP_APP_SECRET` (app dashboard > App settings > Basic), `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (any long random
   string). Then, in the Meta app: WhatsApp > Configuration, set the callback URL
   `https://api.bhavano.com/webhooks/whatsapp-meta`, the same verify token, and subscribe to **messages**; and
   subscribe the app to the WhatsApp account (`POST /2981345262200997/subscribed_apps`).
3. Set `WHATSAPP_TRANSPORT=meta` and restart `bff`. Check disk space first (see the prod-host notes).
4. Verify: log in with a phone number and confirm the OTP arrives on WhatsApp; check `WhatsappWebhookEvent`.
Rollback: unset `WHATSAPP_TRANSPORT` (but MSG91 cannot send WhatsApp until a partner is re-attached); or set
`OTP_DEFAULT_CHANNEL=sms` so login codes go by SMS.

## Caveats
- With the partner detached MSG91 sends no WhatsApp at all; the `msg91` setting only matters if it is re-attached.
- Display name is pending review: the daily conversation limit is low until Meta approves it.
- Utility/authentication templates are charged by Meta to the payment method on the account.
- Templates with a fixed (non-dynamic) second URL button need no component for it; only dynamic buttons are sent.

## Recovery 2026-11-24: the number works in the WhatsApp Business app AND the Cloud API (coexistence)

**Status: working.** A login code requested with `channel: whatsapp` was accepted by Meta and the webhook reported
`sent` then `delivered` (pricing category `authentication`) within about a second; the owner confirmed it arrived in
WhatsApp. `OTP_DEFAULT_CHANNEL=whatsapp` again (SMS stays the fallback when a WhatsApp send fails).

**What the earlier "both" setup actually was.** Not MSG91 and not a partner: Meta's own coexistence, done from
business.facebook.com and the WhatsApp Business app on the phone. The number lives in the WhatsApp Business app and
the Cloud API at once, and our own system-user token sends through it. The earlier plan note that coexistence needs a
Solution Partner or Tech Provider was wrong for this case: it describes partner onboarding via Embedded Signup, not
Meta's own screens.

**What broke it (17 Nov):** the number was moved to a new phone, and verifying WhatsApp Business there created a fresh
app account on the number, which cut the Cloud API link (sends then failed; MSG91 reported "not integrated"). Detaching
the MSG91/Interakt partner on 18 Nov and later removing the number from the portfolio made it worse; do **not** remove
the account from the business portfolio again (the delete option does not exist for app-created accounts anyway).

**The sequence that restored it (current ids: messaging account `1178368684598444`, Phone Number ID
`1501538356367152`, number +91 86674 96339; the 16 templates survived and were still APPROVED):**
1. WhatsApp Business installed and logged in on the phone with the number.
2. business.facebook.com > Business Settings > WhatsApp accounts > Add > **Link a WhatsApp Business account**: enter
   the number, then the 5-digit code that WhatsApp sends *inside the app*. Result: "WhatsApp Business account linked".
3. System user `BhavanoServer` assigned to the account (it showed "Already assigned" on the WhatsApp account entry and
   gained MANAGE on the messaging account).
4. developers.facebook.com > Bhavano Integrations > WhatsApp > API Setup > **Generate access token** (opens a popup,
   must be clicked by a person): pick the Bhavano account. The temporary token it shows is not needed.
5. In the WhatsApp Business app: **connect to the business platform by scanning the QR code** shown on the computer.
   Meta then reported the number `CONNECTED`, `platform_type = CLOUD_API`.
Verify with `GET /<phone_id>?fields=status,platform_type` (want CONNECTED / CLOUD_API) and one test send; delivery
reports arrive at `/webhooks/whatsapp-meta` and are stored in `WhatsappWebhookEvent`.

**Failure signatures seen on the way (for next time):** `(#133010) Account not registered` = the number is on the app
only (`platform_type = ON_PREMISE`); `Register endpoint is not available for SMB businesses` = same cause; `request_code`
"wait 1 hour" = Meta's lock after repeated verification attempts; `131042 Business eligibility payment issue` = the
account's billing, which did not recur on the recreated account.

**Rules to keep it working:** never verify the number in a second phone/app install without redoing steps 2 and 5; keep
WhatsApp Business on the phone; keep `WHATSAPP_PHONE_NUMBER_ID` equal to the id above (it changes if the account is
recreated).

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

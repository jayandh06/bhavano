# Activating MSG91 SMS OTP login

## Why this is a short plan

**SMS-based login is already implemented end to end.** Phone OTP is the primary login path in
this app and has been since before the DLT template existed — signup, login, challenge storage,
attempt limits, throttling, and the new-vs-returning user split are all in place and working.

What has been missing is the one thing a DLT approval unblocks: a **template ID** to send
against. So this is an activation and verification task, plus one genuine code gap found while
checking (see step 2).

## Current state (verified)

### The flow that already exists

```
apps/web  AuthGateProvider.tsx   phone input -> OTP input
   |                              sendOtpAction / verifyOtpAction
   v
apps/bff  auth.controller.ts     POST /auth/otp/send    @Throttle 3/60s
                                 POST /auth/otp/verify  @Throttle 10/60s
   |
   v
          otp.service.ts         createChallenge / verifyChallenge
          auth.service.ts        upsert user, issue session
          msg91.provider.ts      MSG91 v5 OTP API
```

| Concern | Where | Behaviour |
|---|---|---|
| Code generation | `otp.service.ts` | `randomInt(100000, 1000000)` — 6 digits |
| Storage | `OtpChallenge` model | SHA-256 of `phone:code`; the plaintext code is never persisted |
| Expiry | `otp.service.ts` | `OTP_TTL_MS` = 5 minutes |
| Wrong-guess limit | `otp.service.ts` | `MAX_ATTEMPTS` = 5, then "request a new OTP" |
| Single-use | `otp.service.ts` | Challenge row deleted on successful verify |
| Send rate limit | `auth.controller.ts` | `@Throttle({ limit: 3, ttl: 60_000 })` |
| **New user creation** | `auth.service.ts` | `prisma.user.upsert({ where: { phone } })` — creates on first verify |
| **Existing user login** | same `upsert` | Updates `phoneVerifiedAt`, returns the existing user |
| New-vs-returning | `auth.service.ts` | `isNewUser = !user.welcomedAt`, drives the welcome message and the `signup_complete` dataLayer event |
| Admin promotion | `promoteToAdminIfAllowlisted` | Phone in `ADMIN_PHONES` becomes an admin on login |
| Attribution | `acquisitionCreateFields(visit)` | First-touch UTM/referrer written only on user creation |
| Login audit | `recordLogin(id, 'otp')` | `LoginEvent` row per login |

The single `upsert` keyed on `phone` is what makes "create entry for new user **or** login by
existing user" one code path rather than two — there is no separate signup endpoint to build.

### Configuration — the actual gap

| Variable | local `apps/bff/.env` | prod `.env` | Read by code? |
|---|---|---|---|
| `MSG91_AUTH_KEY` | empty | **set** | yes |
| `MSG91_DLT_TEMPLATE_ID` | empty | **empty** | yes |
| `MSG91_SENDER_ID` | empty | empty | **no — see step 2** |
| `MSG91_TRANSACTIONAL_TEMPLATE_ID` | empty | empty | yes (non-OTP SMS only) |

`Msg91Provider.sendOtp()` throws when `MSG91_AUTH_KEY` is unset rather than pretending to
succeed — deliberate, since a silent no-op would let a user sit waiting for an SMS that was
never sent. With the key set but no template ID, the call still goes out; whether MSG91 accepts
it depends on the account's DLT enforcement, which is why step 1 matters.

---

## Step 1 — Set the approved template ID (the actual unblock)

On the prod host, in `~/bhavano/.env`:

```
MSG91_DLT_TEMPLATE_ID=<the approved template id from the MSG91 dashboard>
```

This is a **runtime** variable on the `bff` service (already wired in
`docker-compose.prod.yml`), not a `NEXT_PUBLIC_*` build arg, so it does **not** need an image
rebuild — a restart picks it up:

```
docker compose -f docker-compose.prod.yml --env-file .env up -d bff
```

Take the ID from MSG91 → **DLT → Templates**, the entry now showing *Approved*. It is the
MSG91 template id, not the DLT template id issued by the telecom registry — the two are
different numbers and the dashboard shows both.

## Step 2 — Send the DLT sender/header (code gap)

`MSG91_SENDER_ID` is documented in `.env`, passed through `docker-compose.prod.yml`, and
**never read by any code** — `grep -rn MSG91_SENDER_ID apps/bff/src` matches only a doc comment.
`sendOtp()` currently sends `mobile`, `otp`, and `template_id` and no sender.

In Indian DLT, an approved template is registered against a specific 6-character **header**
(sender ID). If the MSG91 account has more than one header, or does not have a default, sends
are rejected for a mismatch — a failure that looks like a bad template rather than a missing
sender.

**File:** `apps/bff/src/notifications/providers/msg91.provider.ts`

```ts
const senderId = this.config.get<string>('MSG91_SENDER_ID');
const params = new URLSearchParams({
  mobile: `91${phone}`,
  otp: code,
  ...(templateId ? { template_id: templateId } : {}),
  ...(senderId ? { sender: senderId } : {}),
});
```

Conditional, so behaviour is unchanged when it is unset. This is a bff code change, so it needs
a rebuild rather than a restart.

## Step 3 — The template variable is `##var1##`, not `##OTP##` (confirmed)

The approved template reads:

> Your OTP for Bhavano App login is `##var1##`. Valid for 10 minutes. Do not share this OTP with
> anyone. - Team Bhavano

MSG91's v5 OTP API substitutes its `otp` parameter into an `##OTP##` placeholder specifically, so
against this template the code would arrive blank — which is exactly what a dashboard test send
showed. A dashboard test supplies no variable value and so is always blank, but here the app
would have produced the same empty slot.

**Resolved by editing the template**, which now reads `##otp##` — matching the param name the
API already sends, so this is the standard configuration and needs no special handling. The
provider keeps an optional `MSG91_OTP_VAR_NAME` for a template that ever uses a different
placeholder, but it is **unset by default** so no stray parameter is sent that the template
cannot consume.

> **Check the template's approval state before testing.** Editing a DLT template's body can put
> it back into *Pending* with the telecom registry, because it is the message content that is
> registered, not just the MSG91 record. If MSG91 → DLT → Templates does not show *Approved*,
> sends will be rejected regardless of anything in this repo — and the rejection reads like a
> configuration error rather than a pending approval.

Prove it before deploying, with `msg91_test_otp.py`, which sends one real SMS:

```
python msg91_test_otp.py 9876543210
python msg91_test_otp.py 9876543210 --var-name VAR1   # if the digits are still missing
```

Note MSG91 answers `200` with `{"type": "error"}` for template and sender problems, so the HTTP
status alone is not the success signal — the script checks the body too.

### The 10-minute mismatch

The template promises "Valid for 10 minutes" while `OTP_TTL_MS` was **5 minutes**. A user coming
back at seven minutes would be told the code expired, and would be provably right to complain.
Fixed by moving the code to 10 minutes rather than re-approving the template; the 5-attempt cap
and the 3/minute send throttle are what actually bound brute force, not the window length.

## Root cause (resolved 2026-08-27)

Eight sends failed with `Template ID Missing or Invalid Template` before the cause was clear.
The answer: **`sendOtp()` was calling the wrong endpoint.**

MSG91 keeps templates in separate buckets and `/api/v5/otp` accepts only OTP-type templates.
`Bhavano_Login` is a **Flow/Transactional** template, so that endpoint rejected it no matter what
else the request got right — which is why changing ids, adding the sender, and re-approving the
body all made no difference. `sendOtp()` now posts to `/api/v5/flow/`, passing the code as a
recipient key matching the `##otp##` placeholder. Nothing is lost: we generate and verify codes
ourselves, so the OTP API's own features were never used.

Confirmed working, request `3668416e544e3664446c6d53`, **Delivered**:

| Setting | Value |
|---|---|
| Endpoint | `https://control.msg91.com/api/v5/flow/` |
| `MSG91_DLT_TEMPLATE_ID` | `6a8ea1aae1638d5a06061ca5` — MSG91's id, **not** the 19-digit DLT registry id |
| `MSG91_SENDER_ID` | `bhavno` (lowercase, as MSG91 records it) |
| Recipient key | `otp`, matching `##otp##` |

Two things that made this slow to diagnose, worth remembering:

1. **MSG91 answers `200` / `type:success` for sends it then discards.** Both the IP-whitelist
   rejection and the invalid-template rejection looked like success at the API. Only
   Reports → SMS logs shows the truth. `sendOtp()` now also treats a `"error"` body as a failure,
   though that still cannot catch the discard-after-accept case.
2. **The variable name `MSG91_DLT_TEMPLATE_ID` is misleading** — it wants MSG91's template id,
   not the DLT registry id. Renaming it is a tidy-up worth doing when someone next touches this.

Strictly, only the endpoint is *proven* necessary: the successful send changed both the endpoint
and the sender case at once, and Flow-with-uppercase-sender was never tried. Lowercase is used
because that is what is known to work.

## Step 4 — Verify

1. **Local first**, with a real key: put `MSG91_AUTH_KEY` and `MSG91_DLT_TEMPLATE_ID` into
   `apps/bff/.env`, run the app, and log in with a real phone number. Confirm the SMS arrives
   with a readable 6-digit code.
2. **New user** — use a number with no existing account. Verify a `User` row is created with
   `phoneVerifiedAt` set, a `LoginEvent` with source `otp`, and that `isNewUser` came back true
   (observable as the `signup_complete` event in GTM Preview, `method: "phone"`).
3. **Existing user** — log in again with the same number. A second `LoginEvent`, no duplicate
   `User`, and `isNewUser` false this time.
4. **Wrong code** — 5 bad guesses, then confirm the 6th says "Too many attempts".
5. **Expiry** — request a code, wait 5 minutes, confirm it is rejected as expired.
6. **Throttle** — 4 send requests inside a minute; the 4th should be a 429.
7. **Prod smoke test** after deploying, with one real number.

## Step 5 — Watch the first day

`Msg91Provider.sendOtp()` throws on a non-2xx, and the message includes MSG91's own response
body, so failures surface in the bff logs rather than being swallowed. Grafana/Loki is already
set up (`docs/plans/bff-loki-grafana-logging.md`) — filter for `Msg91Provider` or
`MSG91 send failed` for the first day of real traffic. A DLT rejection shows up there with the
reason, which is far faster to read than the MSG91 dashboard.

## Out of scope

- **Expired `OtpChallenge` cleanup.** Rows are deleted on successful verify but abandoned
  challenges accumulate. Harmless at current volume (small rows, indexed by phone), and a
  `@nestjs/schedule` cron deleting `expiresAt < now()` is a ten-line follow-up if it ever
  matters.
- **Resend cooldown in the UI.** The 3/minute server throttle already bounds abuse; a visible
  countdown is a UX nicety, not a gap.
- **WhatsApp OTP delivery.** `sendWhatsapp()` exists but needs its own registered number and
  template, and its doc comment warns the endpoint shape should be re-verified against MSG91's
  current docs before being relied on.
- **International numbers.** The `91` prefix is hardcoded in the provider and the DTO validates
  `/^[6-9]\d{9}$/`. India-only is a deliberate current constraint, not an oversight.

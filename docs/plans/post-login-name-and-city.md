# Post-login name (+ optional city); secondary verification deferred to Publish

Status: **changed 2026-09-28** — login asks only for name (+ optional city); a **verified phone is
now required at Publish** instead (built the same day, see "Deferred verification"). Everything
below "Original design" describes the earlier behaviour and is kept for the reasoning and the
still-reused phases.

## 2026-09-28 change: what login asks now

| Login method | Required at login | Optional at login |
| --- | --- | --- |
| Phone OTP | **Name** (typed) | City (prefilled, see below) |
| Google / Apple | **Name** (prefilled from the provider, editable) | City (prefilled) |

Why: the forced second verification straight after the first login was a second wall in front of a
new user (observed drop-offs between signup and Publish). `profileNeedsBasics` is now
`!name || !cityId`; `profileNeedsMandatoryBasics` is `!name`; `basicsFromProfile` always returns
`needSecondary: null`, so `ProfileBasicsStep`'s `askPhone/askOtp/askEmail/askEmailCode/
confirmMerge` phases never run at login. They are intentionally left in place: the Publish gate
reuses them.

City: mobile prefills it from the city already selected in the header (one-tap confirm) when the
profile has none. **Web does not prefill yet** — the selected city lives in a server-side cookie
(`bhavano_city`), not in client state the auth modal can read.

### Deferred verification (built)

- **Rule:** publishing needs a *verified phone*. Phone-OTP accounts always have one. Google/Apple
  accounts usually do not, so they are asked at Publish. Email is never required to publish.
- **BFF (authoritative):** `ListingsService.assertOwnerPhoneVerified`, called by the user-facing
  `POST /listings` controller only (not inside `create`, which outreach also uses to post on a
  contact's behalf). Rejects with 403 `{ code: PHONE_VERIFICATION_REQUIRED, message: "Verify your
  phone number to publish your ad." }` when `phone` or `phoneVerifiedAt` is missing.
- **Web:** `useAuthGate().requireVerifiedPhone({ onSuccess })` (AuthGateProvider). The wizard's
  `onSubmit` calls it before any upload when `getUserContactAction()` has no phone; the modal
  reuses `ProfileBasicsStep` in `verifyPhoneOnly` mode (starts at the phone step, Cancel closes,
  no name/city re-save) and resumes `onSubmit` once linked. A create-time 403 with the message
  above re-opens it as a backstop.
- **Mobile:** `useHomeSheets().ensureVerifiedPhone({ accessToken, onSuccess })` resolves `true`
  (already verified — carry on) or `false` (it opened the basics sheet in `verifyPhoneOnly`
  mode; `onSuccess` resumes). Swiping the sheet away drops the pending resume.
- **Phone already on another account:** the existing account-merge confirm phase applies, unchanged.
- **Deploy order:** web/mobile first, BFF second — an old web talking to the new BFF would show a
  Google-only user a bare 403 instead of the dialog.
- **Still open:** phone-OTP users' optional post-publish email nudge; a gentle nudge (never a
  block) for legacy accounts missing the other identifier — the banner/dialog in
  [profile-completion-dialog.md](profile-completion-dialog.md) already cover that.

## Original design (2026-09-25, superseded for login)


## Goal

After phone / Google / Apple login, require profile basics before the session is treated as
complete:

| Login method | Required before continue | Optional |
| --- | --- | --- |
| Phone OTP | Name + **verified email** (email code) | Preferred city |
| Google / Apple | Name + **verified phone** (OTP via `linkPhone`) | Preferred city |

- **Name** — single display field, mandatory. Phone OTP starts empty; Google/Apple prefill when
  the provider returned a name (editable).
- **Secondary identifier** — mandatory and **must be verified**. Typed-but-unverified email/phone
  is never enough (`emailVerifiedAt` / `phoneVerifiedAt` only). Uses existing
  `requestEmailCode`/`verifyEmail` and `sendOtp`/`linkPhone` (plus account-merge confirm when the
  identifier already belongs to another account). See
  [account-linking-phone-and-email.md](account-linking-phone-and-email.md).
- **Preferred city** — optional. Type-ahead only after **≥ 2 characters**. Skip leaves city unset,
  but only after name + verified secondary are done.

First-session linking of the other channel is therefore **in the login sheet**, not deferred.
The skippable return-visit nudge ([profile-completion-dialog.md](profile-completion-dialog.md))
and the banner remain for **legacy** users who completed login before this gate existed.

## When it shows

After a successful login (web `AuthGateProvider`, mobile `HomeSheetsProvider`), fetch
`UserProfileDto`. Open the basics step iff any of:

- `!name?.trim()`
- missing secondary: `!phone` (Google/Apple) **or** `!email || !emailVerified` (phone)
- `!cityId` (city still shown; skippable once name + secondary are satisfied)

Cannot dismiss / Skip until **name** and **verified secondary** are present. City-only gap allows
Skip.

### Session restore / full-page Google return

The gate used to run **only** at the end of an AuthGate login. Existing Google users who already
had a session cookie (or finished Google as a full-page redirect to `/`) never saw the phone
prompt.

**Fix (2026-09-25):** on AuthGate / HomeSheets mount, if the browser/app already has a valid
session and `profileNeedsMandatoryBasics` (missing name **or** verified secondary — not city
alone), open the same basics sheet quietly (no “Logged in successfully” toast). Full-page Google
returns therefore pick up the phone requirement on the next page load.

City-only gaps are still not forced on every visit.

**Phone OTP cookie race (2026-09-25):** right after `verifyOtpAction` / NextAuth `signIn`, a
follow-up `fetchProfileAction` could briefly see no session (Set-Cookie not yet on the next
server-action request). That path used to call `onLoginSuccess()` and skip basics — and because
`AuthGateProvider` lives in the root layout, a soft navigation never remounted to re-check.
`verifyOtpAction` now returns the profile from the same request as `signIn`, and the client
retries profile fetch before giving up.

## Surfaces

| Surface | Where |
| --- | --- |
| Web desktop + mobile browser | `basics` step inside the auth modal (`AuthGateProvider` → `ProfileBasicsStep`) |
| Native mobile | `basics` step inside the login bottom sheet (`HomeSheetsProvider` → `ProfileBasicsStep`) |

City search reuses `searchCitiesAction` / `fetchCities(q)`. Name/city save uses `updateProfile`.
Secondary linking never goes through `updateProfile` (email/phone are write-blocked there).

On mobile, saving a city also updates the in-app home city (`setCity`).

## Out of scope

- Splitting first/last name
- Blocking login before OTP/Google completes
- Showing popular cities as a default list in this step (deliberate empty until 2 chars)
- Re-verifying Google/Apple email (already verified by the provider)

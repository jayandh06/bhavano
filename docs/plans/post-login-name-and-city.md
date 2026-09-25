# Post-login name + verified secondary identifier (+ optional city)

Status: **implemented** (2026-09-25; secondary verification added same day)

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

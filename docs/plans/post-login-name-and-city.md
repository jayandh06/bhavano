# Post-login name (required) + preferred city (optional)

Status: **implemented** (2026-09-25)

## Goal

After phone / Google / Apple login, ask once for profile basics when either **name** or
**preferred city** is missing:

- **Name** — single display field, **mandatory** to leave the step. Phone OTP starts empty;
  Google/Apple prefill when the provider returned a name (editable).
- **Preferred city** — optional. Type-ahead only: no full list by default; search after the
  user types **≥ 2 characters**. Skip leaves city unset.

Does **not** replace the deferred email/phone nudge
([profile-completion-dialog.md](profile-completion-dialog.md)) — that remains for linking the
other identifier later.

## When it shows

After a successful login (web `AuthGateProvider`, mobile `HomeSheetsProvider`), fetch
`UserProfileDto`. Open the basics step iff `!name?.trim()` **or** `!cityId`.

- Missing name → Continue requires a non-empty name; no Skip / no dismiss without saving name.
- Name present, city missing → Skip / dismiss allowed (city stays unset).
- Both present → proceed to normal post-login success (toast, redirect, resume).

Legacy phone users without a name see this on their **next** login.

## Surfaces

| Surface | Where |
| --- | --- |
| Web desktop + mobile browser | New `basics` step inside the existing auth modal (`AuthGateProvider`) |
| Native mobile | New `basics` step inside the login bottom sheet (`HomeSheetsProvider`) |

City search reuses `searchCitiesAction` / `fetchCities(q)` — same APIs as profile / location
pickers. Saving uses existing `updateProfile` / `updateProfileAction` (`name`, `cityId`).

On mobile, saving a city also updates the in-app home city (`setCity`) so browse matches the
choice immediately.

## Out of scope

- Splitting first/last name
- Blocking login before OTP/Google completes
- Showing popular cities as a default list in this step (deliberate empty until 2 chars)

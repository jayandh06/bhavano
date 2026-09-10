# Deferred profile-completion dialog (ask on a return visit, not at signup)

Status: **proposed**. Follow-up to
[welcome-notification-and-profile-completion.md](welcome-notification-and-profile-completion.md),
which shipped the persistent banner. Depends on the linking mechanics in
[account-linking-phone-and-email.md](account-linking-phone-and-email.md).

## Goal

A user who signs up with only one identifier (phone-OTP → no email; Google → no phone) is asked
to add the other one **on a later login**, in a skippable dialog — not during the first session,
and not only via a banner they tune out.

## Grounded in current code

- **First-login signal already exists.** `User.welcomedAt` is null until the first login, set by
  `AuthService.welcomeIfFirstLogin()`. `isNewUser = !user.welcomedAt` is computed in
  `verifyOtp()` / `loginWithGoogle()` (`apps/bff/src/auth/auth.service.ts`), passed through
  `issueSession(user, isNewUser)` → `AuthSession.isNewUser` → NextAuth token → `session.isNewUser`
  and `session.provider` on the web (`apps/web/src/auth.ts`). `checkNewSignupAction()`
  (`apps/web/src/app/actions/auth.ts`) already surfaces `{ isNewUser, provider, email }` to the
  client. **So "is this a returning login" is `!session.isNewUser` — free, no new column.**
- **There is no login count / `lastLoginAt`** on `User`. Cadence control for the dialog needs one
  small new field (below).
- **An immediate signup-moment email ask already exists** for phone signups:
  `AuthGateProvider.handleVerifyOtp()` does `if (result.isNewUser) setLoginStep("email")` — an
  in-sheet, skippable email step. Google signups have no phone equivalent (redirect/popup, no
  form). This plan **removes that forced step** and replaces it with the deferred dialog + a
  couple of contextual nudges.
- **`ProfileCompletionBanner`** (`apps/web/src/components/home/ProfileCompletionBanner.tsx`) is
  non-dismissible, on every page, re-fetches `fetchProfileAction()` per navigation, shows when
  `!profile.email || !profile.phone`.
- **All the linking flows already exist** and are verified-only: email via
  `requestEmailCodeAction` → `verifyEmailAction`; phone via `sendOtpAction`/`linkPhoneAction`
  (two-step OTP); collision-with-another-account via `confirmAccountMergeAction`
  (`AccountMergeSummary`). `updateProfileAction` deliberately cannot set email/phone. The dialog
  reuses these actions verbatim — it does **not** introduce a new write path.
- `UserProfileDto` carries `email`, `emailVerified`, `phone`.

## Design

### 1. One new `User` column for cadence

```prisma
/** Drives the deferred profile-completion dialog (docs/plans/profile-completion-dialog.md).
 * The dialog shows on a return login when the profile is missing an email or phone AND now is
 * past this instant. "Not now" pushes it out a week and bumps `profileNudgeCount`; once the
 * count hits the cap the dialog never shows again and only the (dismissible) banner remains.
 * Cleared implicitly: a complete profile makes the eligibility check false regardless. */
profileNudgeSnoozedUntil DateTime?
profileNudgeCount        Int       @default(0)
```

Migration backfills existing rows to the defaults (`null` / `0`). Existing incomplete-profile
users therefore become eligible on their **next** return login — accept this one-time wave, or
add `AND "createdAt" > <cutoff>` to the eligibility query for a soft launch. (Recommend the
cutoff for the first ship.)

### 2. BFF: one read endpoint + one snooze endpoint

`apps/bff/src/users/…` (same controller as the other `/users/me/*` routes, `AuthGuard`):

- `GET /users/me/profile-nudge` → `ProfileNudgeDto`:
  ```ts
  { show: boolean; missing: ("email" | "phone")[] }
  ```
  `show` is `true` iff: `missing.length > 0` **and** `profileNudgeCount < CAP` (3) **and**
  (`profileNudgeSnoozedUntil` is null or in the past). The BFF owns this decision so the same
  answer holds across devices. It does **not** consider "return vs first login" — that's the
  client's `session.isNewUser` (see §3).
- `POST /users/me/profile-nudge/snooze` → sets `profileNudgeSnoozedUntil = now + 7d`,
  `profileNudgeCount += 1`. Called on "Not now" and also when the dialog is shown-then-abandoned
  (navigated away) so an ignored dialog still counts toward the cap.

Add `ProfileNudgeDto` to `packages/types`.

### 3. Web: `ProfileCompletionDialog.tsx` (new client component)

Mounted in `apps/web/src/app/layout.tsx` next to `ProfileCompletionBanner`.

**When it fires**
- Only when `session?.isNewUser === false` (a returning login) — never in the first session.
- Once per browser session: guard with `sessionStorage` (same pattern as
  `GOOGLE_SIGNUP_TRACKED_KEY` in `AuthGateProvider`).
- Not on the login-redirect frame. Wait for the **first `pathname` change** after mount (they
  get to finish what they came back for), then call `GET /users/me/profile-nudge`; if `show`,
  open the dialog.

**What it asks** — driven by `missing`:
- `["email"]` (phone signup): email input → `requestEmailCodeAction` → 6-digit code →
  `verifyEmailAction`. On `AccountMergeSummary` (email already on another account), switch to a
  calm 3-option panel — *Merge the accounts* (`confirmAccountMergeAction`) / *Use a different
  email* / *Not now* — never a bare error.
- `["phone"]` (Google signup): phone input → `sendOtpAction` → OTP → `linkPhoneAction`; same
  merge handling.
- `["email","phone"]` (rare): ask for **phone only** here (it's what powers listing contact),
  let the banner mop up the email.

**Chrome**
- Reuse the AuthGate modal styling. Primary button "Add & verify", secondary "Not now" →
  `POST …/snooze` + close. Standard close (Esc / backdrop) also counts as a snooze.
- **Not a gate.** Nothing (post ad, contact reveal, messaging) is blocked behind it.
- **Mobile web:** one field above the fold, code/OTP as a compact step 2, full-width buttons,
  `100dvh`-safe like `MediaLightbox`.
- On success: close, and `router.refresh()` so the banner clears without a reload.

### 4. Remove the forced signup-moment email step

In `AuthGateProvider.handleVerifyOtp()`:
- Drop the `if (result.isNewUser) { setLoginStep("email"); return; }` branch — a brand-new user
  goes straight to `onLoginSuccess()`.
- **Keep the conversion event.** `pushDataLayerEvent("signup_complete", { method: "phone", user_data: { phone_number } })` currently lives inside that branch; move it so it fires right
  after a successful `verifyOtpAction` for `isNewUser`, independent of any email step.
- The `"email"` / `"emailCode"` login steps stay in the component — they're still reachable from
  the standalone email-login path; only the *new-user auto-jump* is removed.

### 5. Banner becomes dismissible + contextual nudges

So the dialog and banner don't double-nag:
- `ProfileCompletionBanner`: add a dismiss "×". Store `profileBannerDismissedAt` in
  `localStorage`; re-show after 7 days. (Per-device is fine for a banner.)
- Add **inline** (not modal) nudges where the value is self-evident:
  - Post-ad acknowledgement screen (see [post-ad-acknowledgement.md](post-ad-acknowledgement.md)):
    "Add your email to get a copy of this ad" / "Add your phone so buyers can reach you faster."
  - First inbound message or first contact-reveal on one of the user's listings.
  These reuse the same `requestEmailCode`/`linkPhone` actions in a one-line form.

### 6. Mobile app (React Native) — follow-up, not blocking

The RN app already has the profile screen + banner from the earlier plan. The same deferred
dialog can be added later: `HomeSheetsProvider` already tracks `profile` and `isLoggedIn`; add
an `isNewUser` passthrough from `onLoginSuccess`, call the new `/users/me/profile-nudge`
endpoint, and render a RN `Modal` mirroring §3. Out of scope here.

## Verification

1. `pnpm --filter @bhavano/bff typecheck`, `--filter @bhavano/web typecheck`, and the Prisma
   migration; confirm existing rows backfilled (`profileNudgeCount = 0`, snooze null).
2. **First session, no dialog:** sign up with a fresh phone number → land straight in the app,
   no email step, no dialog. `signup_complete` still in the dataLayer (check via GTM preview).
3. **Return login shows it:** log the same (still email-less) user out and back in → after the
   first navigation, the dialog appears asking for email. Complete the emailed-code flow →
   dialog closes, banner gone, `email` + `emailVerified` set.
4. **Snooze + cap:** on a fresh incomplete user, hit "Not now" → `profileNudgeSnoozedUntil` ≈
   now+7d, `profileNudgeCount` = 1, no dialog again this session or within 7 days. Force the
   count to `CAP` → `GET /users/me/profile-nudge` returns `show: false`; only the banner shows.
5. **Google user path:** new Google signup (no phone) → return login → dialog asks for phone →
   `sendOtp`/`linkPhone` completes → `phone` set.
6. **Merge collision:** enter an email/phone already attached to another account → dialog shows
   the 3-option merge panel, not an error; "Merge" runs `confirmAccountMergeAction` and the
   sessions reconcile.
7. **Not a gate:** with the dialog open, confirm Post ad / reveal-contact / messaging still work
   if the user dismisses it.
8. **Banner dismiss:** click × → gone this session; clear `localStorage` or wait 7 days → back.

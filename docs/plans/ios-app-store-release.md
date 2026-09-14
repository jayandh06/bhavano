# Shipping Bhavano to the iOS App Store

## Where things already stand

The mobile app is further along than a first release usually is. `apps/mobile` is Expo SDK 57
with expo-router, and the release plumbing exists:

| Thing | State |
|---|---|
| `bundleIdentifier` | `com.finfolia.bhavano` |
| EAS project id | set in `app.config.js` `extra.eas` |
| `eas.json` | development / preview / production profiles, `autoIncrement`, `submit.production` stub |
| App icon | `./assets/icon.png` |
| `ITSAppUsesNonExemptEncryption` | `false` — skips the export-compliance questionnaire each build |
| Location permission string | set via the `expo-location` plugin |
| Photos permission string | set via the `expo-image-picker` plugin |
| Maps | iOS uses Apple Maps, so no extra credential is needed (Android's key is separate) |
| Privacy policy URL | `/privacy` is live — required for submission |

So this is not a build problem. **It is two App Store policy problems**, both of which are
guaranteed rejections rather than judgement calls.

---

## Blocker 1 — Sign in with Apple (Guideline 4.8)

`HomeSheetsProvider.tsx` offers Google sign-in. App Review requires that an app offering a
third-party login also offers an equivalent privacy-preserving option, and Sign in with Apple is
the one everybody uses to satisfy it.

This is not negotiable and it is checked on the first review. Shipping without it wastes a review
cycle.

**Work:**

1. `expo-apple-authentication`, plus `usesAppleSignIn: true` under `ios` in `app.config.js`.
2. A `POST /auth/apple` on the BFF mirroring `loginWithGoogle` — verify the identity token against
   Apple's public keys, then the same `upsert` + `issueSession`.
3. A schema field for the Apple subject id, mirroring `googleId`.
4. Apple button in the mobile login sheet, shown **above** Google (Apple requires equal or better
   prominence).

**Two things specific to Apple that will bite:**

- **Private Relay addresses.** A user can hide their real address, and Apple returns
  `…@privaterelay.appleid.com`. That is a real, deliverable address, so it is fine to store — but
  it will not match their Google account, which means the account-linking work in
  `account-linking-phone-and-email.md` cannot merge the two automatically. Expect Apple signups to
  produce a third account shape. **It also has to actually be deliverable**: Apple only forwards
  mail to a Private Relay address from sending domains registered as an "Email Source" against the
  Sign in with Apple Services ID in the developer portal — `SMTP_FROM`'s domain (`bhavano.com`)
  needs to be added there before shipping, or every transactional email
  (`NotificationsService.dispatchEmailPreferWhatsapp` — welcome, ad-posted, etc.) to a
  Private-Relay user silently never arrives, with no bounce to notice it by.
- **Name and email are returned only on the FIRST authorisation, ever.** Re-installing or
  re-authorising returns the subject id alone. If the first response is not persisted, that user
  has no name and no email forever. This is the single most common Sign in with Apple bug.

**Update: built, not sidestepped.** An earlier pass briefly hid Google entirely on iOS instead
(phone-OTP-only, sidestepping 4.8 rather than satisfying it) — reverted in favour of the real
thing: Sign in with Apple now sits above Google on iOS, exactly per the "Work" list above.

- `expo-apple-authentication` installed, `usesAppleSignIn: true` set. The login sheet renders
  Apple's own `AppleAuthenticationButton` (not a custom one — their HIG requires either that or a
  button matching its design exactly) above the existing Google button on iOS only
  (`Platform.OS === "ios"`); Android/web are unchanged.
- `POST /auth/apple` (`AuthService.loginWithApple`) verifies the identity token against Apple's
  JWKS (`AppleProvider`, via `jwks-rsa` + the already-present `jsonwebtoken` — no equivalent to
  `google-auth-library` exists for Apple) and mirrors `loginWithGoogle`'s upsert/adopt/create
  logic, with the two Apple-specific differences called out above actually handled: `fullName` is
  captured client-side from `signInAsync()`'s one-time response and forwarded to the BFF (never
  re-derived from the token, which never carries a name at all), and an existing user's
  email/name are only ever updated when Apple actually supplies them that call, never blanked by
  a later, name-less login.
- `User.appleId` added (migration `20260914095752_add_apple_login`), mirroring `googleId`
  end-to-end: released on account deletion and on the losing side of a merge
  (`account-deletion.service.ts`, `account-merge.service.ts`), carried onto the winner the same
  way.
- **Confirmed working on a real device** (2026-09-14) — the button renders, the native Apple sheet
  completes, and a session comes back from `POST /auth/apple`.
- **Still genuinely open, not yet done:** registering `bhavano.com` as an Apple "Email Source" for
  Private Relay deliverability (see the bullet above) — that's Apple Developer Portal
  configuration, not code, and nothing here does it automatically.

## Blocker 2 — In-app account deletion (Guideline 5.1.1(v))

Any app that lets you create an account must let you **initiate deletion from inside the app**.
Pointing at support does not satisfy it — and today that is exactly what we do:

- `privacy/page.tsx`: "to have your account and data deleted, contact us"
- `terms/page.tsx`: "ask us to delete your account"

There is no deletion endpoint anywhere in `apps/bff`.

**This collides with a decision already recorded.** `account-linking-phone-and-email.md` states a
user row is never hard-deleted, for good reasons: it is the audit trail behind payments and
listings, and it makes a bad merge recoverable. That rule was written about *merges*, and the same
doc already carves out the exception:

> A **data erasure request** under India's DPDP Act still has to be honoured… Soft delete is the
> default for merges and account closure; a genuine erasure request is a separate, deliberate path.

Account deletion is that path. It is also the same feature the DPDP Act requires, so this is one
piece of work satisfying two obligations.

**Work:**

1. `DELETE /users/me`, authenticated, requiring a fresh OTP or emailed code — deletion is
   irreversible and must not be a single mis-tap.
2. Anonymise rather than drop rows: null `name`/`email`/`phone`/`googleId`, set a `deletedAt`,
   and deactivate their listings. Payments keep their `userId` for financial audit but the account
   they point at no longer identifies anyone.
3. Release the identifiers, exactly as the merge does, so the number can be reused.
4. UI in `/profile` on both web and mobile, with a confirmation stating what is removed.
5. Grace period worth considering: mark deleted immediately, purge after 30 days.

Apple accepts anonymisation where records must be retained for legal or financial reasons,
provided the account is genuinely unusable and the personal data is gone.

**Update: item 4's mobile half now landed.** `DELETE /users/me` (item 1) and web's `/profile` UI
(item 4, web half) already existed — the mobile Account screen had no equivalent at all,
completely missing rather than a simplified version. `apps/mobile/app/(tabs)/account.tsx` now has
the same OTP/emailed-code-gated flow as web's `ProfileForm`, calling the same endpoint
(`deleteAccount` added to `apps/mobile/src/lib/bffClient.ts`). No BFF change needed — items 2/3
(anonymise, release identifiers) were already implemented for web's callers of the same endpoint.

---

## Also required before submitting

**Missing permission strings — checked, not actually a gap.** `expo-image-picker` declares
`photosPermission` but not `cameraPermission`; the app never calls `launchCameraAsync` or uses
`expo-camera` anywhere, on either platform — video, like photos, only ever goes through
`launchImageLibraryAsync` (picking an existing file, not recording one), so there's no live
camera/microphone flow for `cameraPermission`/`NSMicrophoneUsageDescription` to cover. Android's
`RECORD_AUDIO` is a picker/media-pipeline requirement for handling a video file that already has
an audio track, not evidence of live recording. Nothing to add here.

**`supportsTablet` — already resolved.** `app.config.js` has it `false`, so no iPad screenshots
are needed and there's no broken-tablet-layout risk to worry about.

**Privacy nutrition labels.** App Store Connect asks, per data type, what is collected and whether
it is linked to identity. Bhavano collects: phone, email, name, approximate and precise location,
photos, and usage data via GTM/GA4. **The GTM container matters here** — Google Analytics and Ads
conversion tags collect identifiers for tracking, which means the App Tracking Transparency
question needs a truthful answer. Declaring "no tracking" while shipping Ads conversion tags is
the kind of mismatch that gets an app pulled after release.

**Demo account for App Review — largely solved by Sign in with Apple.** Phone OTP alone was a
real problem: reviewers can't receive an Indian SMS, `9999999999` is a local-dev-only seed (never
exists in prod), and there's no OTP bypass/fixed-code path in `OtpService` (`devLogin` exists but
is hard-gated off outside `NODE_ENV !== 'production'`). Sign in with Apple now sidesteps all of
that — a reviewer signs in with their own Apple ID, straight to a real working account, no
Indian phone number or bypass code involved. Still worth a line in the review notes pointing this
out explicitly (reviewers don't know to try it otherwise), but this is no longer the login-screen
stall it used to be.

**Screenshots** for 6.7" and 6.5" iPhone only — `supportsTablet: false` (see above) means no iPad
set is needed.

**Support URL and marketing URL**, plus the developer name reading **Finfolia Technologies LLP**
to match `app.config.js`'s comment and `docs/plans/finfolia-entity-disclosure.md`.

## Build and submit

```
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

EAS can manage the signing certificates and provisioning profile itself, which is the path of
least resistance on a new developer account. `appVersionSource: "remote"` plus `autoIncrement`
already means build numbers are handled.

Fill in `submit.production` with `appleId`, `ascAppId` and `appleTeamId` once the app record
exists in App Store Connect, so submission does not prompt each time.

## Suggested order

1. **Sign in with Apple** and **account deletion** — both are certain rejections, so nothing else
   matters until they exist.
2. Permission strings; drop `supportsTablet` unless iPad is genuinely being tested.
3. TestFlight internal build. Exercise phone OTP on a real device — MSG91 delivery has its own
   history (see `msg91-sms-otp-activation.md`) and it has never run from an iOS client.
4. Privacy labels and the ATT decision, honestly reflecting the GTM tags.
5. Screenshots, review notes with demo credentials, submit.

## Out of scope

- Android/Play release — shares the Apple Sign In and deletion work but has its own review rules.
- Push notifications — none configured, and adding them brings its own capability and permission
  requirements.
- In-app purchases. Boosts and subscriptions currently go through Razorpay. **If they are sold
  inside the iOS app for digital promotion of a listing, Apple will require its own in-app
  purchase and take a commission.** Worth deciding deliberately before review rather than
  discovering it in a rejection: the usual approach is to keep purchases web-only and not link to
  them from the app.
  **Update: decided.** A native Android Razorpay boost flow was built
  (`apps/mobile/src/components/home/BoostModal.tsx`) before this note was cross-checked against
  it — caught before submission, not after. `PostAdWizard.tsx`'s "Boost this listing" now branches
  on `Platform.OS`: iOS opens the website (this section's original recommendation, unchanged for
  that platform); Android opens the native checkout. Real StoreKit in-app purchase for iOS boosts
  remains unbuilt — this is a workaround, not a resolution, if boosts are meant to work natively
  on iOS eventually.

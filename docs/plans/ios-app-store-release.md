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
  produce a third account shape.
- **Name and email are returned only on the FIRST authorisation, ever.** Re-installing or
  re-authorising returns the subject id alone. If the first response is not persisted, that user
  has no name and no email forever. This is the single most common Sign in with Apple bug.

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

---

## Also required before submitting

**Missing permission strings.** `expo-image-picker` declares `photosPermission` but not
`cameraPermission`. If any flow reaches the camera, iOS shows a blank prompt and App Review
rejects it. Android already requests `RECORD_AUDIO`, which suggests video capture is intended —
if that ships on iOS it needs `NSMicrophoneUsageDescription` too. Declare only what is actually
used; an unused permission string is its own rejection reason.

**Privacy nutrition labels.** App Store Connect asks, per data type, what is collected and whether
it is linked to identity. Bhavano collects: phone, email, name, approximate and precise location,
photos, and usage data via GTM/GA4. **The GTM container matters here** — Google Analytics and Ads
conversion tags collect identifiers for tracking, which means the App Tracking Transparency
question needs a truthful answer. Declaring "no tracking" while shipping Ads conversion tags is
the kind of mismatch that gets an app pulled after release.

**Demo account for App Review.** Reviewers must reach the whole app. Phone OTP is a problem: they
cannot receive an Indian SMS. Provide a test account with credentials in the review notes, or a
bypass code, or the review stalls on the login screen. `ADMIN_PHONES` and the existing
`9999999999` test account are a starting point.

**Screenshots** for 6.7" and 6.5" iPhone, and iPad if `supportsTablet` stays `true`. It is
currently true — either produce iPad screenshots and verify the layouts, or set it to `false`.
Shipping a broken iPad layout is an easy rejection.

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

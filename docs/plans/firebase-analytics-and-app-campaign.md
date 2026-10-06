# Firebase Analytics in the mobile app, as the prerequisite for a Google Ads App Campaign

## Status: verified end-to-end on a real device (2026-10-06) — Phase 2's production build next

**Update (final verification):** `post_ad_success` confirmed live in Firebase Analytics'
Realtime report after a real test post on a physical Android device (`screen_view`,
`user_engagement`, and `post_ad_success: 1` all showing). The full chain — native module linked,
Analytics enabled on `finfolia`, event fired at the right point in the posting flow, event
reaching GA4 — works. Two real snags hit and fixed along the way, worth keeping in mind for the
next build on this app:
- The first dev-client install was a **stale binary** (predated the Firebase native module),
  producing `Native module NativeRNFBTurboApp is not registered` — fixed by a clean reinstall
  from the new EAS build, not a code change. Any future "native module not registered" error on
  this app should prompt checking for a stale installed build before assuming a real bug.
- Local `apps/mobile/.env` was missing `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (present in EAS's cloud
  "development" environment used at build time, but not in the local file Metro reads for
  `expo start`) — added, value pulled from the root `.env`'s `GOOGLE_CLIENT_ID` (same OAuth
  client, per `.env.example`'s own comment).

**Update:** Phase 0 done — iOS app registered in `finfolia` (bundle `com.finfolia.bhavano`),
`GoogleService-Info.plist` added at `apps/mobile/GoogleService-Info.plist`. Google Analytics is
now confirmed enabled on the project (the plist originally showed `IS_ANALYTICS_ENABLED: false`,
since resolved).

Phase 1 done: `@react-native-firebase/app`/`analytics` installed (`npx expo install`, two
postinstall scripts from transitive deps — `@firebase/util`, `protobufjs` — approved via
`pnpm approve-builds`, recorded in `pnpm-workspace.yaml`'s existing `allowBuilds`); plugin +
both platforms' `googleServicesFile` wired in `app.config.js`; new
`apps/mobile/src/lib/firebaseAnalytics.ts` (`logPostAdSuccess`, modular v26 API —
`@react-native-firebase/analytics` dropped the old namespaced `analytics()` default export, now
`getAnalytics()` + a free `logEvent()`); called from `PostAdWizard.tsx`'s `onSubmit()` right
after the pending-checkout branch resolves, right before `setStep("success")`. `tsc --noEmit`
clean, full Jest suite 67/67 passing.

Next: Phase 2's production build + Play Store submission (via the `.github/workflows/
mobile-build.yml` GitHub Actions path, per the user's call earlier), then Phase 3 (link Firebase/
GA4 to Google Ads), then Phase 4 (the App campaign itself with the competitor-audience signal).

## Context

The original ask was "how do I get Bhavano shown as a similar app to 99acres/Housing.com/
NoBroker on Android" — that carousel is Google's own algorithmic recommendation with no
developer-facing control, but the legitimate equivalent lever is a **Google Ads App Campaign
(UAC)** using a **custom audience signal** built from those competitor apps.

Checked the account and repo: no App campaign, no custom audience, and no app-install
conversion tracking exist today. More importantly, `docs/plans/drive-users-to-android-app.md`
(item 7, written 2026-10-05, before this conversation) already anticipated this exact request
and deliberately deferred it:

> "Google Ads App campaign only after in-app conversion tracking (Firebase / GA4 'Post ad
> success') exists; otherwise Smart Bidding optimises for installs, not posters."

That tracking was never built. Launching a UAC campaign without it means Smart Bidding has
nothing to optimize toward except raw install count — it will spend budget on installs from
people who never register or post, which defeats the actual goal. This plan builds that missing
prerequisite properly, per the user's explicit choice over the faster-but-worse "installs-only"
stopgap.

### What already exists (reusable, no new Firebase project needed)

- A Firebase project, **`finfolia`** (project number `6542522926`), already has an Android app
  registered for `com.finfolia.bhavano` — `apps/mobile/google-services.json`, referenced via
  `android.googleServicesFile` in `apps/mobile/app.config.js`. Currently used only for FCM push
  (`expo-notifications`), not Analytics — Analytics has never been enabled on this project.
- `apps/mobile/app.config.js` already has an explicit code comment that Firebase mode was
  deliberately avoided for a different plugin (`@react-native-firebase`-style config "needs a
  google-services.json this repo has never had any reason to set up") — that reasoning no longer
  holds once this plan lands; worth a one-line comment update when editing that file.
- This is an Expo SDK 57, Continuous Native Generation (CNG) project — `apps/mobile/ios/` and
  `android/` are gitignored and regenerated per build, never hand-edited. Firebase goes in via
  the standard Expo config-plugin install (`npx expo install @react-native-firebase/app
  @react-native-firebase/analytics`), the same pattern already used for `react-native-maps` and
  `@react-native-google-signin/google-signin` in this file — no manual native edits.
- The exact client-side "post ad success" moment is known: `onSubmit()` in
  `apps/mobile/src/components/home/PostAdWizard.tsx`, right at `setStep("success")` (~line 1313),
  once the created `listing` is in hand.
- The existing fire-and-forget analytics pattern to mirror:
  `apps/mobile/src/lib/analyticsSession.ts`'s exported async functions (e.g.
  `recordAppPageView`) — try/catch wrapped, called with `void` at the call site, never blocking
  the UI or throwing into it.
- Event naming should match the web/BFF side already in place (`EVENT_FOR` mapping in
  `apps/bff/src/notifications/...` and the GA4 dataLayer push on web): **`post_ad_success`** —
  same name, so this isn't a fourth, differently-named signal to reconcile later.

### iOS gap (blocks Phase 1 until resolved — user's call, confirmed)

No `GoogleService-Info.plist` exists anywhere in the repo, and the `finfolia` Firebase project's
`google-services.json` only has an Android app registered — no iOS app. Since this app also
ships to iOS (`eas.json` has a configured App Store Connect submit profile, i.e. iOS is an
actively released platform, not dormant), adding the Firebase SDK without an iOS config file
risks breaking the next iOS build. **User's decision: register an iOS app in the `finfolia`
Firebase project first, get the resulting `GoogleService-Info.plist`, and only then start the
code changes below for both platforms together.**

## Phase 0 — external prerequisite (not something I can do from here)

1. In the Firebase console, open the **`finfolia`** project → Project settings → add an iOS app,
   bundle ID **`com.finfolia.bhavano`** (matches `ios.bundleIdentifier` in `app.config.js`).
2. Download the generated `GoogleService-Info.plist`.
3. Also use this moment to **enable Google Analytics** on the `finfolia` project if prompted (or
   separately via Project settings → Integrations → Google Analytics) — needed regardless of
   platform, since Analytics isn't enabled on this Firebase project at all yet.
4. Hand me the `GoogleService-Info.plist` file (or drop it at
   `apps/mobile/GoogleService-Info.plist`) — that's the signal Phase 1 can start.

## Phase 1 — code changes (once Phase 0's plist exists)

1. **Install**: `npx expo install @react-native-firebase/app @react-native-firebase/analytics`
   in `apps/mobile`.
2. **`apps/mobile/app.config.js`**:
   - Add `"@react-native-firebase/app"` to the `plugins` array (alongside the existing
     `react-native-maps`/Google Sign-In entries).
   - Add `ios.googleServicesFile: "./GoogleService-Info.plist"` next to the existing
     `android.googleServicesFile: "./google-services.json"`.
   - Update the stale comment on the Google Sign-In plugin that says this repo "has never had
     any reason to set up" a Firebase-mode `google-services.json` — it does now.
3. **New file** `apps/mobile/src/lib/firebaseAnalytics.ts` — one small exported function,
   shaped exactly like `analyticsSession.ts`'s pattern:
   ```ts
   export async function logPostAdSuccess(params: {
     category: string;
     transactionType: string;
   }): Promise<void> {
     try {
       await analytics().logEvent("post_ad_success", params);
     } catch {
       // Best-effort, same stance as recordAppPageView — never affects the posting flow.
     }
   }
   ```
4. **Call site**: in `PostAdWizard.tsx`'s `onSubmit()`, right at `setStep("success")`, add
   `void logPostAdSuccess({ category: listing.category, transactionType: listing.transactionType });`
   — fire-and-forget, matches every other analytics call in this file's surrounding code.
5. No BFF or web changes — this is mobile-only, additive, and doesn't touch the existing
   server-side `post_ad_success` GTM/Ads conversion plumbing described in
   `docs/plans/server-side-google-ads-conversion-upload.md` (that's for web; this is the app's own
   independent signal, which is exactly what a Firebase/GA4-for-Firebase link needs).

## Phase 2 — build and verify (outside this coding session)

1. `eas build --profile development --platform android` (and `ios`, now that the plist exists)
   to get a real native build with the Firebase SDK compiled in — CNG means the plugin can't take
   effect via OTA/JS-only update.
2. Verify the event actually fires: Firebase Console → Analytics → DebugView (enable debug mode
   per-device: `adb shell setprop debug.firebase.analytics.app com.finfolia.bhavano` on Android,
   or the iOS equivalent launch argument) while completing a real test post in the dev build.
3. Ship a production build and submit to the Play Store. Note: `eas.json`'s `submit.production`
   block only has an `ios` entry today — there's no Android submit automation, so the `.aab` goes
   to Play Console manually unless an Android submit profile is added separately (out of scope
   here unless asked for).

## Phase 3 — link Firebase/GA4 to Google Ads (outside this coding session)

In the Google Ads UI: Tools & Settings → Linked accounts → Google Analytics (GA4) → link the
`finfolia` property. This is an account-linking/consent flow, not something scriptable headlessly
through the Ads API from here.

## Phase 4 — the actual App Campaign (follow-up task, after Phase 3 is live)

Once linked and `post_ad_success` has real volume flowing in from the app:
- Build a **Custom Audience** signal (via `CustomAudienceService`, same `ads_*.py` scripting
  pattern used throughout this repo) seeded with 99acres/Housing.com/NoBroker as app/interest
  signals.
- Create the App campaign (`advertising_channel_type = MULTI_CHANNEL`,
  `advertising_channel_sub_type = APP_CAMPAIGN`), app ID `com.finfolia.bhavano`, bidding toward
  **installs + `post_ad_success`** (not installs alone — the whole point of this plan), the new
  audience signal attached, budget sized similarly to the existing poster campaigns (₹300–900/day)
  to start as a pilot.
- This is its own follow-up plan/script once Phase 3 is confirmed live — not written now, since
  its exact shape (budget, audience breadth, which conversion goal) deserves its own sign-off
  once there's real `post_ad_success` data to look at, the same discipline already applied to
  every other campaign change in this account this session.

## Verification (for Phase 1, once built)

- Firebase DebugView shows `post_ad_success` with `category`/`transactionType` params after a
  real test post in a dev build.
- `npx tsc --noEmit` / the mobile app's existing Jest suite still passes after the new file and
  call site are added (no behavior change to the posting flow itself, purely additive).

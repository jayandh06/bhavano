# Mobile CI: EAS, GitHub Actions and Codemagic, used interchangeably

Status: **multi-provider setup added.** GitHub Actions Android `development` verified 2026-09-27
(run #1, ~20 min; APK installed, loads from local Metro, Google sign-in works). Android `production` verified (run #3, versionCode 11, after the Gradle
Metaspace fix). Still untested: iOS, `submit`, Codemagic. Files:
`.github/workflows/mobile-build.yml`, `codemagic.yaml` (repo root). Builds can run on whichever
provider still has free quota this month: EAS cloud, GitHub Actions or Codemagic. Every provider
produces the same binary, and version numbers never collide or go backwards.

## Decision: one build-number counter, owned by EAS

Play rejects an AAB whose `versionCode` isn't higher than every one already uploaded. TestFlight
does the same for iOS `buildNumber` within a version. With three providers, each keeping its own
count would clash immediately. So there is exactly **one counter: EAS remote versioning**
(`"appVersionSource": "remote"` + `"autoIncrement": true` on the `production` profile, already in
`apps/mobile/eas.json`).

All three providers run the **same command**, so they all go through that counter:

| Provider | Command | Uses EAS build credits? |
|---|---|---|
| EAS cloud (expo.dev) | `eas build -p <platform> --profile <profile>` | yes |
| GitHub Actions | `eas build --local …` (`mobile-build.yml`, manual dispatch) | no, uses Actions minutes |
| Codemagic | `eas build --local …` (`codemagic.yaml`, 4 workflows) | no, uses Codemagic minutes |

The CLI fetches and increments the remote number **before** handing off to the cloud or the local
build, so `--local` builds bump the same counter. It also:

- downloads the same signing credentials (Android upload keystore, iOS cert and profiles) from EAS;
- pulls the same EAS environment variables (`EXPO_PUBLIC_*`), so there's one env source of truth;
- sets the same OTA channel from the profile (`development` / `preview` / `production`), so
  `eas update` reaches binaries from any provider.

Properties that follow:

- **Parallel builds are safe.** Two providers building at once each get a distinct number from
  the server.
- **Failed builds leave gaps** (the number was already taken). Gaps are harmless; stores only
  require the number to go up.
- **Only `production` increments.** `development` / `preview` builds reuse the current remote
  value. They're installed directly, not uploaded to a store, so duplicate numbers don't matter.

### The one rule

**Never build a store binary any other way** (plain Gradle/Xcode, fastlane `gym` without EAS,
Android Studio "Generate signed bundle"). That bypasses the counter. If it happens anyway, move the
counter above whatever was uploaded before the next build:

```bash
cd apps/mobile
npx eas-cli build:version:get -p android   # and -p ios
npx eas-cli build:version:set -p android   # prompts for the new value
```

Always run EAS commands from `apps/mobile/`. Running them from the repo root creates a stray root
`eas.json` / `app.json` and prompts for a different package name.

### Rejected alternatives

- **Next number from the stores** (fastlane `google_play_track_version_codes` max + 1,
  `latest_testflight_build_number` + 1). Works across providers, but it races when two builds run
  at once. TestFlight also lags while a build is processing, so back-to-back builds can pick the
  same number.
- **Timestamp numbers** (for example minutes since 2026-01-01). No coordination needed, but EAS
  cloud builds would have to switch to `appVersionSource: local` with a dynamic `app.config.js`
  value. Not worth it while EAS already provides an atomic counter. It's the fallback if the Expo
  account is ever dropped (Option B below).

### One-time setup per provider

1. **Expo robot token.** expo.dev → account → Access tokens → create a robot token with access to
   the `bhavano` project.
   - GitHub: repo → Settings → Secrets → Actions → `EXPO_TOKEN`.
   - Codemagic: add the app from GitHub → Environment variables → group **`expo`** →
     `EXPO_TOKEN` (secure). Codemagic reads `codemagic.yaml` from the repo root.
2. **Store-upload keys in EAS** (only for `submit`), so no key file path is needed on the runner:
   - Android: `npx eas-cli credentials -p android` → production → Google Service Account → upload
     the Play API JSON key for submissions. (Play Console → Setup → API access, with release
     permission on Bhavano.)
   - iOS: `npx eas-cli credentials -p ios` → App Store Connect API Key → add `6KPL9BLM97`. Then
     remove `ascApiKeyPath` / `ascApiKeyId` / `ascApiKeyIssuerId` from `submit.production.ios` in
     `eas.json` (keep `ascAppId`). The current path exists only on one Mac, so CI submits fail
     until this is done.
3. **`preview` EAS environment is empty.** Before building the `preview` profile anywhere, copy the
   vars into it (`eas env:set --environment preview …`) or point the profile at another
   environment with `"environment": "production"` in `eas.json`.

### How to run

- **GitHub Actions:** Actions → *Mobile build* → Run workflow → pick platform, profile, and
  optionally `submit` (production only). The binary is attached to the run as an artifact for
  14 days.
- **Codemagic:** Start new build → workflow `android-development`, `android-production`,
  `ios-development` or `ios-production`. The production workflows also run `eas submit` (Play
  internal track / TestFlight). The binary is in the build's artifacts.
- **EAS cloud:** as before, from `apps/mobile`: `npx eas-cli build -p android --profile production`.

### Picking a provider each month

Check each provider's current free allowance before relying on it; the tiers change. Rules of
thumb:

- iOS builds need macOS. GitHub bills macOS minutes at a multiple of Linux minutes on private repos,
  and Codemagic's free minutes are macOS-capable, so Codemagic is usually the better free home for
  iOS.
- Android builds run on Linux, so GitHub Actions is the cheap default for them.
- Keep EAS cloud for when both are exhausted, or when a build fails only on CI and you need Expo's
  build logs to compare.

## Why

- EAS Build overage is already running (51+ builds beyond included credits this period).
- Builds triggered from a laptop are fragile (Windows shells, forgotten env vars). The Android
  Google sign-in failure on 2026-09-27 was one: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` existed only in
  `.env.example` and was never added to the EAS environments, so every EAS build shipped without it.
  CI with one declared source of env vars removes that class of mistake.

## Facts this plan depends on

| Thing | Value today | Owner today |
|---|---|---|
| Android package / iOS bundle id | `com.finfolia.bhavano` | `app.config.js` |
| App version | `1.0.0` (`runtimeVersion.policy: appVersion`) | `app.config.js` |
| Android `versionCode` | 9 (last production AAB) | **EAS remote** (`appVersionSource: remote`, `autoIncrement`) |
| iOS `buildNumber` | 16 | **EAS remote** |
| Android upload keystore | "Build Credentials q9HS2gLSc4" | **EAS credentials** |
| iOS dist cert + profiles | Team `L6RKCXT9K4`, profile `P5A49T4322` (ad hoc) | **EAS credentials** |
| App Store Connect API key | Key `6KPL9BLM97`, issuer `9df5bb28-…`, app `6811878602` | `eas.json` `submit.production.ios` (path on a Mac) |
| OTA channel | `development` / `preview` / `production` | set **by EAS Build** from the `eas.json` profile |
| Public env (`EXPO_PUBLIC_*`) | BFF URL, Google iOS + Web client IDs, Maps key, `USE_RN_FETCH` | **EAS environments** |
| Native dirs | not in git; `expo prebuild` generates them | CNG |
| `google-services.json` | committed in `apps/mobile/` | repo |

Everything marked **EAS** has to be exported or replaced before CI can build without EAS.

## Two ways to do it

### Option A (chosen, implemented above): `eas build --local` on GitHub runners and Codemagic

`eas build --platform <p> --profile <profile> --local --non-interactive` runs the exact EAS
pipeline on the runner: prebuild, remote credentials download, remote version bump, env pull,
channel. For iOS it uses fastlane underneath. **Local builds don't use EAS build credits.** Upload
with `eas submit` or fastlane `supply` / `pilot`.

- Nothing to migrate: keystore, certs, version numbers and env vars all stay in EAS.
- Needs only an `EXPO_TOKEN` (robot token) secret, plus the store-upload credentials.
- Still tied to Expo's account/CLI for credentials, but not its build minutes.

### Option B: plain fastlane (full control, no EAS Build at all). Not planned

The rest of this doc. More setup, but each piece (signing, versioning, uploads) is explicit and
lives in the repo or GitHub secrets.

**Conflicts with the multi-provider decision.** Option B builds bypass the EAS counter, so Option B
and EAS/`--local` builds can't be mixed. Adopt it only if leaving Expo entirely, and then move
**every** provider to it together, with a coordination-free numbering scheme (timestamp, see
"Rejected alternatives").

---

## Option B, step by step

### Phase 0: one-time exports (do these before touching CI)

1. **Android upload keystore.** `cd apps/mobile && npx eas-cli credentials -p android` →
   production → Keystore → Download. Keep the `.jks`, store password, key alias and key password.
   This is the upload key Play already trusts. **A different key will be rejected by Play**
   (recoverable only through Play's upload-key reset, which takes days). Store it:
   - `ANDROID_KEYSTORE_BASE64` (base64 of the `.jks`)
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
2. **Play Console API access.** Play Console → Setup → API access → link a Google Cloud project →
   service account with release permissions on the Bhavano app → JSON key →
   `PLAY_SERVICE_ACCOUNT_JSON`. The Play API cannot create the app or its first release; one AAB
   must already have been uploaded manually (internal testing counts).
3. **App Store Connect API key.** Reuse `AuthKey_6KPL9BLM97.p8` →
   `ASC_KEY_ID=6KPL9BLM97`, `ASC_ISSUER_ID=9df5bb28-4ddb-4a83-a90f-b85224c93dad`,
   `ASC_KEY_P8_BASE64`.
4. **iOS signing with fastlane `match`.** Create a private repo (e.g. `bhavano-ios-certs`) and a
   `MATCH_PASSWORD`. Then either:
   - `fastlane match import` the existing distribution cert (`.p12` downloadable via
     `eas credentials -p ios`), or
   - let `match appstore` / `match adhoc` create a new cert. Apple allows more than one
     distribution cert; existing installed builds keep working.
   Profiles needed: `appstore` (TestFlight/App Store) and `adhoc` (installable dev-client builds on
   registered devices; the iPhone `00008120-0001149C348BC01E` is already registered). The App ID
   already has Push and Sign in with Apple enabled, so `match` profiles inherit them.
   CI needs `MATCH_GIT_URL`, `MATCH_PASSWORD`, and a deploy key or token with read access to the
   certs repo (`MATCH_GIT_BASIC_AUTHORIZATION`).
5. **Public env vars: pick ONE source of truth.** Either:
   - keep EAS environments and run `npx eas-cli env:pull <env>` in CI (needs `EXPO_TOKEN`), or
   - move them to GitHub **Environments** (`development`, `production`) as variables.
   Don't keep both; drift between them is exactly how the web client ID went missing.
   Required: `EXPO_PUBLIC_BFF_URL`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`,
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` (read at **prebuild**
   time by the `react-native-maps` plugin, not only at bundle time), `EXPO_PUBLIC_USE_RN_FETCH=1`.

### Phase 1: repo changes

1. **Version numbers from CI**, in `apps/mobile/app.config.js`:
   - `android.versionCode: Number(process.env.ANDROID_VERSION_CODE) || undefined`
   - `ios.buildNumber: process.env.IOS_BUILD_NUMBER || undefined`
   fastlane computes these (below) and exports them **before** `expo prebuild`, since prebuild writes
   them into `build.gradle` / `Info.plist`. First CI builds must be **> 9** (Android) and
   **> 16** (iOS).
2. **OTA channel outside EAS Build.** EAS Build currently injects the channel. Without it, set
   `updates.requestHeaders: { "expo-channel-name": process.env.APP_CHANNEL ?? "development" }` in
   `app.config.js`, and export `APP_CHANNEL=production` for store builds. Otherwise store builds
   won't receive `eas update` pushes.
3. **fastlane files** under `apps/mobile/`: `Gemfile` + `Gemfile.lock` (pin fastlane, add
   `fastlane-plugin-firebase_app_distribution` if used), `fastlane/Appfile`, `fastlane/Fastfile`,
   `fastlane/Matchfile`.
4. Leave `eas.json` in place for `eas update` and as a fallback until CI builds are proven.

### Phase 2: lanes (`apps/mobile/fastlane/Fastfile`)

Every lane starts from a clean checkout. `android/` and `ios/` don't exist until prebuild.

**Android**

- `android dev` (dev client): `npx expo prebuild -p android --clean` →
  `gradle(task: "assemble", build_type: "Debug", project_dir: "android")` → upload the APK as a
  workflow artifact or to Firebase App Distribution. Debug-signed, installable by testers, loads
  JS from Metro like today's EAS `development` builds.
- `android internal` (store): version code =
  `max(google_play_track_version_codes(track: "internal"), …production) + 1` → export
  `ANDROID_VERSION_CODE` → prebuild → `gradle(task: "bundle", build_type: "Release")` with the
  upload key passed as injected properties (`android.injected.signing.store.file`,
  `…store.password`, `…key.alias`, `…key.password`). No change to the generated `build.gradle` is
  needed → `upload_to_play_store(track: "internal", aab: …)`.
- Promote internal → production in Play Console, or add `android promote` using
  `upload_to_play_store(track: "internal", track_promote_to: "production")`.

**iOS** (macOS runner)

- `ios dev` (dev client, ad hoc): `app_store_connect_api_key` → `match(type: "adhoc", readonly: true)`
  → `npx expo prebuild -p ios --clean` (runs `pod install`) → `update_code_signing_settings`
  (manual signing, match profile) → `gym(workspace: "ios/Bhavano.xcworkspace", scheme: "Bhavano",
  configuration: "Debug", export_method: "ad-hoc")` → artifact / Firebase App Distribution.
- `ios beta` (store): API key → `match(type: "appstore", readonly: true)` → build number =
  `latest_testflight_build_number + 1` → export `IOS_BUILD_NUMBER`, `APP_CHANNEL=production` →
  prebuild → signing settings → `gym(configuration: "Release", export_method: "app-store")` →
  `upload_to_testflight(skip_waiting_for_build_processing: true)`.

### Phase 3: GitHub Actions workflows

Two workflow files, `.github/workflows/mobile-android.yml` and `mobile-ios.yml`, each with a
`dev` and a `production` job selected by input.

- **Triggers:** `workflow_dispatch` (input: `dev` | `production`); optionally dev on pushes to
  `master` touching `apps/mobile/**` or `packages/types/**`; production on tags `mobile-v*`.
- **Production job** uses a GitHub Environment `production` with required reviewers, so a store
  upload always needs an explicit approval.
- **Common steps:** checkout → `pnpm/action-setup` → `actions/setup-node` (Node 22, pnpm cache) →
  `pnpm install --frozen-lockfile` at the repo root → `pnpm --filter @bhavano/types build`
  (mobile imports its `dist`) → load env (Phase 0 step 5) → `ruby/setup-ruby` with
  `bundler-cache: true`, `working-directory: apps/mobile` → `bundle exec fastlane <platform> <lane>`.
- **Android runner:** `ubuntu-latest`, `actions/setup-java` (Temurin 17), Gradle cache.
- **iOS runner:** `macos-15`, select the Xcode version Expo SDK 57 requires, CocoaPods cache keyed
  on the generated `Podfile.lock`.
- `concurrency: mobile-${{ platform }}-${{ lane }}` so double-clicks don't produce two builds.

### Phase 4: cutover checklist

1. Run `android internal` from CI → confirm versionCode 10 lands on the internal track, installs,
   and **Google sign-in works** (proves the web client ID reached the bundle).
2. Run `ios beta` → confirm the build appears in TestFlight, Sign in with Apple and push still work.
3. Publish an `eas update --channel production` and confirm a CI-built binary picks it up (proves
   the `expo-channel-name` header).
4. Then drop `autoIncrement` / `appVersionSource: remote` from `eas.json` and stop using EAS and
   `--local` builds for store binaries, so the two schemes can't hand out clashing numbers.

## Gotchas

- **Gradle Metaspace in release builds.** The first `production` Android run on GitHub failed in
  `lintVitalAnalyzeRelease` with `java.lang.OutOfMemoryError: Metaspace` (prebuild's default is
  `-Xmx2048m -XX:MaxMetaspaceSize=512m`). `app.config.js` now raises `org.gradle.jvmargs` through
  an inline `withGradleProperties` plugin, so every provider builds with the same limits.

- **pnpm monorepo:** native tooling resolves from `apps/mobile/`, so transitive native deps must be
  direct deps there (README §11). The same failures appear on CI as on EAS.
- **macOS minutes** are billed at a multiple of Linux minutes on private repos; an iOS build is
  roughly 20–30 minutes. Worth comparing against the EAS overage before moving iOS.
- **Development ≠ production binary.** A dev-client (Debug) build can never go to Play or
  TestFlight. Only the `internal` / `beta` lanes produce store builds.
- **Existing production AAB (versionCode 9)** was built before `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  was added to EAS, so Google sign-in on Android fails in that build. Fix it with an `eas update`
  to the `production` channel or a new build.

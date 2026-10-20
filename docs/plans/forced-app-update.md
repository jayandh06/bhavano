# Forced app update (minimum version)

Question (2026-10-20): what happens to Android users on 1.1.0 once 1.2.0 is in production? Nothing,
until they update from the store: OTA updates are tied to the `appVersion` runtime, and the app had
no minimum-version check. This adds one.

## How it works
- **Server setting:** `AppVersionSetting` singleton row (`androidMinVersion`, `iosMinVersion`,
  `message`). Empty string = no minimum, which is the default, so deploying changes nothing until an
  admin sets a value. Migration `20261020150000_app_version_setting`.
- **Public endpoint:** `GET /app-config/version` (`Cache-Control: public, max-age=60`, so a raised
  minimum reaches phones within about a minute).
- **Admin:** *Settings → App update* (`/settings/app-version`) edits the three fields;
  `GET`/`PATCH /admin/app-version-settings`. Versions are validated as `1`, `1.2` or `1.2.0`.
- **Shared logic:** `@bhavano/types/appVersion` (`compareAppVersions`, `isBelowMinAppVersion`). It
  compares numerically (1.10.0 is newer than 1.9.0) and answers "not below" for anything it cannot
  read, so a bad value can never lock people out.
- **App:** `UpdateGate` (root layout) fetches the setting, compares it with the binary's own
  version (`expo-application`'s `nativeApplicationVersion`, which an OTA update never changes) and,
  when below, shows a full-screen non-dismissable `Modal` ("Update required" + a store button). It
  re-checks each time the app returns to the foreground. Android's back button does not close it.
  Fails open: while loading, or if the request fails, nothing is shown.

## What it cannot do
- **Only installs that contain `UpdateGate` can show it.** Versions older than the one that ships
  it (1.1.0 and earlier, and 1.2.0 if it was built before this landed) ignore the setting. It
  protects future minimums, not the installs already out.
- Set a minimum only after the new version is live in the store, or people are sent to update to a
  build they cannot download yet.

## To use it
1. Ship an app version that contains `UpdateGate`, and get it live on both stores.
2. Deploy the BFF (runs the migration), then in admin set the minimum, e.g. Android `1.3.0`.
3. To lift it, empty the box and save.

## Deliberate choices
- No soft "update available" prompt: this is the hard block only. Play's in-app update API was left
  out because it is Android-only and needs a native module; the store button covers both platforms.
- Store links: Android `market://details?id=com.finfolia.bhavano` with the https page as fallback;
  iOS `https://apps.apple.com/app/id6811878602`.

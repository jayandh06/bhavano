# Moving web users to the Android app

Question (2026-10-05): how do we get people to use the Android app instead of desktop or mobile
browsers? Web stays the front door — SEO and every Ads campaign land there — so the aim is to hand
over *returning* and *high-intent* users to the app, never to block the web.

## Current state

- **App Links are half done.** `apps/mobile/app.config.js` has the `autoVerify` intent filter for
  `https://www.bhavano.com`, and `assetlinks.json` is live and verified by Google's Digital Asset
  Links API (package `com.finfolia.bhavano`, SHA-256 `83:E7:…:58:50`). Missing: a **native build**
  carrying the intent filter (OTA can't add it), and confirmation that the fingerprint is the
  **Play App Signing** key (Play Console → Test and release → App integrity), not the upload key.
- **Built 2026-10-05: steps 2 and 4 below** (open-in-app strip, desktop QR) — see "As built".

## Plan, in order of payoff

1. **Ship App Links** (native build + fingerprint check). After that every bhavano.com link —
   WhatsApp shares, Google results, email/SMS notifications — opens the app for anyone who has it.
   Biggest win, no new UI.
2. **Open-in-app strip on Android mobile web** (as specified in `more-login-conversion.md`): thin,
   dismissible, 30-day snooze; opens the same page in the app, falls back to Play Store with a
   `referrer=utm_source=web&utm_medium=banner&utm_campaign=<page>` so installs are attributable. No
   full-screen interstitial — Google demotes intrusive mobile interstitials.
3. **Ask at high-intent moments, with a concrete reason** rather than a generic banner:
   - after posting an ad: "Get enquiry alerts instantly — reply from the app";
   - on contact/chat: "Get the owner's reply as a notification";
   - after saving a search / Instant Alerts: "Be first to see new matches".
4. **Desktop: QR code** on the post-ad success page, My listings, and the footer ("Scan to get the
   app"), same Play referrer.
5. **Notifications point into the app.** Enquiry, approval, and expiry emails/WhatsApp/SMS use
   https links that App Links will open in the app once step 1 ships.
6. **App-only perk (optional):** e.g. a free boost on the first ad posted from the app. Play billing
   rules only constrain *selling* digital goods in-app, not giving a reward.
7. **Paid installs later:** Google Ads App campaign only after in-app conversion tracking (Firebase
   / GA4 "Post ad success") exists; otherwise Smart Bidding optimises for installs, not posters.
8. **Store listing:** in-app review prompt (Play In-App Review API) after a positive moment, e.g.
   first enquiry received.

## Measure

Share of logged-in sessions from the app vs web, Play installs by referrer `utm_campaign`, and
banner CTR / dismiss rate.

## As built (2026-10-05)

- **`OpenInAppStrip`** (root layout): fixed bottom bar on Android browsers only (not in-app
  WebViews), "Open app" → `intent://<app path>#Intent;scheme=bhavano;package=…;S.browser_fallback_url=<Play URL>`
  — opens the same screen in the app, or the Play Store. 30-day dismiss. While visible it sets
  `--app-strip-h`, which pads `<body>` and lifts `ProfileCompletionBanner` / `ListingLoginNudge`
  above it.
  - **Hidden for 30 days after a paid-ad click** (`gclid`/`gbraid`/`wbraid`/`utm_medium=cpc`):
    Ads conversions are only tracked on the web, so moving those visitors into the app would hide
    their conversions from Smart Bidding.
  - Hidden on `/post`, `/checkout`, `/auth/*`, `/claim/*`.
  - Web → app path mapping: `appPathForWebPath` in `apps/web/src/lib/appLinks.ts` (listing pages
    → `listing/<id>`, My listings, messages, favourites → `saved`, etc.; anything else → app home).
- **`GetAppCard`** ("Never miss an enquiry") on the post-ad success screen and below active ads on
  My listings: Open-the-app button on Android, Play Store QR on desktop (`lg:`), nothing on iOS.
- **Footer** "Get the app" column: QR on desktop, Play Store link everywhere.
- QR images are static SVGs in `apps/web/public/app-qr/` (one per placement, Play referrer
  `utm_medium=qr&utm_campaign=<placement>`); regeneration command in `appLinks.ts`.
- Tracking: see "How taps and installs are measured" below.
- **App fix shipped with it:** `listingIdFromPath` (mobile `referralLink.ts`) took the text after
  any hyphen as a listing id, so `bhavano://my-listings` or `/bengaluru/hsr-layout` would have
  opened a "listing" called `listings` / `layout`. Now matches only a cuid/uuid id, like the web's
  `looksLikeListingSlugId`. Ships with the **1.0.1 native build**, not OTA: HEAD needs that build
  anyway (`expo-linking`, App Links), and an OTA for runtime 1.0.1 reaches no installed phone. The
  live 1.0.0 build doesn't have the bug — `ReferralLinkBridge` arrived after it — so the strip's
  `bhavano://` links already route correctly there via expo-router.

## How taps and installs are measured (2026-10-05)

A tap on a get-the-app control and a later install can't be joined per person: the tap happens in
the browser, the install in Play, and nothing identifies the user across that gap. So there are
three separate measurements. Their totals line up, but they don't connect to each other.

1. **Taps, web (GA4 + Page visits trail).** Every control calls `reportGetAppEvent`
   (`apps/web/src/lib/getAppEvents.ts`), which does two things:
   - pushes `open_in_app_click` / `open_in_app_dismiss` to the dataLayer with `placement`
     (`strip` | `post_success` | `my_listings` | `footer`) and `app_path`. GTM version 11 forwards
     both to GA4 (`gtm_build.py` `EVENTS`). GA4-only, not an Ads conversion.
   - writes a synthetic `/get-app?event=click|dismiss&placement=…&to=…` row into the visitor's
     Page visits trail. Admin shows it as "Get app — tapped Open app (bottom bar) → listing/…"
     (`apps/admin/src/lib/pageTrail.ts`).

   A QR scan can't be seen at all: the phone camera goes straight to Play, never through
   bhavano.com.
2. **Installs, aggregate (Play Console).** Every Play URL carries
   `referrer=utm_source=bhavano_web&utm_medium=<qr|open_in_app_strip|get_app_card|footer_link>&utm_campaign=<placement or app page>`.
   Play Console → Statistics / Acquisition reports break installs down by these UTM values,
   including QR installs per placement.
3. **Installs, per user (app, Android).** `recordInstallReferrerOnce`
   (`apps/mobile/src/lib/installReferrer.ts`, called from the root layout) reads the Play Install
   Referrer once per install (`expo-application`) and stores the parsed utm fields in AsyncStorage.
   - **Trail:** if the app was installed less than 24h ago, it logs
     `/app-install?source=…&medium=…&campaign=…` in that launch's app Page visits trail ("App
     installed — from QR code (footer)" / "Play Store search/browse"). The 24h window stops a
     phone that updates from 1.0.0 from logging an old install as new.
   - **Signup:** `installAcquisitionFields()` is sent as `acquisitionSource/Medium/Campaign` with
     every app login (OTP, Google, Apple). The BFF stores them only when it creates a new user, so
     an app signup's User row records which web placement drove the install (admin user page,
     "Found via"). Values are cut to the DTO's 100-character limit.
   - Ships with the **1.0.1 native build** (it adds the native `expo-application` module); 1.0.0
     phones report nothing.

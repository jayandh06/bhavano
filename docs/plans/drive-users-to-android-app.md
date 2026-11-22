# Moving web users to the Android app

Question (2026-10-05): how do we get people to use the Android app instead of desktop or mobile
browsers? Web stays the front door — SEO and every Ads campaign land there — so the aim is to hand
over *returning* and *high-intent* users to the app, never to block the web.

## Current state

- **App Links (2026-10-14):** native 1.0.1 with the `autoVerify` intent filter is live on Play.
  `assetlinks.json` originally listed only the **upload** key (`83:E7:…:58:50`), but Play-installed
  apps are signed with the **Play App Signing** key (`7F:32:…:7E:99`, Play Console → Test and
  release → Setup → App signing), so verification would have failed. Both are now listed. Verify
  on a Play-installed device: `adb shell pm get-app-links com.finfolia.bhavano` → `verified`.
  **Caveat for Ads:** once verified, clicks on Ads URLs open the app for installed users, and Ads
  conversions are only tracked on web — import the Firebase `post_ad_success` conversion first
  (see `firebase-analytics-and-app-campaign.md` Phase 3).
- **Built 2026-10-05: steps 2, 3 and 4 below** (open-in-app strip, high-intent moments, desktop QR)
  — see "As built".

## Plan, in order of payoff

1. **Ship App Links** (native build + fingerprint check). After that every bhavano.com link —
   WhatsApp shares, Google results, email/SMS notifications — opens the app for anyone who has it.
   Biggest win, no new UI.
2. **Open-in-app strip on Android mobile web** (as specified in `more-login-conversion.md`): thin,
   dismissible, 30-day snooze; opens the same page in the app, falls back to Play Store with a
   `referrer=utm_source=web&utm_medium=banner&utm_campaign=<page>` so installs are attributable. No
   full-screen interstitial — Google demotes intrusive mobile interstitials.
3. **Ask at high-intent moments, with a concrete reason** rather than a generic banner — done,
   see "As built":
   - after posting an ad: "Get enquiry alerts instantly — reply from the app" (already covered by
     `GetAppCard` on the post-ad success screen, step 2);
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
  — opens the same screen in the app, or the Play Store. ✕ hides it for the rest of the day; it's
  back on the visitor's next calendar day, local time (`useDismissedToday`). Changed from a 30-day
  dismiss on 2026-10-05 (briefly a 30-minute pause between visits), so people who closed it once
  still see it on later days. While visible it sets
  `--app-strip-h`, which pads `<body>` and lifts `ProfileCompletionBanner` / `ListingLoginNudge`
  above it.
  - **Hidden for 30 days after a paid-ad click** (`gclid`/`gbraid`/`wbraid`/`utm_medium=cpc`):
    Ads conversions are only tracked on the web, so moving those visitors into the app would hide
    their conversions from Smart Bidding.
  - Hidden on `/post`, `/checkout`, `/auth/*`, `/claim/*`.
  - Web → app path mapping: `appPathForWebPath` in `apps/web/src/lib/appLinks.ts` (listing pages
    → `listing/<id>`, My listings, messages, favourites → `saved`, etc.; anything else → app home).
- **`GetAppCard`** (`apps/web/src/components/home/GetAppCard.tsx`): Play Store QR on desktop
  (`lg:`), the "Get it on Google Play" badge on phones and tablets, iPhones included (changed
  2026-10-05; before, Android got an "Open the app" button and other phones nothing). On Android
  the badge is the `intent://` link (opens the app at `appPath` if installed, Play otherwise) and
  shows at every width; elsewhere it's a plain Play link (`utm_medium=play_badge`). Admin's trail
  shows a tap with an app destination as "tapped Open app", one without as "tapped Google Play". `placement`/`appPath`/`heading`/`body`
  are explicit per call site (step 3 needed per-moment copy and in-app destinations, not one fixed
  pitch) — on the post-ad success screen and below active ads on My listings it's still "Never
  miss an enquiry" → `my-listings`.
- **High-intent moments (step 3, built 2026-10-05):**
  - **Contact/chat** — `MessageThread.tsx`'s `onSend()` sets a one-shot sessionStorage flag
    (`bhavano_first_msg_sent_<conversationId>`) right before redirecting to the newly created
    conversation's canonical `/messages/<id>` URL (the redirect unmounts/remounts the component,
    so this can't be plain component state). `useConsumeSessionFlag` (`useAppLinkEnv.ts`) reads
    and clears that flag on the next mount; while true, a `GetAppCard` ("Get the owner's reply as
    a notification", `appPath` = the thread's own path via `appPathForWebPath`) shows above the
    composer.
  - **Saved search** — `SaveSearchButton.tsx`'s popup stays open after a successful save (instead
    of closing) and swaps the name form for "✓ Search saved" + a `GetAppCard` ("Be first to see
    new matches"), widening slightly (`lg:min-w-[320px]`) to fit the QR. The standalone
    `/saved-searches` page (`SavedSearchesManager`) still just reloads — not covered here, lower
    traffic than the inline browse-page button.
- **Header and footer (2026-10-05): QR on desktop, Google Play on phones.** All in
  `GooglePlayBadge.tsx`. Desktop is `lg:` and up, CSS-gated so it server-renders without a shift.
  - **Footer** "Get the app" column: the QR (`app-qr/footer.svg`) on desktop; below `lg`,
    Google's standard "Get it on Google Play" badge (`public/badges/google-play.svg`, the official
    artwork, not redrawn), `utm_medium=play_badge`. Before this the footer had the QR plus a text
    link (`footer_link`).
  - **Desktop header**, before Favourites: "Get the app" with the QR (`app-qr/header.svg`) in a
    popover on hover or keyboard focus. Clicking opens the Play web listing
    (`utm_medium=header_link`), which can install to a signed-in phone. Placement `header`.
  - **Phone header**: the Play logo (`public/badges/google-play-icon.svg`) as an icon button
    beside Messages/Login, Android browsers only (`useIsAndroidBrowser`, so it appears after
    hydration), `utm_medium=play_icon`, placement `header_mobile`. It goes to the Play listing,
    not `intent://`; a play.google.com link opens the Play Store app on Android.
  - Tablets between `sm` and `lg` see neither header control, only the footer badge.
  - None of these are hidden after a paid-ad click, unlike the strip.
- QR images are static SVGs in `apps/web/public/app-qr/` (one per placement — `strip` has none, it
  doesn't need one; `post_success`, `my_listings`, `footer`, `header`, `contact`, `saved_search`
  all do; Play referrer `utm_medium=qr&utm_campaign=<placement>`); regeneration command in
  `appLinks.ts`.
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
     (`strip` | `post_success` | `my_listings` | `footer` | `header` | `header_mobile` | `contact` |
     `saved_search`) and
     `app_path`. GTM version 11 forwards both to GA4 (`gtm_build.py` `EVENTS`). GA4-only, not an
     Ads conversion.
   - writes a synthetic `/get-app?event=click|dismiss&placement=…&to=…` row into the visitor's
     Page visits trail. Admin shows it as "Get app — tapped Open app (bottom bar) → listing/…"
     (`apps/admin/src/lib/pageTrail.ts`).

   A QR scan can't be seen at all: the phone camera goes straight to Play, never through
   bhavano.com.
2. **Installs, aggregate (Play Console).** Every Play URL carries
   `referrer=utm_source=bhavano_web&utm_medium=<qr|open_in_app_strip|get_app_card|play_badge|play_icon|header_link>&utm_campaign=<placement or app page>`
   (`footer_link` until the footer switched to the badge on 2026-10-05).
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

## iOS counterpart (2026-11-21)

The iOS app went live on 2026-11-21 (App Store ID `6811878602`), so the site's get-the-app UI now serves
iPhone/iPad too. Differences from Android:

- **No `intent://`, no install referrer.** Installs are tagged with the App Store campaign token
  (`?ct=<medium>-<campaign>`, `appStoreUrl` in `appLinks.ts`), visible only in App Store Connect → Analytics →
  Sources. There is no per-user signup attribution like Android's Play referrer / `ws`.
- **Smart App Banner** (`<meta name="apple-itunes-app" content="app-id=6811878602">` in `layout.tsx`):
  Safari's own "Open"/"Get" banner, replacing the custom strip on iOS. No `app-argument`, so "Open" lands on the
  app's home on every page except a listing. **Listing pages (added 2026-11-21)** set `app-argument` to their canonical https URL via `siteMetaOther(url)` (`lib/smartAppBanner.ts`), so "Open" lands on that listing (the app's incoming-link handler already reads bhavano.com URLs). Next replaces `other` wholesale per page, so the helper repeats the site-wide tags (Meta domain verification). Unlike the Android strip it is **not** hidden after a
  paid-ad click, because a static tag can't know that; it only offers an install, it does not redirect.
- **`/ios`** (`iosRedirect`): 302 to the App Store, `?m=&c=` become the campaign token; `/app` (SMS link) now
  sends iPhones to the App Store too. Same noindex header as `/android`.
- **`html[data-ios]`** is set before first paint next to `data-android` (iPad in desktop mode detected by touch
  points). Footer shows the App Store badge below `lg` (Android phones see only Play, iPhones only App Store);
  the phone header gets an iOS icon button; `GetAppCard` and `InstallAppAlertBanner` switch on iOS.
- Badge artwork lives at `public/badges/app-store.svg` (Apple's official file, not redrawn).
- **Desktop QR (2026-11-21):** every desktop QR (footer, header popover, `GetAppCard`) now shows two codes, Android and iPhone. The iOS ones are `public/app-qr/ios-<placement>.svg`, encoding `https://www.bhavano.com/ios?m=qr&c=<placement>` (static, so the App Store campaign token is `qr-<placement>`).
- Not built yet: `OpenInAppStrip` for iOS (the Smart Banner covers it).

## Update 2026-11-22: icon-only install control on phone browsers

- Phone header row (`max-sm`, one per device, no text): Android keeps the Google Play icon; iPhone/iPad now
  shows Bhavano's own app icon with a small download arrow, linking to the App Store (`AppStoreHeaderIcon`),
  replacing the generic phone glyph.
- Desktop header (`GetAppHeaderQr`, `lg` up): the same two icons side by side, no text; hovering or focusing either
  opens a popover with that platform's QR code (before: a "Get the app" text link with both QR codes).
- Why Bhavano's icon on iOS: Apple's marketing rules allow only its badge and forbid its icons or logo in
  the badge's place (developer.apple.com/app-store/marketing/guidelines); linking your own app icon is what
  its link tools generate. The badge needs 40 px of height, which truncated the "Bhavano" wordmark at 375 px
  in the header row, and an own row under the header was rejected.
- `InstallAppAlertBanner` (owner alert pickers): on phones the "Get the free app" text button is the official
  store badge, one per device (Play hidden on iOS, App Store hidden on Android). From `sm` up it keeps the
  original text button. Same `/android` and `/ios` links and attribution.
- Unchanged: the footer and GetAppCard.
- "Open in the Bhavano app" bottom bar (`OpenInAppStrip`) now also shows on iPhone/iPad. Android uses an `intent://`
  link; iPhone has no such link, so the button tries `bhavano://<path>` and, if the page is still visible and
  focused after 2.5 s (nothing took over), goes to the App Store (`openInIosApp`). **Not yet verified on a real
  iPhone**: with no app installed Safari shows its own "cannot open the page" alert before the fallback, and
  whether iOS's "Open in Bhavano?" confirmation blurs the page (which cancels the fallback) is assumed.

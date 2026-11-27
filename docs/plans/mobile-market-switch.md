# Mobile app market switch (India and US in one app)

Status: **approved 2026-11-26** with the recommendations below. Phases 1 to 4 built the same day; production builds still
offer India only, and no app release made. Follows [us-market-expansion.md](us-market-expansion.md) ("Mobile apps").

## Goal

One app (same bundle `com.finfolia.bhavano`, same store listing) that works against either market's server and shows
that market's content. **An India user who updates notices nothing.**

## What existed before phase 1 (checked 2026-11-26)

| Area | State |
|---|---|
| Market store | `src/lib/market.ts`: persisted, defaults to India, `useMarket()`; nothing calls `setCurrentMarket` |
| Market-aware UI | Phone rules, currency symbol and price labels, dates, posting categories, hidden Fair Housing fields |
| Server address | One `EXPO_PUBLIC_BFF_URL`, read separately in `bffClient.ts`, `analyticsSession.ts` and `socket.ts` |
| Site address | `EXPO_PUBLIC_SITE_URL` in `appWebUrl.ts`, `account.tsx`, `contact.tsx` |
| US API | `https://api.us.bhavano.com` answers `/health`, `/locations/cities`, `/app-config/version`, `/auth/login-methods` |
| US sign-in | Google web/iOS/Android client IDs and the Apple bundle ID are the same on both servers, so the app's Google and Apple sign-in should be accepted (not tried) |
| US push | `EXPO_PUSH_ENABLED` unset: no pushes |
| US payments | No Razorpay keys and no Apple IAP key; Apple products are priced for India |
| App links | iPhone leaves `/us` in the browser (2026-11-26); Android still opens `/us` in the app |

**The two markets are separate databases with separate sign-in secrets.** An account, listing, city, saved item or
session from one market means nothing in the other.

## Blocker outside the app: US sellers could not publish (fixed 2026-11-26)

`POST /listings` called `assertOwnerPhoneVerified` in every market, and the only way to verify a phone is a code sent
through MSG91, which the US server does not have. So a US account could not publish an ad (found in the code and the
server's settings; not reproduced signed in).

**Fixed by option A, approved 2026-11-26:** the market config has `publishRequiresVerifiedPhone` (India `true`, US
`false`). The BFF, the web posting wizard and the app's publish step all follow it. A US owner may therefore have no
phone number: buyers contact them by message or email, and the "contact" buttons open email when there is no number.
Spam protection in the US is Google/Apple sign-in and moderation.

**Later (option B):** add US SMS verification (Twilio Verify or similar; needs a provider account, A2P 10DLC
registration and consent wording), then set the flag back to `true`.

## Decisions

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Market per account or per install? | **Per install**, changeable in Account and the home drawer | Accounts live in separate databases, so the market must be known before sign-in |
| 2 | How is it first chosen? | Upgrades stay India silently. Fresh install with device region US **and an American time zone**: ask once, US preselected. Otherwise India, no question | Keeps India unchanged; US-region India users (NRIs) with the app are not moved |
| 3 | Sessions when switching | Keep one session per market; switching does not sign you out of the other | Switching back is instant |
| 4 | US paid features | Hide every purchase entry point until US payments exist | No working payment path |
| 5 | US legal, help, blog, tools | Legal and help open the US web pages; hide blog and calculators (India content) | One copy of legal text |
| 6 | US phone login | Hidden (Google and Apple only), as on the web | No US SMS |

## Design

### 1. Market selection (built in phase 4)
**Release gate:** a build offers the US only with `EXPO_PUBLIC_US_ENABLED=1`. `eas.json` sets it for development and
preview builds and **not for production**, so an India release can be cut at any time; the US launch adds it there.
Without it there is no first-launch question, no Country setting, no Switch button, and a saved US choice is ignored.

- First launch (`market.ts`): a stored value wins. Otherwise, on a new install (no stored data at all) on a phone set
  up for the US, `FirstMarketChooser` asks once with the US preselected and saves the answer. An update (any stored
  data) stays on India and is remembered; every other phone is India without a question.
- **"Set up for the US" means region `US` and an American time zone** (`deviceRegion.ts`, changed 2026-11-27). The
  region alone was wrong: on Android `expo-localization` takes `regionCode` from the language's country (checked in its
  source; MIUI has its own region setting), so a phone in India set to "English (United States)" reports `US`. Someone
  set up for the US who is travelling abroad is not asked, and uses the Country setting. Read through a guarded
  `require`, so a binary without the module gets India, not a crash. No location is read.
- The app draws nothing else until the market is known or chosen.
- A "Country" row in the menu and on the Account screen opens `CountryPicker`, which confirms before switching and
  starts from Home.
- **To confirm:** tapping the header flag opens the picker. Today a signed-out visitor reaches the menu only from the
  collapsed header, after scrolling.

### 2. Server and site addresses
- New `src/lib/marketEndpoints.ts`: `apiUrl()` and `siteUrl()` for the current market. India keeps
  `EXPO_PUBLIC_BFF_URL` / `EXPO_PUBLIC_SITE_URL`; add `EXPO_PUBLIC_US_BFF_URL` and `EXPO_PUBLIC_US_SITE_URL`
  (`https://www.bhavano.com/us`), set wherever the India ones are set (they are not in `eas.json`).
- Replace the module-level constants with calls at request time.

### 3. Storage

| Per market | Shared |
|---|---|
| Session token, remembered city, guest saves, post-ad draft, referral code, viewer key, analytics session | Market, theme, login-nudge counters, per-user dismissals |

India keeps today's key names (so nobody is signed out); US keys add a `.us` suffix through one `marketKey(name)`
helper. Install attribution stays a single first-install record.

### 4. Switching (built in phase 1)
`switchMarket(id)` in `market.ts`; nothing calls it yet. The state lives in `marketState.ts` (no storage or React).

1. While still on the old market, goodbye hooks run (at most 5 seconds): this phone's push token is unregistered and the
   analytics session saved. Each market's session token is kept, so switching back needs no sign-in.
2. `MarketRoot` removes every screen, so their cleanup runs under the old market.
3. The market changes, and modules drop what they hold in memory (socket, analytics session, guest saves, post-ad draft
   flag, requirement draft, seeker-contact setting, the once-per-launch profile prompt). The choice is saved.
4. The app is drawn again with a new `QueryClient`. In the browser preview it landed on Home even when switched from
   another screen (check on devices). New providers restore that market's token and city and register push.

Also guarded, because remounting reports them again: the notification and link that launched the app are acted on once.
Apple purchases get no session outside India, so a replayed India purchase stays unfinished for India's server.
Not done through `Updates.reloadAsync`, which does not work in development builds.

### 5. Links (built in phase 3)
`src/lib/marketLinks.ts` decides which market a link belongs to: `www.bhavano.com/us/...` and `bhavano://...?market=us`
are the US, other bhavano.com links and unmarked `bhavano://` screen links are India's, and anything else (sign-in
redirects) says nothing and passes through.

- `app/+native-intent.tsx` asks it for every system link, after loading the saved market. Same market: unchanged (the
  US path loses `/us` for the router). Other market: `app/switch-market.tsx`.
- That screen offers **Open in browser** and **Stay**. **Switch** appears only when `MARKET_SWITCH_ENABLED` is true,
  which is **false until phase 4**, so a release made before then cannot move anyone to the US. A followed link is kept
  across the switch and opened afterwards.
- `ReferralLinkBridge` records nothing for the other market's link; `MessageBody` sends such links to the same screen.
- The US website now adds `market=us` to its "Open app" links. India's are unchanged.
- Also fixed: a shared `/listings/{id}` link (what the app's Share button sends) opened the app on Home; it now opens
  the listing.

### 6. Content and rules (built in phase 2)
Four flags on the market config drive it: `phoneOtpAvailable`, `paymentsEnabled`, `indiaContent`,
`contactConsentPreTicked` (India all `true`, US all `false`). The app's own wording and lists are in
`src/lib/marketText.ts` and `categories.ts` (`homeTabs`).

| US change | Where |
|---|---|
| No PG, coworking or plots; condo, townhouse and room for rent | Home tabs, filters, requirement questions |
| "bed" instead of "BHK", dollars, "Favorites" | Filters, requirement cards, saved searches, tab bar, saved screen |
| No preset budget bands (the shared ones are rupees); the seeker types amounts | Requirement questions and feed filters |
| Consent box starts unticked; "the United States" | "Find this for me" prompt |
| Google and Apple sign-in only; no phone field, phone prompts or phone requirement to save the profile | Login sheet, account, completion prompt |
| About, Help, Terms, Privacy and Contact open the website | `MarketWebPage` |
| Blog, calculators, RERA, Indian languages and the WhatsApp ad-share card hidden | Menus and screens (blog and tool screens redirect Home) |

### 7. Payments (decision 4, app side built in phase 2)
With `paymentsEnabled` false the app hides Featured ads, plans, purchases, referrals, contact credits, alert-channel
settings and the Boost message card (its plain text shows instead); Plans, Purchases and Referrals redirect Home.
Apple purchases get no session outside India (phase 1). The server refuses payment orders and Apple purchase intents
where payments are off (built 2026-11-27, [us-admin-site.md](us-admin-site.md); needs a US backend deploy).

### Still India-flavoured in the US
- The shared requirement label (written by the server as `searchLabel` and previewed in the app and on the web) says
  "BHK" and rupees. It needs a market argument in `@bhavano/types/requirementQuestions`.
- The store link in `UpdateGate` (release phase).
- Wording was checked by text search and a few screens in a browser preview, not screen by screen on a phone.

### 8. Release, stores and operations
- Adding `expo-localization` is a native change: bump the app version (for example 1.7.0). `runtimeVersion` follows the
  version, so this must go out as a store build, not an over-the-air update to 1.6.0.
- Store link in `UpdateGate`: choose the App Store country by **device region**, not app market.
- Each server has its own forced-update minimum (this corrects "stays shared" in the expansion plan): set both.
- Stores: confirm US availability in App Store Connect and Play; US listing text and screenshots.
- US push: set `EXPO_PUSH_ENABLED` and `EXPO_ACCESS_TOKEN` on the US server.
- Analytics: add a `market` property to Firebase events so US activity does not feed India's ad campaigns unnoticed.
- US admin: the US stack runs no admin app, so moderation and settings (including the minimum version) have no screen.
  Decide before launch.

## Phases (each its own pull request)

| Phase | Work | India behaviour |
|---|---|---|
| 0 | Server: publishing rule (done 2026-11-26), refuse US payments (built 2026-11-27), US push | Unchanged |
| 1 | `marketEndpoints`, `marketKey`, hydrate before first screen, reset hooks, the switch itself (**done 2026-11-26**) | Unchanged; tests pin addresses and key names |
| 2 | US content, consent default, hidden payments and India-only screens (**done 2026-11-26**) | Unchanged |
| 3 | Link handling and the web `market=us` change (**done 2026-11-26**; the web part needs a US deploy) | India links as today, shared listing links now open the listing |
| 4 | First-run chooser, Country row, switching, behind the release gate (**done 2026-11-26**) | Production builds unchanged; chooser never shown to updates |
| 5 | Version bump (needed: new native module), builds, TestFlight and Play internal testing, store listings, release; set `EXPO_PUBLIC_US_ENABLED` for production at the US launch | |
| After | Once the release is the US minimum: remove the `NOT /us` lines from `apple-app-site-association` | |

## Testing
- Unit (`jest`): first-launch choice, endpoints per market, key names, link mapping, payment flag.
- Devices, both platforms: upgrade from 1.6.0 stays signed in on India; fresh US-region install; switch both ways;
  sign in, post, message and push in each; India and US links, cold and warm.

## Verified for phase 1 (2026-11-26)
- App tests (120) and type check pass.
- Browser preview against two stand-in servers: launch used India's server; after switching, every request went to the
  US server; the choice survived a reload; switching back worked. The preview needed temporary stand-ins for two
  native-only modules that already fail on web (`expo-tracking-transparency`, Firebase analytics).

## Verified for phase 2 (2026-11-26)
- App tests (126), type checks, and server and website tests pass.
- Browser preview with stand-in servers, logged out: US home, tabs, filters, prompt (unticked), login sheet
  (Google only), posting categories, Help (website link), Plans and Tools redirecting Home; India's home and filters
  as before.

## Verified for phase 3 (2026-11-26)
- App tests (158), website tests (288) and both type checks pass.
- Browser preview: the switch screen for a US link on India (no Switch button, Open in browser opens the page, Stay
  goes Home); a same-market link goes Home.

## Verified for phase 4 (2026-11-26)
- App tests (165), type checks, server and website tests pass.
- Browser preview (US-region browser, US enabled): a fresh install was asked and nothing was stored before answering;
  choosing the US opened it; the menu's Country row switched to India with a confirmation; the choice survived a
  reload without asking again; a followed link switched to the US and opened Help.

## Not verified
- The native region module on a device, the Account screen's Country row (needs sign-in), and the picker over the
  drawer on iOS.
- **Links on a device.** `+native-intent` does not run in the browser preview: check cold and warm starts, universal
  links, App Links and `bhavano://` on both platforms, and that an India listing link still opens as before.
- Nothing has run on a phone or simulator: sign-in, push, sockets and secure storage across a switch are untested.
- Signed-in screens (account, my listings, posting past the first step, messages) were not seen in either market.
- No device or signed-in test against the US server.
- US storefront availability, and whether Apple review needs anything extra for a US release.
- The list of India-only wording comes from a text search, not a screen-by-screen review.

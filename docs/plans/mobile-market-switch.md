# Mobile app market switch (India and US in one app)

Status: **proposed 2026-11-26, not approved, nothing built.** Follows [us-market-expansion.md](us-market-expansion.md) ("Mobile apps").

## Goal

One app (same bundle `com.finfolia.bhavano`, same store listing) that works against either market's server and shows
that market's content. **An India user who updates notices nothing.**

## What exists today (checked 2026-11-26)

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

| # | Question | Recommendation | Why |
|---|---|---|---|
| 1 | Market per account or per install? | **Per install**, changeable in Account and the home drawer | Accounts live in separate databases, so the market must be known before sign-in |
| 2 | How is it first chosen? | Upgrades stay India silently. Fresh install with device region US: ask once, US preselected. Any other region: India, no question | Keeps India unchanged; US-region India users (NRIs) with the app are not moved |
| 3 | Sessions when switching | Keep one session per market; switching does not sign you out of the other | Switching back is instant |
| 4 | US paid features | Hide every purchase entry point until US payments exist | No working payment path |
| 5 | US legal, help, blog, tools | Legal and help open the US web pages; hide blog and calculators (India content) | One copy of legal text |
| 6 | US phone login | Hidden (Google and Apple only), as on the web | No US SMS |

## Design

### 1. Market selection
- First launch logic in `market.ts`: stored value wins; otherwise, if the app already has any stored data (an upgrade),
  India; otherwise India unless `expo-localization`'s `getLocales()[0].regionCode` is `US`, in which case show a
  one-time chooser. The "already has data" check must run before other modules write their first keys.
- **Hold the first screen until the market is loaded.** `hydrateMarket()` is asynchronous today, so early requests
  would otherwise go to India.
- A "Country" row (flag and name) in Account and the home drawer, with a confirmation.

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

### 4. Switching
1. Unregister this device's push token from the market being left.
2. Disconnect the socket and reset module state: `socket.ts`, `analyticsSession.ts`, `guestSaves.ts` (loads at import),
   the post-ad draft and the iOS purchase client.
3. Change the market and remount the app tree (`key={marketId}`, with a new `QueryClient`), landing on Home. This
   avoids `Updates.reloadAsync`, which does not work in development builds.
4. On entry, restore that market's token and city and register push again.

### 5. Links
- Add `app/+native-intent.tsx` (`redirectSystemPath`): read the market from the path (`marketFromPath`), strip `/us`,
  and map to an app screen. If the link's market is not the current one, go to a "This link is for Bhavano US / India"
  screen with **Switch** and **Open in browser**; never an empty or wrong page. It runs before sign-in state is
  available, so it only decides the route. Verify cold and warm starts on devices.
- `ReferralLinkBridge` and `MessageBody` read URLs themselves: use the same helper.
- Web change: the US site's `bhavano://` links ("Open app") carry no market today; add `market=us`.
- Share links: with the US site address they become `/us/listings/{id}`; confirm that route resolves.

### 6. Content and rules still India-only
- Home category chips, tab bar and menus (PG, coworking, plots).
- Saved searches and price inputs (k / Lakh / Crore), `PriceWithWords`, `formatInr`.
- `RequirementPrompt` ticks contact consent by default; **US must start unticked**, as on the web.
- Posting wizard: the publish step already skips the phone in the US (`publishRequiresVerifiedPhone`).
- Wording that names India or bhavano.com purchases (a search for India, ₹, +91, Lakh, PG and the like matches 35
  files under `app/` and `src/`, tests included; review each).
- US cities come from the US server; nothing to seed in the app.

### 7. Payments (decision 4)
A `paymentsEnabled` flag on the market config (India true, US false) hides Boost, plans, subscriptions, contact-reveal
credits, instant alerts, pending-payment cards and their message-card buttons. The server should refuse payment orders
in the US as well.

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
| 0 | Server: publishing rule (done 2026-11-26), US push, refuse US payments | Unchanged |
| 1 | `marketEndpoints`, `marketKey`, hydrate before first screen, reset hooks | Unchanged; tests pin addresses and key names |
| 2 | US content, consent default, hidden payments and India-only screens | Unchanged |
| 3 | Link handling and the web `market=us` change | India links as today |
| 4 | First-run chooser and Country row (**last**, so earlier India releases cannot reach US) | Chooser never shown to upgrades |
| 5 | Version bump, builds, TestFlight and Play internal testing, store listings, release | |
| After | Once the release is the US minimum: remove the `NOT /us` lines from `apple-app-site-association` | |

## Testing
- Unit (`jest`): first-launch choice, endpoints per market, key names, link mapping, payment flag.
- Devices, both platforms: upgrade from 1.6.0 stays signed in on India; fresh US-region install; switch both ways;
  sign in, post, message and push in each; India and US links, cold and warm.

## Not verified
- No device or signed-in test against the US server.
- US storefront availability, and whether Apple review needs anything extra for a US release.
- The list of India-only wording comes from a text search, not a screen-by-screen review.

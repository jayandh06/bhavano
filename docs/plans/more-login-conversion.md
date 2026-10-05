# More ways to get listing viewers logged in (no SEO risk)

## Status: in progress (2026-09-30)

Follow-up to [listing-detail-login-nudge.md](listing-detail-login-nudge.md), which built One Tap,
the delayed web card, the app sheet with Skip and the WhatsApp link. Same constraint as there
(Option B from [login-gated-listing-interest-owner-notify.md](login-gated-listing-interest-owner-notify.md)):
the listing page stays fully public and identical for crawlers and people. Nothing below
changes what a crawler sees.

The user picked seven items. They're built and committed one at a time, in this order.

## 1. Keep people logged in (sliding sessions)

**Problem.** The BFF's access token lives 24h (`ACCESS_TOKEN_TTL`) and there is no renewal, so
every user on web and app is logged out a day after logging in. The web's NextAuth cookie lasts
30 days, but `isAccessTokenValid` treats the session as logged out once the token inside it
expires. Every prompt we built has to win the same person back daily.

**Design.**

- **Token lifetime.** Users get a 30-day token, admins keep 24h. The guards trust the `role`
  claim without a DB read, so a long-lived admin token is a bigger risk than a user one.
- **Renewal.** `POST /auth/refresh` (AuthGuard) re-reads the user from the DB and issues a fresh
  token. It returns 401 if the row is gone or `deletedAt` is set, and picks up role changes.
  Anyone active at least once per token lifetime stays logged in indefinitely.
- **Web.** The `jwt` callback renews on `trigger === "update"` when the token is more than a day
  old. `SessionKeepAlive` (client, mounted in `PageHeader` for logged-in visitors) calls a server
  action that runs `unstable_update`, at most every 12h per browser (localStorage). A server
  action is used because server components can't rewrite the session cookie. A failed renewal
  keeps the old token.
- **App.** On cold start and on returning to the foreground, a token older than a day is renewed
  and stored in SecureStore. An expired token is still dropped as before.
- **Admin app.** Kept at 24h originally, specifically because the guards trust the token's `role`
  claim with no server-side revocation check — a long-lived admin token stays valid for its whole
  life even if access is pulled or the token leaks. Raised to 90d on explicit instruction
  (2026-10-01); the tradeoff is accepted, not an oversight. If admin access ever needs to be
  revocable mid-token-life, that needs the guard to read the current role from the DB, not a
  shorter TTL.

## 2. Resume the tap after login

Save (the heart) was the only login-gated tap that didn't finish after login: `requireLogin()`
had no `onSuccess`. With guest saves (next section) a logged-out heart no longer needs a login,
so this section covers whatever still asks: the favourite endpoint accepts an explicit
`{ favourite: true }` so a resumed or synced save can never un-save a listing already saved on
another device.

## 3. Guest saves

- **Saving while logged out.** Web (localStorage) and app (AsyncStorage) keep up to 30 saved
  listings on the device as small snapshots (id, title, price text, locality, photo, URL). The
  heart works without login.
- **The ask.** A toast after each guest save: "Saved on this device. Log in to keep it on any
  phone." The Saved/Favourites screen lists device saves with a "Log in to keep them" banner
  when logged out.
- **Sync on login.** `POST /users/me/favourites/import { listingIds }` adds them idempotently,
  skipping missing listings and the user's own. It runs after any login and on the first
  logged-in page load that finds device saves, then clears the device copy.

## 4. "Alert me about similar homes" on the listing page

Saved-search alerts exist (email, WhatsApp fallback) but the button was only on search results,
and the app had no saved-search UI.

- **Criteria.** Built from the listing: city, its area, category, transaction type, bedrooms
  where applicable, and a price band around its price.
- **Web.** Reuses `SaveSearchButton`.
- **App.** A one-tap create with an auto-generated name, plus the same free-quota message.
- **Login.** Logged-out users are asked to log in first, and the alert is then created.

## 5. Welcome back

When the web card is due and this device viewed 3+ listings on earlier visits, the card reads
"Welcome back! You've looked at N homes…" instead of the default copy. The same landing-page
rules apply as for the card, so it never shows on the first page of a visit or on ad/search
visits.

## 6. Quick "I'm interested"

An "I'm interested" button on listing detail for logged-out visitors. It opens the existing
phone-OTP login titled "Tell the owner you're interested". On success it records interest,
which notifies the owner (existing 24h debounce), the same as a logged-in view. Logged-in
visitors don't see it, because their view already registers interest.

## 7. Small extras

- **Scroll trigger.** The web card shows at its delay or at 50% scroll, whichever comes first.
- **Locked extra.** Logged-in visitors see how many people are interested in the listing.
  Logged-out visitors see "Log in to see how many people are interested". This doesn't touch
  main content (title, price, photos, description, JSON-LD).
- **Open in app.** A thin, dismissible strip on Android mobile web: "Open in the Bhavano app".
  It opens the same listing through the `bhavano://` scheme, falling back to Play Store. It's
  hidden for the rest of the day after dismissal, back the next day (was 30 days until
  2026-10-05). Android App Links (bhavano.com links opening the app
  directly) need `assetlinks.json` with the Play signing key's SHA-256, and a native build, so
  they aren't done here. **Built 2026-10-05** as `OpenInAppStrip`, via an Android `intent://` link
  (the Play fallback is built in) and hidden after paid-ad clicks — see
  [`drive-users-to-android-app.md`](drive-users-to-android-app.md).
- **Desktop exit prompt.** When the pointer leaves through the top of the window on a listing,
  once per session, a small card offers "Save this home before you go?". It uses guest save, so
  no login is needed, and the save toast then asks for login.

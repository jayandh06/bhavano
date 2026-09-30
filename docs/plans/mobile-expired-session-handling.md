# Mobile: end the session when the BFF stops accepting the token

## Problem

Reported as "logged in as admin on Android, opened the boost message, it is blank". BFF logs for
that window showed every Android (`okhttp`) request to `/conversations*` coming back
`401 Login required`, from at least 05:27 UTC onwards. The message data itself was fine.

The BFF access token is a JWT with a 24h TTL (`ACCESS_TOKEN_TTL`, see
[admin-listing-engagement-and-login-expiry.md](admin-listing-engagement-and-login-expiry.md)) and
there is no refresh flow. The app only noticed a dead token in `refreshProfile`, which runs on a
cold start or a token change. An app left running (backgrounded) past 24h therefore kept
`isLoggedIn: true` with a token the BFF rejects. Every authed query failed, and screens that
don't render an error state showed an empty result. The conversation screen fell through to
`ConversationThread` with `initialMessages ?? []`, which is a blank thread.

## Decision

Same reactive approach the web app took in
[fix-stale-session-crash-on-authed-pages.md](fix-stale-session-crash-on-authed-pages.md). The user
signs in again via the normal login sheet. A refresh-token flow is still out of scope.

## Changes

- `apps/mobile/src/lib/bffClient.ts`: `authedBffFetch` calls a registered
  `setUnauthorizedHandler` callback on any 401, passing the token that was rejected, then
  rethrows. Every 401 the BFF sends on an authed route means the session is over: the guards'
  "Login required", or "This account was deleted". The Google/Apple "invalid token" 401s are on
  unauthenticated login routes, so they never reach this path. A 403 is deliberately not
  treated as a sign-out here, since admin-only routes use it for "not allowed".
- `apps/mobile/src/context/HomeSheetsProvider.tsx`:
  - `endDeadSession(token)` clears state and SecureStore, but only if `token` is still the
    current token. That way a slow request from before a fresh login can't sign the new
    session out.
  - Used by the 401 handler, by `refreshProfile`'s existing 401/403 branch, and by an `AppState`
    listener that checks the JWT's `exp` when the app returns to the foreground.
  - On cold start, an already-expired stored token is discarded before it is ever used.
- `apps/mobile/app/(tabs)/messages/[id].tsx`: renders the `GatedScreen` login prompt when
  signed out, and a "Couldn't load this conversation. Try again" state when the fetch fails,
  instead of an empty thread. The focus refetch is skipped without a token, because TanStack's
  `refetch()` ignores `enabled` and would otherwise send `Bearer null`.

## Caveats

- The push token row stays attached to the user after a dead-session sign-out. The authed
  DELETE can't be made without a valid token. Logging in again re-registers the device anyway.
- Ships to installed apps only via an OTA update or a new build.

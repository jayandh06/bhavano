# Admin: stale session causes unhandled "Login required" crash

## Symptom

Production admin container logs showed a repeating, unhandled SSR exception on every request from
an affected browser:

```
admin-1  | ⨯ Error: Login required
admin-1  |     at m (.next/server/chunks/ssr/_1w7jjbc._.js:414:71362)
```

## Root cause

`apps/admin/src/lib/requireAdmin.ts` — called first by every admin page — only checked that the
NextAuth session cookie existed, had `role === "admin"`, and carried *some* `accessToken` string.
It never checked whether that token was still valid.

The `accessToken` is a BFF-issued JWT with a 1-hour TTL (`ACCESS_TOKEN_TTL` in
`apps/bff/src/auth/auth.service.ts`), but NextAuth's own session cookie (JWT strategy) defaults to
a 30-day lifetime. So an admin's session cookie stays "valid" for weeks after the BFF token inside
it has expired. `requireAdmin()` would pass, the page would then call `authedBffFetch` (e.g.
`fetchAdminListings`), the BFF's `AuthGuard` would correctly 401 with `"Login required"`
(`apps/bff/src/auth/guards/auth.guard.ts`), and — unlike `apps/web`, which has a `BffAuthError`
class caught per-page to redirect gracefully — admin's `bffFetch` had no equivalent handling, so
the plain `Error` bubbled up as an uncaught SSR crash on every subsequent page load until the admin
manually logged out and back in.

## Fix

`requireAdmin()` now decodes the `exp` claim out of the access token (no signature verification —
the BFF remains the sole authority on validity for every real API call; this is purely a
client-side freshness check) and redirects to `/login?error=unauthorized` if it's expired, instead
of letting a doomed BFF call crash the page. See `apps/admin/src/lib/requireAdmin.ts`.

## Immediate workaround (no code change)

Any admin currently hitting this: log out and back in — mints a fresh NextAuth session and a fresh
1h BFF token.

## Out of scope / follow-ups not built here

- No token refresh flow — the admin still has to fully re-authenticate once the 1h token expires;
  this fix only changes *how* that's surfaced (a clean redirect instead of a crash), not the TTL or
  refresh behavior itself.
- `apps/web` already has the per-page `BffAuthError` pattern for this same class of problem; admin's
  `apps/admin/src/lib/bff.ts` could adopt the same `BffAuthError` class for parity/defense-in-depth,
  but wasn't needed since `requireAdmin()` is the single choke point every admin page already calls
  before any data fetch.

# Safely reactivate the BFF's pre-existing @Throttle() rate limits

## Context

The BFF has six routes across `auth.controller.ts` (OTP send/verify/link), `users.controller.ts`
(email verify/merge/delete), `requirements.controller.ts` (create), `analytics.controller.ts`
(pageview/search), and `support.controller.ts` (tickets) that already carry `@Throttle(...)`
decorators, but `ThrottlerGuard` has never been safely bound — the one attempt this session
(binding it globally via `APP_GUARD`) took bhavano.com down, because it applied the default
20-req/60s limit to *every* route, and because web/admin's calls to the BFF are proxied through
Server Actions over an internal Docker URL (`BFF_INTERNAL_URL=http://bff:4000`), so every visitor's
traffic collapses onto one shared source IP at the BFF (the web/admin container's own). That
"shared bucket" is the actual root cause, not just the "global vs per-route" scope — even a
correctly-scoped per-route guard would still throttle *all* web visitors together on routes like
OTP send, since they all still share that one IP.

There's a second, related bug worth fixing at the same time: `apps/bff/src/main.ts` sets
`app.set('trust proxy', true)`, which trusts every hop in `X-Forwarded-For` and takes the
**first** (leftmost) entry as `req.ip` — but that first entry is whatever the caller claims, fully
spoofable. `apps/web/src/middleware.ts`'s own `clientIp()` helper already works around this by
taking the **last** entry instead (the one Caddy itself appends), with a comment explaining
exactly why. So `req.ip` inside the BFF is unreliable today for a second, independent reason, on
top of the shared-internal-IP problem — this affects the `/client-errors` endpoint's IP fallback
too, not just future throttling.

Goal: turn the six existing rate limits into something that actually protects each real visitor
independently, without repeating the outage — and fix `req.ip`'s reliability as the underlying
piece that makes that possible, using the existing `clientIp()` convention rather than inventing
a new mechanism.

## Approach

### 1. Fix IP resolution at the source (`apps/bff/src/main.ts`)

Change `app.set('trust proxy', true)` to `app.set('trust proxy', 1)`. Express's numeric form means
"trust exactly N proxy hops nearest the server," which resolves `req.ip` to the correct hop instead
of blindly trusting the leftmost, spoofable one — the built-in equivalent of what `clientIp()`
already does by hand in `middleware.ts`. Caddy is confirmed to be the only reverse proxy in front
of the BFF for public traffic (no CDN/Cloudflare proxying in front — Cloudflare here is only used
for R2/photo storage, not as a request proxy), so "1 trusted hop" is correct for anything that
reaches the BFF through `api.bhavano.com`.

This alone does **not** fix web/admin's internal calls (`BFF_INTERNAL_URL`), which never go
through Caddy and carry no `X-Forwarded-For` at all today — those still resolve to the container's
own IP. Step 2 fixes that.

### 2. Make web/admin forward the real visitor IP on every internal call

Both `apps/web/src/lib/bff.ts` and `apps/admin/src/lib/bff.ts` have a single low-level
`bffFetch<T>(path, init)` function that every exported call ultimately goes through (confirmed:
~80 call sites in web alone, all funneling through this one function). Update just this one
function in each file to set `X-Forwarded-For` to the real visitor's IP — computed via the same
last-hop-of-`X-Forwarded-For` logic `middleware.ts`'s `clientIp()` already uses, read from
`next/headers()`'s `headers()` (available inside this call chain today — confirmed no page in
`apps/web/src/app` uses static generation/ISR, so calling `headers()` here doesn't change any
page's rendering strategy; every page is already dynamically rendered).

This is a single centralized change per app, not one touching every individual Server Action —
once `bffFetch` sets it, every existing and future call automatically forwards the real IP, and
`trust proxy: 1` (step 1) makes that the *only* entry in the header, so it's trivially "the last
hop" too — the same rule now handles both the Caddy-proxied path (mobile, direct API calls) and
the internal-Docker path (web/admin) uniformly, via Express's own standard resolution — no custom
`ThrottlerGuard` subclass needed.

(Optional, not required for correctness: `apps/web/src/app/actions/clientErrors.ts` and its admin
equivalent currently compute `clientIp()` and pass it explicitly as `ClientErrorInput.ip` for the
same reason. Once `req.ip` is reliable everywhere, that plumbing becomes redundant — could be
simplified to rely on the BFF's fallback alone. Left alone in this plan to avoid touching
already-working, already-deployed code without need; worth a follow-up cleanup, not this pass.)

### 3. Reactivate the six pre-existing throttles — deployed separately from step 1–2

Add `@UseGuards(ThrottlerGuard)` **at the method level**, directly alongside each existing
`@Throttle(...)` decorator — never at the controller level (several of these controllers mix
throttled and unthrottled routes, e.g. `users.controller.ts` has `favourites`/`listings`/
`contact-reveal-credits` alongside the throttled ones — a controller-level guard would catch
those too) and never globally via `APP_GUARD` (confirmed root cause of the outage).

Six call sites, same one-line change each:
- `apps/bff/src/auth/auth.controller.ts` — `otp/send`, `otp/verify`, `otp/link`
- `apps/bff/src/users/users.controller.ts` — `email/request-code`, `email/verify`,
  `merge/confirm`, the delete-account route
- `apps/bff/src/requirements/requirements.controller.ts` — the create route
- `apps/bff/src/analytics/analytics.controller.ts` — `pageview`, `search`
- `apps/bff/src/support/support.controller.ts` — `tickets`

`apps/bff/src/client-errors/client-errors.controller.ts` already has its own working
`@UseGuards(ThrottlerGuard)` from the earlier fix — left as-is.

### Deployment: split into two separate deploys, not one

Ship step 1–2 (IP resolution fix) **on its own first**, with zero new `@UseGuards(ThrottlerGuard)`
added yet — this is a no-risk change (it only changes what value gets logged/would-be-tracked; no
route becomes throttled by it). After deploying, spot-check a few real `client_error` or analytics
log lines in Grafana to confirm the logged `ip` now looks like a real, varied client address
instead of a single repeated internal Docker IP.

Only once that's confirmed correct, ship step 3 (the six `@UseGuards` additions) as its own,
separate deploy. Immediately after that specific deploy — before considering it done — load
several real bhavano.com pages (not just `/health`) the way the outage postmortem now calls for,
and specifically exercise the OTP-send flow a few times to confirm it isn't throttling before
real repeated use would.

## Critical files

- `apps/bff/src/main.ts` — `trust proxy` setting.
- `apps/web/src/lib/bff.ts`, `apps/admin/src/lib/bff.ts` — each app's single `bffFetch` chokepoint.
- `apps/web/src/middleware.ts` — reference implementation for the last-hop `X-Forwarded-For` logic
  to mirror (not modified, just the pattern to reuse).
- The six controllers listed above, one `@UseGuards(ThrottlerGuard)` line each.

## Verification

1. `pnpm --filter bff test`, `pnpm --filter bff typecheck`/`nest build`, `pnpm --filter web
   typecheck`, `pnpm --filter admin typecheck` — all clean, no behavior asserted by existing tests
   should change.
2. Local `nest start`: confirm an undecorated route (e.g. `/listings`) is never throttled under
   burst load, even after step 3 — the actual outage regression test.
3. Local: send requests to a throttled route (e.g. `otp/send`) with two different
   `X-Forwarded-For` values via a direct curl to the BFF — confirm they get independent buckets
   (one hitting its limit doesn't affect the other). Then send several through web's real Server
   Action path (browser → web → BFF) and confirm the forwarded real IP is what's actually tracked,
   not the container's.
4. Deploy step 1–2 alone; verify real IPs show up correctly in logs before proceeding.
5. Deploy step 3 alone; immediately load-test a handful of real pages plus the OTP flow, per the
   plan doc's updated verification section, before calling it done.
6. Update `docs/plans/client-error-reporting-loki-grafana.md`'s "Implementation notes" once this
   lands, since it currently says the six routes are "left exactly as inert as they were" — that
   will no longer be true.

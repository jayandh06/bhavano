# Report client (web/mobile/admin) UI errors to Loki/Grafana

**Status: implemented and deployed.** Web, admin, mobile, and the BFF endpoint are all live. One
part of the original approach — globally activating every pre-existing `@Throttle()` decorator via
`APP_GUARD` — caused a real production outage on first deploy and was reverted; see
"Implementation notes" at the end for what happened and what actually shipped instead.

## Context

Client-side crashes were previously invisible after the fact — confirmed while researching this:
web's `error.tsx` and mobile's `ErrorBoundary` both only showed a fallback UI, admin had no error
boundary at all, and nothing anywhere (`window.onerror`, `unhandledrejection`, `ErrorUtils`,
`instrumentation.ts`) caught an error outside a React render boundary. This plan wires all three
apps into the BFF's existing pino/Loki pipeline (`docs/plans/bff-loki-grafana-logging.md`,
extended by `docs/plans/third-party-api-call-audit-logging.md`), the same one Grafana Explore
already reads from.

**A real gap found while researching this, not part of the original ask, but necessary to fix
alongside it**: `@nestjs/throttler` is installed and `@Throttle(...)` decorators are scattered
across `auth.controller.ts`, `analytics.controller.ts`, `requirements.controller.ts`, and others —
but `ThrottlerGuard` was never bound (no `APP_GUARD` provider, no `app.useGlobalGuards`, no
per-route `@UseGuards(ThrottlerGuard)`). NestJS requires the guard to be bound for `@Throttle`
metadata to do anything, so **every one of those existing limits was inert**. This matters
directly here: the new endpoint is public, unauthenticated, and reachable from any browser (CORS
is already wide open — `app.enableCors({ origin: true, credentials: true })` in `main.ts`) — it
needs real throttling to be safe from log-flooding, and fixing the missing binding is what makes
that (and every existing `@Throttle`) work.

## Approach

### BFF: the endpoint, and a throttle-guard attempt that had to be walked back

1. **`apps/bff/src/app.module.ts`** — originally bound `{ provide: APP_GUARD, useClass:
   ThrottlerGuard }` globally, intending to activate every pre-existing `@Throttle()` decorator
   in the codebase at once. **This caused a production outage** (bhavano.com showing "Something
   went wrong" on nearly every page) and was reverted — see "Implementation notes" below for what
   actually happened and what shipped instead. `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20
   }])` is still registered for its config/storage, but nothing binds the guard globally.

2. **New module `apps/bff/src/client-errors/`** — `POST /client-errors`, mirroring
   `analytics.controller.ts`'s `POST /analytics/visit` (public, unauthenticated, `@IsOptional()`/
   `@MaxLength(...)` DTO fields, relying on the global `ValidationPipe({ whitelist: true,
   transform: true })` already set in `main.ts`). `@Throttle({ default: { limit: 10, ttl: 60_000
   } })` — an IP can report at most 10 crashes/minute, enforced via `@UseGuards(ThrottlerGuard)`
   at the method level (not global — see "Implementation notes"). Its failure mode if ever
   throttled is just dropped log volume, not broken functionality — deliberately the one route
   this shipped with the guard actually active on.

   DTO (`CreateClientErrorDto`): `app: 'web' | 'admin' | 'mobile'` (`@IsIn`, required),
   `message` (`@IsString`, `@MaxLength(500)`), `stack?` (`@MaxLength(8000)`), `componentStack?`
   (`@MaxLength(4000)`, React's own field), `url?`/`digest?`/`userAgent?`/`appVersion?`
   (`@MaxLength(300–500)` each), `userId?` (`@MaxLength(64)` — client-asserted only, never
   authenticated; logged as a debugging hint, never trusted for authorization), `ip?`
   (`@IsIP()`, see below). Every field besides `app`/`message` is optional, so a partial report
   (e.g. mobile with no `digest`) still goes through.

3. **`apps/bff/src/logging/clientErrorLogger.ts`** — same shape as `thirdPartyCallLogger.ts`'s
   `logThirdPartyCall` (object-first pino logging via `@InjectPinoLogger`/`PinoLogger`,
   `logger.error({...fields}, 'client_error')`). Logs unconditionally at error level.

4. **`observability/alloy-config.alloy`** — promoted a new `app` label (`web`/`admin`/`mobile`)
   alongside `provider`/`level`/`service`, so `{service="bff", app="mobile"}` is a fast first
   filter distinct from `provider=...`.

### Web (`apps/web`)

- `apps/web/src/lib/bff.ts` — `reportClientError(input)`, fire-and-forget (swallows its own
  failure — a failed error *report* must never itself surface as a second error).
- `apps/web/src/app/actions/clientErrors.ts` (new, `"use server"`) — thin action wrapper, the
  normal Server-Action-proxy path every BFF call in this app uses (except the two already-
  documented exceptions: `videoUpload.ts`'s direct XHR, and Socket.IO). Forwards the visitor's
  real IP via the last hop of `X-Forwarded-For` (same trust reasoning as `middleware.ts`'s own
  `clientIp()`), since a Server-Action-proxied call reaches the BFF from the web container itself,
  not the visitor's browser.
- `apps/web/src/app/error.tsx` — renamed its component from `GlobalError` to `RouteError` (to
  avoid confusion with the new true `global-error.tsx`); reports in a `useEffect` on mount.
- `apps/web/src/app/global-error.tsx` (new) — Next's root-layout-level boundary, the one class of
  client crash `error.tsx` alone cannot catch. Renders its own full `<html>/<body>` with hardcoded
  inline styles rather than Tailwind utility classes, since the CSS custom properties those depend
  on might not reliably resolve in this fully-isolated fallback.

### Admin (`apps/admin`)

- `apps/admin/src/lib/bff.ts` — `reportClientError(input)`, same shape as web's.
- `apps/admin/src/app/actions/clientErrors.ts` (new) — same `clientIp()`/action-wrapper pattern
  as web's, **deliberately not gated by `requireAdmin()`** (unlike every other action in that
  directory) — a crash can happen on admin's own login page, before any session exists.
- `apps/admin/src/app/error.tsx` (new — admin had none before this). Admin has no `@theme inline`
  Tailwind token mapping the way web does (confirmed: `apps/admin/src/app/globals.css` has no
  `@theme` block, and every existing admin page styles with inline `style={{ background:
  "var(--bg)", ... }}` rather than utility classes — see `apps/admin/src/app/page.tsx`), so this
  file uses the same inline-style convention rather than web's Tailwind classes.

### Mobile (`apps/mobile`)

- `apps/mobile/src/lib/bffClient.ts` — `reportClientError(input)` using the existing plain
  (no-token) `bffFetch`. No `ip` field is sent — unlike web/admin, this app calls the BFF
  directly, so `req.ip` there is already correct without needing to forward anything explicitly.
- `apps/mobile/src/components/ErrorBoundary.tsx` — implemented `componentDidCatch(error,
  errorInfo)` (previously missing entirely, so the boundary could only ever see *that* a child
  crashed, never the error itself). Reports `{ message, stack, componentStack, appVersion,
  userId }`. Gained a new optional `userId` prop so a caller can attach it without the boundary
  needing to reach into auth state itself.
- `apps/mobile/app/_layout.tsx` — added a new top-level wrap: `AppCrashBoundary`, a small
  component rendered as a child of `HomeSheetsProvider` (so it can call `useHomeSheets()` for
  `userId` — `null` before login, same as every other consumer of that hook) that wraps
  `ErrorBoundary` around the rest of the navigation tree. The existing narrow usage around
  `LocationMapPicker` is unchanged. Also added a module-level `ErrorUtils.setGlobalHandler` call
  (via `globalThis as { ErrorUtils?: ErrorUtils }`, since RN's `ErrorUtils` global has no
  ambient type declaration in this codebase) that reports the error and then re-invokes whatever
  default handler was previously installed (`getGlobalHandler()`, captured first) — this only
  adds a report, it doesn't change the app's existing crash/restart behavior.

## Explicitly out of scope

- A Sentry/Bugsnag-style SDK — the ask is specifically to land these in the Loki/Grafana pipeline
  already built and paid for, not stand up a second tool.
- Source-map deobfuscation of a minified web/mobile stack trace — the raw (possibly minified)
  stack is logged as-is.
- Any change to what happens to the user after a crash (still shows the same fallback UI / RN's
  own restart behavior) — this only adds a report, never new user-facing behavior.
- A dashboard panel for client errors — Grafana Explore (`{service="bff", app="mobile"} | json`)
  is enough to start.

## Critical files

- `apps/bff/src/app.module.ts` — `LoggingModule`'s import statement moved to be the last one in
  the file (see "Implementation notes"). Does **not** bind `ThrottlerGuard` globally — that was
  tried and reverted after it took production down.
- `apps/bff/src/client-errors/` — controller, DTO, module.
- `apps/bff/src/logging/clientErrorLogger.ts` — logging helper, sibling to
  `thirdPartyCallLogger.ts`.
- `observability/alloy-config.alloy` — `app` label.
- `apps/web/src/lib/bff.ts`, `apps/web/src/app/actions/clientErrors.ts`,
  `apps/web/src/app/error.tsx`, `apps/web/src/app/global-error.tsx`.
- `apps/admin/src/lib/bff.ts`, `apps/admin/src/app/actions/clientErrors.ts`,
  `apps/admin/src/app/error.tsx`.
- `apps/mobile/src/lib/bffClient.ts`, `apps/mobile/src/components/ErrorBoundary.tsx`,
  `apps/mobile/app/_layout.tsx`.
- `packages/types/src/index.ts` — shared `ClientErrorInput` interface, the same
  cross-app "Input" convention as `CreateRequirementInput` etc.

## Verification

1. `pnpm --filter bff test` — new tests for `CreateClientErrorDto` validation and
   `clientErrorLogger`; existing suite unaffected (384/384 passing).
2. Typecheck: `bff`, `web`, `admin` all clean; mobile clean using the established
   `--stack-size=8000` workaround for a known tsc stack-depth crash on deeply-nested JSX.
3. Local `nest start` smoke test (not just typecheck/build/unit-tests, none of which exercise
   Nest's real DI container): `POST /client-errors` with a valid body returns `204` and produces
   a correctly-shaped `client_error` pino log line; 12 rapid requests get throttled at the 10th
   (`429`). Note: this smoke test was run *before* the `APP_GUARD` global binding was reverted, so
   it also showed OTP-send throttling working — that observation no longer reflects deployed
   behavior; see "Implementation notes".
4. Deploy (bff + alloy restart). In Grafana Explore, `{service="bff", app="web"} | json` after
   triggering a real web crash should show the line with a readable stack trace.
5. After any future change to `app.module.ts` guard/provider bindings, load a few real pages
   (not just `/health`) before considering the deploy done — `/health` alone did not catch the
   outage this shipped with the first time (see "Implementation notes").

## Implementation notes (decided while building, not fixed in advance by this doc)

- **A genuinely subtle nestjs-pino bug was found and fixed along the way**: `nestjs-pino`'s
  `LoggerModule.forRootAsync()` snapshots every `@InjectPinoLogger(...)` context name
  *synchronously*, the moment its own import statement is evaluated by Node — not lazily during
  Nest's bootstrap. Since `ClientErrorsService` is a new `@InjectPinoLogger` consumer, and
  `LoggingModule`'s import statement in `app.module.ts` wasn't already the last one in the file,
  Node evaluated it before `client-errors.module.ts` was `require()`'d, so
  `ClientErrorsService`'s context name missed the snapshot — `UnknownDependenciesException` at
  boot. This is invisible to `tsc --noEmit`, `nest build`, and Jest unit tests that construct
  services via `new ServiceClass(...)` directly (bypassing Nest's DI container) — it only surfaces
  when the app actually boots. Fixed by moving `LoggingModule`'s import *statement* (not its
  position in the `imports:` array, which is unaffected) to be the last import in
  `apps/bff/src/app.module.ts`, guaranteeing every other module's classes — and their
  `@InjectPinoLogger` decorators — run first. Verified via a real local `nest start`, not just a
  green typecheck/build/test suite.
- Admin's `error.tsx` uses inline styles (matching admin's own existing convention), not the
  Tailwind utility classes web's `error.tsx` uses — admin has no `@theme inline` token mapping.
- Mobile's top-level error boundary lives inside `HomeSheetsProvider` (via the small
  `AppCrashBoundary` wrapper) specifically so it can attach `userId` to a report.
- **Binding `ThrottlerGuard` globally via `APP_GUARD` caused a real production outage and was
  reverted.** `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])` sets a *default* limit that
  `APP_GUARD` applies to every route with no `@Throttle()`/`@SkipThrottle()` of its own — not just
  the pre-existing decorated ones. Within minutes of deploying it, bhavano.com showed "Something
  went wrong" on nearly every page: web's SSR data fetches (`/listings`, `/locations/cities`,
  `/plans/pricing`, `generateMetadata`, etc.) all proxy through Server Actions, so every one of
  them reaches the BFF from the **web container's own IP**, not the visitor's — exactly the same
  problem `ClientErrorInput.ip` was built to work around for the new endpoint. Every web visitor's
  traffic collectively shared one 20-requests-per-60-seconds bucket and exhausted it almost
  immediately, throwing `ThrottlerException` on nearly every server-rendered page.
  Fixed by removing the `APP_GUARD` binding entirely and instead adding
  `@UseGuards(ThrottlerGuard)` at the **method level**, only on `POST /client-errors` — the one
  route new to this change, where dropping some log volume under load is an acceptable failure
  mode. The pre-existing `@Throttle()` decorators on `auth.controller.ts` (OTP send/verify/link),
  `users.controller.ts`, `requirements.controller.ts`, `analytics.controller.ts`, and
  `support.controller.ts` were **left exactly as inert as they were before this session** — same
  status quo as pre-change, not reactivated. Reactivating those needs its own design first (e.g.
  throttling on a real visitor IP forwarded explicitly by web/admin's Server Actions, the way
  `/client-errors` already does, rather than on `req.ip`), and doing it correctly is a separate
  follow-up, not something to attempt again casually.

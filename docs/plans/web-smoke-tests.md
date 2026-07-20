# Web smoke-test suite (Playwright)

## Context

This session alone shipped, then had to re-fix, two regressions that were only caught by manual
curl-probing and reasoning about React/Next.js remount semantics: `PostAdWizard`'s city `<select>`
not resetting across a client-side nav to `/post` with a different city, and `PageHeader`/`Footer`
silently hardcoding a default city (dropping the "Areas in {City}" footer block and showing the
wrong "Showing ads near" chip) on every account page. Neither apps/web, apps/admin, nor
apps/mobile has any automated test tooling today — only apps/bff has Jest configured, with zero
test files written. No CI exists in the repo at all (no `.github/` directory).

Goal: a **web-only Playwright smoke suite** the user runs locally after finishing a feature or
large change, to catch this exact class of regression (stale client state across navigation,
city/context dropped on a page transition, filter/sort/pagination breakage) before it ships.
Scoped per explicit decisions: web only (not bff/admin/mobile), run against already-running dev
servers (`pnpm dev`), and authenticated flows use a minted-session bypass rather than driving the
real OTP/Google login (which can't be automated locally — MSG91 throws without real credentials,
and there's no dev bypass in the BFF today).

## Tooling

**Playwright** (`@playwright/test`, added as a devDependency of `apps/web` only) — first-class
Next.js support, single `playwright test` command, headless by default, TypeScript-native,
built-in trace/screenshot-on-failure for debugging a red run, and a `storageState` mechanism that
fits the auth-bypass design below exactly.

## New test-only surface: `apps/web/e2e/`

- `apps/web/playwright.config.ts` — `baseURL: process.env.SMOKE_BASE_URL ?? "http://localhost:3000"`,
  `use: { trace: "on-first-retry", screenshot: "only-on-failure" }`. Two projects: `setup` (runs
  once, produces the auth storage state) and `chromium` (`dependencies: ["setup"]`,
  `storageState` pointed at the file `setup` wrote). **No `webServer` block** — per the
  "already-running dev servers" decision, the suite assumes `pnpm dev` (web + bff, against the
  existing docker-compose Postgres) is already up; Playwright's own connection retry/timeout
  surfaces a clear error if it isn't.
- `apps/web/e2e/setup/auth.setup.ts` — the one Playwright "setup project" test: calls the new BFF
  dev-login endpoint (below) for the seeded demo user (phone `9999999999`, from
  `apps/bff/prisma/seed.ts`), gets back `{ accessToken, user }`, then uses `next-auth/jwt`'s
  `encode()` (same `NEXTAUTH_SECRET` the app's `session: { strategy: "jwt" }` config already uses,
  see `apps/web/src/auth.ts`) to produce the exact encrypted cookie value a real login would leave
  behind — embedding `{ sub: user.id, accessToken, name, email }`, matching the `jwt()`/`session()`
  callback shape in `auth.ts` exactly. Injects it as the `authjs.session-token` cookie via
  `context.addCookies()`, then `context.storageState({ path: ... })` for reuse by every
  authenticated spec — the standard Playwright pattern for this, done once instead of per-test.
- `apps/web/e2e/tsconfig.json` — scoped separately from the app's own `tsconfig.json` so Playwright
  types don't leak into `pnpm -w typecheck` / the production build.
- `apps/web/package.json` — add `"test:e2e": "playwright test"`.

## One small BFF addition (the only non-test-infra code change)

`apps/bff/src/auth/auth.controller.ts` gets `POST /auth/dev-login { phone: string }`:
- First line: `if (process.env.NODE_ENV === "production" || !process.env.ALLOW_DEV_LOGIN) throw new NotFoundException()` —
  double-gated (env check *and* a dedicated opt-in flag, unset/false by default) so it can never be
  accidentally reachable outside a local/test run, even on a misconfigured non-prod deploy.
- Looks up the user by phone (404 if not found — the smoke suite relies on the existing seed
  script having already run, doesn't create its own user), then reuses the *existing*
  `issueSession()` private method in `auth.service.ts` (exposed via one new thin public method
  rather than duplicating the `jwt.sign({ sub, role }, AUTH_JWT_SECRET, ...)` logic a second time)
  to return `{ accessToken, user }` — identical shape to every other login path.

## Test files (`apps/web/e2e/*.spec.ts`)

Grouped around the actual flows/regressions from this session, against existing seed data
(cities: Bengaluru, Mumbai, Pune, Hyderabad; ~10 demo listings across categories):

1. **`homepage.spec.ts`** (public) — loads, default city renders, category tabs switch, listing
   grid renders seeded listings, pagination works.
2. **`city-switching.spec.ts`** (public) — select a new city via `LocationPicker` on the homepage:
   URL, header chip, and footer "Areas in {City}"/"Browse Cities" all update together; repeat on a
   `/{city}/...` browse page.
3. **`browse-filters.spec.ts`** (public) — on a `/{city}/buy/apartment`-style page: Area
   multi-select, BHK, price bracket, furnishing, and Sort By all narrow/reorder results correctly;
   `?areas=` query-param round-trips.
4. **`listing-detail.spec.ts`** (public) — open a seeded listing from the grid; title/price/specs/
   photos/breadcrumbs render, JSON-LD present.
5. **`post-ad-city-default.spec.ts`** (authenticated) — *regression test for today's bug*: select
   a city on the homepage, click "+ Post free ad", assert the wizard's City `<select>` shows that
   city; then revisit `/post` a **second** time with a *different* city (without a full page
   reload) to specifically catch the stale-remount case the `key` prop fix addressed.
6. **`header-footer-city-consistency.spec.ts`** (authenticated) — *regression test for today's
   second bug*: from a city-selected state, visit Favourites/Messages/Profile/My-listings
   (parametrized over all four) and assert the header chip and footer "Areas in {City}" block both
   match the selected city on every one — catches the `PageHeader`/`Footer` hardcoded-default class
   of bug wholesale.
7. **`favourites-flow.spec.ts`** (authenticated) — favourite a listing from the grid, confirm it
   appears on `/favourites`.

Files 2, 5, and 6 are effectively pinned-down regression tests for the exact bugs just fixed —
build and verify these first.

## Verification

- With `pnpm dev` running (web + bff, existing docker-compose Postgres) and the DB seeded
  (`pnpm --filter @bhavano/bff prisma:seed`), ran `pnpm --filter @bhavano/web test:e2e` —
  18 passed, 1 correctly skipped (homepage pagination — seed data doesn't span a second page for
  the default tab/city), stable across 3 consecutive full-suite runs.
- Playwright's own default (8 parallel workers) caused React-hydration-timing flakiness under
  contention against the single shared dev-mode server — reliable at `workers: 4` instead (set
  in `playwright.config.ts`, along with `retries: 1` to absorb any remaining environmental noise
  without masking a real, consistently-reproducing regression).
- `pnpm -w typecheck` (root) plus `npx tsc -p e2e/tsconfig.json` (the e2e suite's own scoped
  config) both clean.
- Sanity-checked both regression tests are real, not tautological, by reverting the actual fix
  and confirming red, then restoring:
  - **spec 6** (`header-footer-city-consistency`): reverting `PageHeader`'s `cityName` override
    back to hardcoded Bengaluru reliably turned all 4 sub-tests red.
  - **spec 5** (`post-ad-city-default`): reverting the `?city=` link-threading in
    `HeaderAuthButtons` (the actual root-cause fix) turned both sub-tests red, as expected.
    Reverting *only* the `key` prop on `PostAdWizard`, however, did **not** reproduce the bug —
    empirically, this Next.js version already remounts the page's client-component tree across a
    same-route/different-search-param navigation, so the `key` turned out to be unnecessary
    belt-and-suspenders rather than the actual fix. Left in place (harmless, matches React's own
    recommended pattern for this class of bug), but spec 5's docstring was corrected to not
    overclaim what it verifies.
- Two non-obvious timing issues surfaced while building this out, both fixed in
  `e2e/support/selectCity.ts` and the specs that chain multiple interactions: (1) clicking the
  `LocationPicker` chip immediately after a prior client-side navigation could hit the button
  mid-hydration (`waitForLoadState("networkidle")` + a short fixed buffer before *and* after the
  city-select interaction fixed it); (2) clicking a nav `<Link>` immediately after `selectCity()`
  could silently no-op (no navigation, no error) — fixed by pairing every such click with
  `Promise.all([page.waitForURL(...), locator.click()])` instead of asserting the URL
  afterward, which had been silently passing against the *previous* page.

## Explicitly out of scope (follow-ups, not built here)

- **apps/bff** API-level Jest/Supertest smoke tests — Jest is already configured there with zero
  tests written; natural next step once this web suite is in place.
- **apps/admin**, **apps/mobile** — no e2e coverage in this pass.
- **CI wiring** — no `.github/workflows` exists in this repo at all; this suite is designed for a
  manual/local run against dev servers per the decision above. Wiring it into CI is a separate,
  later decision once a CI pipeline exists.

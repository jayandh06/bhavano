# CI checks on push and pull request

## What runs

`.github/workflows/ci.yml`, on every push to `master`, every pull request, and on demand (Actions > CI > Run workflow). It deploys nothing.

**Job "Type checks and unit tests"** (about 5 minutes):
1. Installs with `pnpm install --frozen-lockfile`, builds `packages/types`, and **fails if `packages/types/dist` changes** (the compiled
   output is committed and the apps import it; a change means `src/` was edited without committing the rebuild).
2. Type checks `types`, `bff`, `web`, `admin`, and the mobile app (which needs `node --stack-size=8000`, the default stack overflows).
3. Unit tests: BFF (Jest, 1,397 tests), web (Vitest, 151), admin (Vitest, 76), mobile (Jest, 86).

**Job "Browser tests (Playwright)"** (about 8 minutes): a Postgres service, migrations and seed, the BFF and the web dev server, a warm-up
visit to each page, then the 24 browser checks in `apps/web/e2e` (2 skip by design). On failure it uploads the Playwright report and the
server logs. Details and how to run it locally: `apps/web/e2e/README.md`.

## How it was checked

Both jobs were run step by step in a clean checkout of the commit (a git worktree with no `.env` files and no cached build), using the same
commands and environment variables as the workflow. That clean run found three problems, all fixed before this was committed:
- A **port clash**: `PORT=4000` set for the whole job was also read by `next dev`, which took the BFF's port. Each server now gets its own.
- **Cold-start timeouts**: on a fresh dev server three header/footer tests timed out and passed warm. A warm-up step now visits the pages
  first; with it a cold run gave 23 passed and 1 flaky (retried), so CI allows 2 retries.
- The **mobile unit tests** were broken by this session's own change (an `expo-constants` import in `bffClient.ts` that Jest cannot load);
  the spec now mocks it and covers the new feedback call. A date-dependent BFF referral test (a fixed 1 Oct click date outside the 30-day
  window since 31 Oct) was also fixed.

## Not covered

- Lint (`eslint`) is not run; it was not checked clean, and fixing it first would be a separate job.
- The browser tests use a local dev server and a seeded database, with no payments, messaging, maps or file storage. So checkout, sending
  notifications, the map pin and photo upload are not exercised (the "posts, photos included" check is skipped unless `E2E_CAN_UPLOAD=1`).
- No tests of the notification and alert-preference screens, saved searches, messaging screens, the post-ad success and Featured offer, the
  feedback card, the admin app, or the mobile app UI. See `docs/plans/web-smoke-tests.md`.

## Making it a gate

Right now a red run is a notice, not a block. To stop merges and deploys on red: GitHub > Settings > Branches > a rule for `master` that
requires the two checks. `scripts/deploy-local-to-ec2.ps1` builds on this machine and does not look at CI.

## First runs on GitHub (3 Nov 2026)

- **First run (`6ad07230`):** type checks and unit tests green; the browser tests failed. Four tests (the three header/footer city checks and the
  repeat-visit post-ad check) timed out on a click: the seeded demo user has no email, so an "Add your email" prompt opens over the page on a
  slower machine and blocks clicks. It had never shown up on the fast local machine.
- **Fix (`61417ae3`):** one shared fixture (`apps/web/e2e/support/fixtures.ts`) dismisses that prompt in every spec. Second run: **both jobs
  green**. The failure report (screenshots and server logs) uploaded by the first run is what made it quick to diagnose.


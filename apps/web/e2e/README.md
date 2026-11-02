# Web browser tests (Playwright)

24 checks across 11 specs: homepage, browse filters, city switching, favourites, listing detail, header/footer city, residential details,
and the post-ad flow (city carried into /post, draft offer, draft photo restore, preview Back). Design notes: `docs/plans/web-smoke-tests.md`.

## Run them

The suite talks to a local web server, BFF and Postgres. Nothing is started for you.

```bash
# 1. A local Postgres (the plain postgres image is enough; the app uses no PostGIS or Typesense)
docker run -d --name bhavano-e2e-pg -p 5432:5432 -e POSTGRES_USER=bhavano -e POSTGRES_PASSWORD=bhavano -e POSTGRES_DB=bhavano postgres:16-alpine
cd apps/bff && npx prisma migrate deploy && npx prisma db seed

# 2. The BFF (apps/bff/.env needs ALLOW_DEV_LOGIN=true) and the web app. The web app MUST run with NEXTAUTH_URL=http://localhost:3000:
#    apps/web/.env points it at https://local.bhavano.com, which makes the app look for a differently named session cookie than the tests
#    create, so every logged-in check silently runs as a guest.
npx nest start
NEXTAUTH_URL=http://localhost:3000 AUTH_URL=http://localhost:3000 npx next dev    # in apps/web

# 3. Run
cd apps/web && npx playwright test
```

A full run takes about a minute once the dev server is warm. The first hit of each page compiles it, so a cold run can be slower.

## In CI

`.github/workflows/ci.yml` runs this suite (job "Browser tests") on every push to master and every pull request, with a Postgres service,
the two servers started as above, and a warm-up visit to each page first (a cold dev server compiles pages on demand and times out the first
tests that open them). It runs with no `.env` files and only the variables listed in the workflow. A failed run uploads the Playwright
report and both server logs as the `playwright-failures` artifact. See `docs/plans/ci-checks.md`.

## Things to know

- The seeded demo user ("Seed Owner") owns every seeded listing. Public specs (homepage, browse filters, listing detail) therefore run as a
  guest; a logged-in view hides the Contact buttons on the owner's own ads.
- The post-ad specs do not type the form: `support/postAd.ts` seeds a draft in the browser (fields, pin and city from the admin test
  scenarios in `src/lib/postAdScenarios.ts`). The location step needs a Google Maps pin, which a local dev server does not have.
- "a reloaded draft posts, photos included" is skipped unless `E2E_CAN_UPLOAD=1`: publishing uploads photos, and a plain local BFF has no
  object storage (`POST /uploads` answers 500). Set it where storage is configured.
- The homepage pagination check skips when the seed data has only one page.
- A failed run can leave state behind (for example a favourited listing); the favourites test resets it before it starts.

## Not covered (yet)

Notification and alert preferences, saved searches, messaging screens, the post-ad success screen and Featured offer, the feedback card,
checkout, the admin app, and the mobile app. See the list in `docs/plans/web-smoke-tests.md`.

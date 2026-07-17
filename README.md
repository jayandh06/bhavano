# Bhavano

Classifieds platform for real estate and furniture (buy/sell/rent/lease). See [docs/PRD.md](docs/PRD.md) for full product and technical requirements.

## Structure

- `apps/web` — Next.js (App Router) storefront. Server Components/Actions only, no client-callable API.
- `apps/bff` — NestJS Backend-for-Frontend gateway used by both web and mobile.
- `apps/admin` — Next.js listing-moderation app (`admin.bhavano.com` in production), restricted to
  accounts allowlisted via `ADMIN_PHONES`/`ADMIN_EMAILS` on the BFF.
- `apps/mobile` — React Native (Expo) app.
- `packages/types` — shared TypeScript types across apps.

## First-time setup

```sh
pnpm install

# Copy env templates and fill in real values (Google OAuth client ID/secret, JWT secrets, etc.)
cp apps/web/.env.example apps/web/.env
cp apps/bff/.env.example apps/bff/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env

# Start Postgres+PostGIS, Redis, and Typesense (see below)
docker compose up -d

# Create the schema and load sample listings
cd apps/bff
npx prisma migrate dev
npx prisma db seed
cd ../..
```

## Local dev infra

`docker-compose.yml` (repo root) provides Postgres+PostGIS, Redis, and Typesense — required before
running `apps/bff`, since it connects to Postgres on startup:

```sh
docker compose up -d
```

**This is the most common cause of a "fetch failed" or "Internal server error" in the web app** —
if your machine slept or Docker Desktop restarted, these containers stop and don't restart
themselves. Check with `docker ps` and re-run `docker compose up -d` if they're not listed as `Up`.

## Running everything together

```sh
pnpm dev
```

Runs `dev` across all apps (`web`, `bff`, `mobile`) in parallel via Turborepo. If one app's `dev`
task fails (e.g. `mobile` errors because Expo can't start), the others may still be fine — check
which package actually failed in the output rather than assuming the whole thing is broken, and
consider starting that one app individually (see below) to see its error in isolation.

## Running an individual app

Each app can be run standalone from the repo root:

```sh
pnpm --filter @bhavano/web dev      # Next.js — http://localhost:3000 (auto-picks another port if taken)
pnpm --filter @bhavano/bff dev      # NestJS — http://localhost:4000
pnpm --filter @bhavano/admin dev    # Next.js (admin) — http://localhost:3001
pnpm --filter @bhavano/mobile dev   # Expo — prints a QR code; scan with Expo Go, or press `i`/`a` for a simulator
```

`admin` needs a phone/email in `bff`'s `ADMIN_PHONES`/`ADMIN_EMAILS` env vars before that account can
actually see anything — everyone else gets bounced back to `/login` on that app.

`web` needs `bff` running to load any real data (listings, cities, auth) — a "fetch failed" error
from `apps/web/src/lib/bff.ts` almost always means the BFF (or its Postgres connection) isn't up
yet, not a code problem. Start `bff` first, wait for `Nest application successfully started`, then
start/reload `web`.

## Building an individual app

```sh
pnpm --filter @bhavano/types build   # must run first if you've changed shared types — other apps
                                      # import the built dist/, not the source directly
pnpm --filter @bhavano/web build
pnpm --filter @bhavano/bff build
pnpm --filter @bhavano/admin build
```

Or build everything via Turborepo's dependency graph (builds `types` before `web`/`bff` automatically):

```sh
pnpm build
```

## Common gotchas

- **PowerShell refuses to run `pnpm`** (`running scripts is disabled on this system`): run
  `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once, or use Git Bash instead.
- **`EADDRINUSE` / "another dev server is already running"**: a previous `dev` process (often from
  a crashed Nest `--watch` restart) is still holding the port. Find it with
  `netstat -ano | findstr :4000` (or `:3000` for web) and `taskkill /PID <pid> /F`.
- **Wrong directory**: `pnpm` commands must run from inside `bhavano/` (or use `--filter` from the
  repo root) — running them from the parent folder containing multiple unrelated repos fails with
  `No package.json found`.

## Production deployment

See [docs/deployment.md](docs/deployment.md) for the full EC2 + Docker Compose deployment runbook —
unrelated to local dev above.

## Status

Core marketplace flows are implemented: browsing/search with filters, schema-driven posting wizard,
favourites, view counts, real-time messaging, phone-OTP and Google auth, SEO-friendly URLs with
sitemap/robots.txt, listing moderation via a separate admin app (flag/approve, admin↔owner
messaging), and a Docker Compose production deployment. See [docs/PRD.md](docs/PRD.md) for
product/technical requirements and open items.

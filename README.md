# Bhavano

Classifieds platform for real estate and furniture (buy/sell/rent/lease). See [docs/PRD.md](docs/PRD.md) for full product and technical requirements.

## Structure

- `apps/web` — Next.js (App Router) storefront. Server Components/Actions only, no client-callable API.
- `apps/bff` — NestJS Backend-for-Frontend gateway used by both web and mobile.
- `apps/mobile` — React Native (Expo) app.
- `packages/types` — shared TypeScript types across apps.

## Local dev infra

`docker-compose.yml` provides Postgres+PostGIS, Redis, and Typesense for local development:

```sh
docker compose up -d
```

## Getting started

```sh
pnpm install
pnpm dev
```

Runs `dev` across all apps via Turborepo. Individual apps can also be run from their own directory (`pnpm --filter @bhavano/web dev`, etc.).

## Status

Initial monorepo skeleton — apps scaffolded, no business logic yet. See "Open Items" in the PRD for what's next.

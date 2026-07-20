# BFF request/response logging via Loki + Grafana

## Context

The app currently has zero structured logging — the BFF's only output is Nest's default console
logger (3 files call it directly, plain unstructured text to stdout). The recent EC2 incident this
session (`invalid input value for enum "ListingCategory": "plot"`, a missed Prisma migration) was
only diagnosable by scrolling raw `docker compose logs` output. There's no way today to answer
"what did user X do," "how many requests are failing," or "how slow is this endpoint" without
grepping container logs by hand.

Goal: every BFF request/response gets a structured, correlated log line (who, what, how long, what
broke), written asynchronously to a rotating file on a Docker volume, shipped by **Grafana Alloy**
into Loki, and searchable/filterable in Grafana — reachable at its own public subdomain.

Using Alloy rather than Promtail deliberately: Grafana put Promtail into maintenance mode (security
fixes only, no new features) and now recommends Alloy — their unified OpenTelemetry-based collector
— for any new log-shipping setup. Functionally it does the same job here (tail files on the shared
volume, parse JSON, push to Loki), just with Alloy's own config language and image.

**Decisions already confirmed:**
- **Scope: BFF only.** apps/web/apps/admin have no middleware.ts/instrumentation.ts today and are
  pure SSR/Server-Action callers into the BFF — all meaningful request/error/user activity already
  concentrates there. Revisit later if needed.
- **Grafana: public**, its own subdomain behind Caddy (matching how `web`/`bff`/`admin` already get
  one each), with Grafana's own login hardened (no anonymous access, no self-signup).
- **Metadata only** — method, path, status, duration, userId, ip, user-agent, error. **Never**
  request/response bodies, so there's no redaction rule to get wrong or forget.
- **All timestamps this feature touches are IST (`Asia/Kolkata`), not UTC** — pino's own log
  timestamps, and Grafana's display timezone (both detailed in sections 1/2/4 below). This plan
  only covers what's newly built here; auditing *every* existing timestamp elsewhere in the app
  (Prisma `createdAt`/`updatedAt` columns, JWT `iat`/`exp`, "posted 2 hours ago"-style relative-time
  display in `apps/web`/`apps/mobile`, listing expiry dates, etc.) is a separate, considerably
  larger effort spanning all four apps — flagged here as a real, worthwhile follow-up, not silently
  bundled into this docker/logging change.

## 1. BFF logging library — `nestjs-pino`

Add to `apps/bff/package.json`: `nestjs-pino`, `pino`, `pino-http` (transitive), `pino-roll`
(rotation transport). Optional: `ua-parser-js` for a `deviceType` bucket (nice-to-have, not a
blocker).

**`apps/bff/src/logging/logging.module.ts`** (new) — wraps `LoggerModule.forRootAsync` from
`nestjs-pino`, imported first in `app.module.ts`. Key `pinoHttp` config:
- `genReqId`: reuse an incoming `x-request-id` header if present, else `crypto.randomUUID()`;
  echoed back as a response header for client-side correlation.
- `customProps(req)`: injects `userId: req.user?.id ?? null`, `role: req.user?.role ?? null`.
  Safe to read here — `AuthGuard`/`OptionalAuthGuard` (`apps/bff/src/auth/guards/auth.guard.ts`)
  already ran and populated `req.user` before pino-http's response-completion hook fires (Nest's
  pipeline is Middleware → Guards → Interceptors → Handler, and pino-http logs off
  `res.on('finish')`). Public (unguarded) routes simply log `userId: null` — expected, not a bug.
- `customLogLevel`: 5xx → `error`, 4xx → `warn`, else `info`.
- `redact: ['req.headers.authorization', 'req.headers.cookie']` — defense-in-depth on top of the
  "metadata only" rule.
- **`timestamp` — IST, not UTC.** Pino defaults to UTC ISO8601. Since this is an India-only
  platform, every timestamp this feature touches should read in IST (`Asia/Kolkata`, a fixed
  UTC+5:30 offset with no DST, so no timezone-database dependency is actually needed): override
  `timestamp: () => \`,"time":"${new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().replace("Z", "+05:30")}"\`` so every log line's own `time` field is already IST at rest — not something
  that only looks right if the viewer's tool happens to convert it. No new dependency required.
- **Transport** (this is what makes logging asynchronous): in production,
  `pino.transport({ target: 'pino-roll', options: { file: '/app/apps/bff/logs/bff', frequency:
  'daily', size: '20m', mkdir: true, extension: '.log' } })` — writes happen off the main thread
  via pino's worker-thread transport, so logging never blocks request handling. In dev
  (`NODE_ENV !== 'production'`), fall back to `pino-pretty` → stdout only (no shared volume exists
  locally, bff isn't containerized in dev per `docker-compose.yml`).
- `main.ts` also needs `app.set('trust proxy', true)` so `req.ip` resolves the real client IP from
  `X-Forwarded-For` (set by Caddy) instead of Caddy's own container IP.

**`apps/bff/src/logging/all-exceptions.filter.ts`** (new) — `@Catch()` global exception filter,
registered as an `APP_FILTER` provider (for DI access to the logger) rather than manual
`app.useGlobalFilters()`. Logs at `error` with `err` (pino's serializer captures name/message/stack
automatically), `reqId`, `userId`, `path`, `method` — and if `exception.code` matches Prisma's
error-code shape (`/^P\d{4}$/`), logs it as a `prismaCode` field (directly targets the
`plot`/`commercial` enum-mismatch class of incident — instantly discoverable in Grafana instead of
grepped from raw logs next time). Critically: after logging, delegates to Nest's own
`BaseExceptionFilter` (from `@nestjs/core`) so the client-facing error response is completely
unchanged — this filter only adds logging, never alters behavior.

**Fields logged per request** (the "what to log" ask): `reqId`, `time`, `method`, `url`,
`statusCode`, `responseTime` (ms), `userId`, `role`, `ip`, `userAgent`, `deviceType` (optional),
`contentLength`, plus the static low-cardinality labels `service="bff"` and `level`. On error, also
`err.message`/`err.stack`/`prismaCode`.

**Login → logout session traceability.** Per-request `userId` alone gets most of the way there
(filter by `userId`, sort by time, and you see everything that user did), but there's a real gap:
the BFF's auth is stateless JWT (1h TTL, no server-side session) and **logout is currently a
frontend-only event** — `signOutAction()` in `apps/web`/`apps/admin` (`apps/web/src/app/actions/
auth.ts`) just calls NextAuth's own `signOut()`, which clears the client-side cookie and never
calls the BFF at all. So today there's no way to see *when* a session actually ended, only the
timestamp of the last request before it did. Two small additions close this gap:
- **Explicit login events**: `AuthService.verifyOtp`/`loginWithGoogle`
  (`apps/bff/src/auth/auth.service.ts`) already call a `recordLogin()` that writes to the DB's
  `LoginEvent` table — alongside that, also emit a structured log line
  (`event: "login", userId, method: "otp"|"google"`) through the same pino logger, so login shows
  up in the same Loki stream as everything else, not only in Postgres.
- **A real logout signal**: add `POST /auth/logout` (guarded, `apps/bff/src/auth/
  auth.controller.ts`) that does nothing but log `event: "logout", userId` — no token invalidation
  needed (JWTs are short-lived and stateless by design here), this exists purely to give the BFF
  *any* visibility into logout at all. `signOutAction()` in both `apps/web` and `apps/admin` calls
  this (fire-and-forget, via the existing `@/lib/bff` fetch helper pattern) before/alongside
  NextAuth's own `signOut()`. This is the one deliberate, minimal exception to the "BFF only" scope
  decision above — there's no way to log a logout without at least this much frontend involvement.

With both in place, `{service="bff"} | json | userId="<id>"` sorted by time gives a literal bounded
session: `event="login"` → every request in between → `event="logout"`. If a user just closes the
tab instead of explicitly logging out, there's no `logout` line — the timeline simply ends at their
last request, and the known 1h JWT TTL tells you roughly when the session would have lapsed anyway;
worth knowing as a caveat, not worth solving for further right now.

## 2. Docker Compose (`docker-compose.prod.yml`) — production only

Dev stays untouched (`docker-compose.yml` only runs postgres/redis/typesense; bff/web/admin run
locally in dev, no shared volume exists there).

- `bff` gets `volumes: [bff_logs:/app/apps/bff/logs]` (read-write).
- New services — `alloy` (image `grafana/alloy`, mounts `bff_logs:/var/log/bff:ro` + a config file,
  tails the rotated files and pushes to Loki — `depends_on: loki`), `loki` (filesystem storage,
  single-binary mode — this scale needs nothing fancier), and `grafana` (persistent `grafana_data`
  volume, `GF_SECURITY_ADMIN_PASSWORD` from env, `GF_AUTH_ANONYMOUS_ENABLED=false`,
  `GF_USERS_ALLOW_SIGN_UP=false`, `GF_SERVER_ROOT_URL=https://${LOGS_DOMAIN}`,
  `GF_DATE_FORMATS_DEFAULT_TIMEZONE=Asia/Kolkata` — Grafana otherwise displays timestamps in
  either the viewer's browser timezone or UTC depending on settings; this pins every dashboard and
  Explore view to IST regardless of who's looking or from where), config/dashboards
  auto-provisioned from `observability/grafana/provisioning/**` (datasource + a starter dashboard
  JSON) so a fresh deploy needs zero manual click-ops.
- New top-level volumes: `bff_logs`, `loki_data`, `grafana_data`.
- `caddy` gets `LOGS_DOMAIN: ${LOGS_DOMAIN}` added to its `environment:` and `grafana` added to
  `depends_on`.
- New config files under `observability/`: `alloy-config.alloy` (Alloy's own config language, not
  YAML) — a `local.file_match` component targeting `/var/log/bff/*.log`, piped into
  `loki.source.file`, through `loki.process` with a `stage.json` + `stage.labels` step that
  promotes only `level`/`service` to labels, finally `loki.write` pushing to
  `http://loki:3100/loki/api/v1/push`; `loki-config.yaml` (minimal filesystem-storage config),
  `grafana/provisioning/datasources/loki.yaml`, `grafana/provisioning/dashboards/{dashboard.yaml,
  bff-overview.json}`.
- **Arch note**: both app/db EC2 instances are `t4g.medium` (arm64, per `docs/deployment.md`) —
  confirm the `grafana/loki`, `grafana/alloy`, `grafana/grafana` image tags used are multi-arch
  (they are, current major versions) before pinning.
- `apps/bff/Dockerfile`: one line mirroring the existing `uploads` precedent —
  `RUN mkdir -p /app/apps/bff/logs && chown nestjs:nestjs /app/apps/bff/logs`.
- `.env.production.example`: add `LOGS_DOMAIN=logs.bhavano.example.com` and
  `GRAFANA_ADMIN_PASSWORD=CHANGE_ME_TO_A_LONG_RANDOM_STRING`, matching the file's existing comment
  style.

## 3. Caddyfile

A 4th block, same pattern as the existing three (`SITE_DOMAIN`/`API_DOMAIN`/`ADMIN_DOMAIN`):
```
# Grafana — logging/observability dashboard, admin-auth-protected, not linked from public nav.
{$LOGS_DOMAIN} {
	reverse_proxy grafana:3000
}
```
No other Caddy changes — TLS/ACME is automatic per-domain already, same as the other three.

## 4. Filtering / dashboard design

**Loki label discipline**: only `service="bff"` and `level` are real Loki labels — `userId`, `ip`,
`url`, `reqId` stay in the JSON body, queried via `| json | field="value"`. High-cardinality labels
(one per user!) blow up Loki's index — this is the one rule that matters most for it to stay fast
and cheap at this scale.

Example LogQL:
- By user: `{service="bff"} | json | userId="<uuid>"`
- A user's full session, login to logout: `{service="bff"} | json | userId="<uuid>"` sorted by
  time — bounded by the `event="login"` and `event="logout"` lines described above.
- Errors only: `{service="bff", level="error"}`
- By device: `{service="bff"} | json | deviceType="mobile"`
- By endpoint: `{service="bff"} | json | url=~"/listings.*"`
- Latency p95: `quantile_over_time(0.95, {service="bff"} | json | unwrap responseTime [5m])`
- Date/time range: free — Grafana's built-in time picker handles this without any LogQL.

**Starter dashboard** (`bff-overview.json`, auto-provisioned): request rate (by level), error rate,
latency p50/p95/p99, top endpoints by traffic, and a raw-logs panel pinned to `level="error"` for
immediate per-incident/per-user drill-down. This is what answers "view the application/user
status" — aggregate panels plus a live error feed, no manual query-writing needed day to day. Sets
its own `"timezone": "Asia/Kolkata"` in the dashboard JSON too, belt-and-suspenders alongside the
org-wide `GF_DATE_FORMATS_DEFAULT_TIMEZONE` setting above.

## Verification

1. `docker compose -f docker-compose.prod.yml --env-file .env build bff alloy loki grafana &&
   ... up -d`.
2. Hit a few real BFF endpoints — a public one, an authenticated one (confirms `userId` populates),
   and one that errors (a bad id → 404, or similar) — to generate both success and error lines.
3. `docker compose exec bff sh -c "tail -n 20 /app/apps/bff/logs/bff-*.log"` — confirm structured
   JSON lines land in the shared volume.
4. `docker compose logs alloy` — confirm no scrape/parse errors (Alloy also serves a small debug
   UI on port 12345 inside its container showing live component/pipeline status, if useful — not
   exposed publicly, just `docker compose exec`-reachable or port-forwarded on demand).
5. Grafana → Explore: run each LogQL example above, confirm results return.
6. Open the provisioned `bff-overview` dashboard after generating a small burst of traffic, confirm
   all 5 panels populate.
7. Confirm the deliberate error test case shows up in the raw-error panel with the correct
   `reqId`/`userId`/`prismaCode` (if applicable) — concrete proof the original "scrolling raw docker
   logs" pain point is solved.
8. Confirm Grafana is reachable only at `https://{LOGS_DOMAIN}`, forces login, rejects a wrong
   password, and has anonymous access/signup disabled.
9. Log in as a real user, make a few requests, then log out — confirm the `userId` LogQL query
   shows the complete bounded timeline (`event="login"` → requests → `event="logout"`).
10. Append a new "Logging & observability (Loki + Grafana)" section to `docs/deployment.md`,
    matching its existing numbered-steps/copy-pasteable-commands style.

## Critical files

- `apps/bff/src/main.ts`, `apps/bff/src/app.module.ts`
- `apps/bff/src/logging/logging.module.ts` (new), `apps/bff/src/logging/all-exceptions.filter.ts` (new)
- `apps/bff/src/auth/auth.service.ts` (login log events), `apps/bff/src/auth/auth.controller.ts`
  (new `POST /auth/logout`)
- `apps/web/src/app/actions/auth.ts`, `apps/admin/src/app/actions/auth.ts` (`signOutAction` calls
  the new logout endpoint — the one deliberate exception to "BFF only" scope)
- `apps/bff/Dockerfile`
- `docker-compose.prod.yml`, `Caddyfile`, `.env.production.example`
- `observability/alloy-config.alloy`, `observability/loki-config.yaml`,
  `observability/grafana/provisioning/**` (all new)
- `docs/deployment.md` (new section)

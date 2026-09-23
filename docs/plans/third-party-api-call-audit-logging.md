# Masked request/response logging for outbound third-party API calls

## Context

The BFF's existing logging (`apps/bff/src/logging/logging.module.ts`, designed in
`docs/plans/bff-loki-grafana-logging.md`) deliberately logs **metadata only** for its own inbound
API — "method, path, status, duration, userId, ip, user-agent, error. **Never** request/response
bodies, so there's no redaction rule to get wrong or forget." Outbound calls to third parties
(Google Maps, WhatsApp, MSG91, Google Ads) follow the same spirit today: each provider logs a
failure summary via a plain `Logger`, and nothing at all on success (MSG91 is the sole existing
exception — it already logs full, unmasked response bodies on both outcomes, "so
extractMessageId... has something to be checked against").

The ask: be able to see the actual request and response for a third-party call, with sensitive
values masked, queryable in Grafana over a chosen date range. Grafana Explore's time-range picker
(relative presets + a custom absolute start/end range) already does the "date range" part for any
Loki query — no new UI work needed there. The real work is (a) actually emitting masked
request/response data as structured JSON fields pino already ships to Loki, and (b) deciding what
"masked" means precisely, since a naive approach is a real information-leak risk. Concretely, while
researching this I found `Msg91Provider.sendOtp` puts the live OTP code directly in its request
body — a generic key-name-based masker could easily miss an oddly-named field like that on some
future call, so this plan does not build one.

## Approach

**Allow-list what we send, pattern-scrub what they send back.** For each request, the calling code
constructs its own small "safe to log" summary object by hand — it already knows exactly which
fields are sensitive (phone numbers, OTP codes, listing titles) because it built the real request.
For responses, whose exact shape belongs to the third party and can change without our code
changing, a shared regex-based scrubber runs over the raw response text as defense-in-depth,
masking anything that *looks* like a phone number, email, or long token/secret — independent of
whatever key name the third party happens to use for it.

### New shared helper — `apps/bff/src/logging/thirdPartyCallLogger.ts`

```ts
export function maskPhone(phone: string): string   // "9876543210" -> "98******10"
export function maskEmail(email: string): string   // "a@b.com" -> "a***@b.com"

/** Applied to raw response text before it's logged — a defense-in-depth net independent of the
 * third party's field names: masks 10-digit Indian phone numbers, email addresses, and any
 * 20+-char token/key/JWT-looking run of base64url-ish characters. */
export function scrubResponseText(text: string): string

/** Strips a known query-param's value from a URL (e.g. `key=`) — used for Google Maps' API key,
 * which travels in the query string rather than a header. */
export function maskUrlParam(url: string, paramName: string): string

export function logThirdPartyCall(params: {
  logger: PinoLogger;
  provider: string;       // "google-maps" | "whatsapp-meta" | "msg91" | "google-ads"
  method: string;
  url: string;            // pass through maskUrlParam first if it carries a key/token
  request?: unknown;      // the caller's own hand-built, already-safe summary object
  status?: number;
  responseText?: string;  // raw text — this function scrubs it before logging
  ok: boolean;
}): void
```

Uses `@InjectPinoLogger(ClassName)` / `PinoLogger`, the exact pattern
`apps/bff/src/logging/all-exceptions.filter.ts` already established for structured
(object-first) pino logging — `logger.info({...fields}, 'third_party_call')` /
`logger.error({...fields}, 'third_party_call_failed')`. Existing plain-`Logger` warn/error calls
in every provider stay exactly as they are; this adds one new call per outbound fetch, it doesn't
replace anything.

### Call sites (add one `logThirdPartyCall(...)` after each fetch resolves)

- **`apps/bff/src/locations/locations.service.ts`** — `reverseGeocodeGoogle`, `placeAutocomplete`,
  `resolvePlaceId`. `request: { lat, lng }` / `{ query }` as applicable (no secrets in these — the
  API key lives only in the URL, masked via `maskUrlParam(url, 'key')`). Response fields here
  (`resolvedLocality`, `cityName`, predictions) are already-public place names, not PII — logged in
  full is fine; `scrubResponseText` still runs as a safety net. Skip `getStaticMapImage` (binary).
- **`apps/bff/src/notifications/providers/whatsapp.provider.ts`** — `sendTemplate`.
  `request: { templateName, to: maskPhone(to), paramCount: parameters.length }` — deliberately
  omits the actual parameter values (names/listing titles are a specific user's data).
- **`apps/bff/src/notifications/providers/msg91.provider.ts`** — all four send methods.
  `request: { template/templateId, phone: maskPhone(phone), varNames: Object.keys(vars) }` for the
  template sends; for `sendOtp` specifically, `request: { templateId, senderId, phone:
  maskPhone(phone) }` — **the OTP code itself is never included, masked or not**, same treatment
  as "never log the token itself" for Google/Apple sign-in. Replaces the existing ad-hoc
  `this.logger.log(\`...response: ${responseBody}\`)` calls with this shared, scrubbed helper.
- **`apps/bff/src/ads/google-ads-conversion.provider.ts`** — the conversion upload call.
  `request: { gclid: present/absent as boolean, conversionAction }` (a gclid is a marketing click
  id, not classic PII, but there's no value in logging the raw string either).

### Explicitly excluded — unchanged

- **Google/Apple sign-in** (`auth/providers/*.provider.ts`) — never logs the token or decoded
  identity claims today; this plan doesn't touch that.
- **Razorpay** (`payments.service.ts`) — goes through the official SDK, not a raw `fetch`, so there
  is no single interception point without wrapping the SDK's internals. Left as explicit future
  work rather than bolted on riskily here.
- **Email/SMTP** (`notifications/providers/email.provider.ts`) — nodemailer's SMTP transport
  doesn't expose a request/response pair in the same shape as a REST call; stays as today's
  failure-only logging.

### Grafana/Loki — mostly already there

- Add `provider` as a new low-cardinality Loki label in `observability/alloy-config.alloy`
  (mirrors the existing `level`/`service` labels — 4-5 distinct values, cheap to index), so
  `{service="bff", provider="msg91"}` is a fast first filter. Everything else (`url`, `request`,
  `status`, `responseText`) stays in the JSON body, queried with `| json` — same rule the file's
  own comment already states for `userId`/`ip`/`url`.
- **Date/time range**: nothing to build — Grafana Explore's picker (relative or a custom
  absolute start/end) already applies to any Loki query, including this one:
  `{service="bff", provider="google-maps"} | json`.
- **Retention**: the existing 30-day Loki retention (`observability/loki-config.yaml`,
  `retention_period: 720h`) applies automatically; no change needed, but worth knowing masked PII
  in these lines ages out on the same 30-day clock as everything else.

### Doc update

`docs/plans/bff-loki-grafana-logging.md`'s "Never request/response bodies" line gets a short
amendment noting this plan's scoped, masked exception for outbound third-party call auditing (the
original policy still fully governs the BFF's own *inbound* API logging, which this plan does not
touch) — per this repo's convention of keeping plan docs accurate to what's actually shipped.

## Critical files

- `apps/bff/src/logging/thirdPartyCallLogger.ts` (new) — masking helpers + `logThirdPartyCall`.
- `apps/bff/src/logging/thirdPartyCallLogger.spec.ts` (new) — masking correctness (phone/email/
  token patterns get scrubbed; an OTP-shaped 6-digit number does NOT falsely match the 10-digit
  phone pattern; ordinary business text passes through unchanged).
- `apps/bff/src/locations/locations.service.ts`, `notifications/providers/whatsapp.provider.ts`,
  `notifications/providers/msg91.provider.ts`, `ads/google-ads-conversion.provider.ts` — one
  `logThirdPartyCall` call added per outbound fetch, each injecting `PinoLogger` alongside their
  existing `Logger`.
- `observability/alloy-config.alloy` — add `provider` to the promoted-labels list.
- `docs/plans/bff-loki-grafana-logging.md` — amend the "never bodies" line with this plan's scope.
- `docs/plans/third-party-api-call-audit-logging.md` (new) — this plan, saved per repo convention.

## Verification

1. `pnpm --filter bff test` — new masking unit tests, plus the full existing suite (no provider's
   existing behavior/return values change, only an added log call).
2. `pnpm --filter bff typecheck`.
3. Manual, local: trigger a reverse-geocode call (drop a pin in the web wizard against a local
   BFF), tail dev output, confirm the `key=` query param is masked and other fields are readable.
4. Manual, local: trigger `sendOtp` against a test phone number, confirm the log line has the
   masked phone but **no OTP code anywhere in it** — grep the raw log output for the exact code
   sent to be sure.
5. Deploy (`alloy` needs restarting too, since its config is bind-mounted:
   `docker compose -f docker-compose.prod.yml up -d --no-deps alloy` alongside the `bff` rebuild).
6. In Grafana Explore, run `{service="bff", provider="google-maps"} | json` with a custom date
   range spanning when the manual test happened, and confirm the entry appears with the masked URL
   and readable (non-PII) response fields.

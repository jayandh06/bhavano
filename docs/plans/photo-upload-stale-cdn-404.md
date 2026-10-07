# Stale cached 404 on a freshly-uploaded listing photo

## Status: fixed (2026-10-07)

## Incident

Listing `19c41d86-82a7-4455-8dc8-b338396d610e`'s photo 1 ("full" variant) returned R2's native
"Object not found" page from `cdn.bhavano.com` roughly 15+ minutes after the listing was posted,
despite every system of record saying it was fine:

- **Database**: `Listing` active/approved/live, all 3 `ListingPhoto` rows intact, all 6
  `PhotoVariantJob` rows (`preview`+`full` × 3 photos) `done`, `attempts: 0`, `error: null`.
- **R2 itself** (checked directly via `HeadObjectCommand`, bypassing Cloudflare entirely): the
  object existed, 10,762 bytes, `LastModified` matching the job's own `updatedAt`.
- **The CDN**, checked moments earlier from this machine: `200`, correct content, correct size.

So the data was never wrong — a manual `purge_cache` call for the affected URLs (via
`CdnPurgeService`, the same mechanism `PhotoProcessingService` already uses) fixed it immediately.

## Root cause

`PhotoProcessingService.processJob` (`apps/bff/src/photo-processing/photo-processing.service.ts`)
already purges the CDN after every successful `putObject` — not only on rotate, on every
first-time variant creation too. The gap is timing, not missing code:

1. A `PhotoVariantJob` row exists for a few seconds (the ~3s poll interval, plus actual resize
   time) before the object exists in R2 at all.
2. If anything requests that exact variant URL in that window (an eager preview load, a crawler,
   the admin panel's own list view), R2/Cloudflare genuinely 404s — correctly, at that moment.
3. Cloudflare can cache that 404 at the edge PoP that served it. The default edge cache on this
   CDN is 4 hours for `.webp` (see `R2StorageService`'s own comment) — the purge this service
   fires right after the successful `putObject` clears it, **but `purge_cache` doesn't propagate
   to every edge PoP instantly** (tens of seconds per Cloudflare's own docs). A PoP that hadn't
   received the purge yet, or that served a second request racing in just behind it, can keep
   serving the stale 404 well past that.

`CdnPurgeService.purgeUrls` is deliberately fire-and-forget (never throws, the caller never checks
its boolean) — correct for "a missed purge shouldn't fail the job," but it meant there was no
second attempt to catch exactly this propagation-lag case.

## Fix

`PhotoProcessingService.processJob` now fires a second, delayed purge for the same URL
(`DELAYED_PURGE_MS = 60_000`, `.unref()`'d so it never keeps the process — or a test run — alive
on its own) after the immediate one. Same best-effort stance as the first purge: failure here only
means a stale response lingers a bit longer, never that the job itself fails.

Test: `photo-processing.service.spec.ts` — "schedules a second, delayed purge of the same URL to
catch slow cache propagation" (fake timers, asserts the second `purgeUrls` call after advancing
60s).

## Not done

- No change to the immediate purge's reliability itself — this adds a second attempt rather than
  verifying the first one actually landed everywhere (Cloudflare's purge API doesn't expose
  per-PoP propagation status to check against).
- The delayed purge is in-memory (`setTimeout`), not persisted — a `bff` restart within that 60s
  window drops it. Acceptable: worst case is the same stale-edge window this fix shortens, not
  reintroduces, since the immediate purge still ran.

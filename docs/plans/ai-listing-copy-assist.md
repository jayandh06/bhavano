# AI-assisted title/description generation (Free + Featured tiers)

## Context

Posting an ad today means typing `title` and `description` by hand (`PostAdWizard.tsx`, "details"
step). This plan adds an AI "Generate" assist for both fields, fed from structured data the wizard
already collects (category, transactionType, price, city/area, category-specific attributes).
Two tiers were decided over prior discussion:

- **Free**: a plain, factual AI description + title. English only.
- **Featured**: a richer, more persuasive description, grounded in **real** nearby landmarks (bus
  station, mall, school, hospital — via Google Places `searchNearby`) plus an optional second
  Indian-language version.

Landmarks are Featured-only specifically because Places `searchNearby` is the most expensive call
in the pipeline (~$0.032/call vs ~$0.001 for the LLM text itself) — gating it both controls cost
and gives Featured a visible, concrete differentiator. The LLM must never invent a landmark name
itself; it only narrates names a real Places lookup returned, and must degrade gracefully (drop
the landmarks section, never fail generation) when the listing has no `lat`/`lng` pin.

Generation only ever populates the textarea for the user to edit/accept — never auto-submitted.
Existing moderation (`ModerationService.moderate()`) still gates the final text exactly as today.

## Key fact that shapes the whole design: there is no real listing yet on the "details" step

`PostAdWizard.tsx`'s `listingId` (`useState(() => crypto.randomUUID())`) is a client-generated UUID
that only keys photo/video upload storage — it is **not** a real `Listing` row. The listing is only
created later, from the "review" step's `onSubmit` (`createdListing` stays `null` until then), and
boost selection also only happens on/after "review". So while the user is on "details" typing a
description, there is categorically nothing boosted yet — **generation there is always Free tier,
with zero ambiguity, decided server-side, never from a client-supplied hint.**

The only place "is this listing Featured" is ever a real, meaningful question is **after** the
listing exists and boost is bought — i.e. the regenerate-after-upgrade flow. This is why the design
below is one endpoint with two calling shapes, not a client-supplied tier flag.

## BFF: one new endpoint, `POST /ai/listing-copy`

New `AiModule` (`apps/bff/src/ai/`), registered in `app.module.ts`.

**Request has two shapes, disambiguated by whether `listingId` is present:**

- **No `listingId`** (details step, pre-creation): caller sends the structured fields directly
  (category, transactionType, price, cityName, areaName?, attributes, lat?, lng?) plus
  `fields: ("title"|"description")[]`. Tier is hardcoded `'free'` in the service — never read from
  the client.
- **With `listingId`** (post-creation regenerate flow): caller sends only `listingId` + `fields` +
  optional `secondLanguage`. The service loads the real `Listing` row, checks
  `listing.ownerId === user.id` (`ForbiddenException`, same pattern as
  `listings.service.ts:2157`), and derives every structured field *and* the tier from that row —
  never from anything the client claims. This closes off "claim someone else's boosted listingId"
  and "lie about your own boost status" in one check.
- **Gotcha to implement carefully**: the wizard's own mount-time `listingId` must never be sent on
  the details-step call — it isn't a real row and would 404. Only `createdListing.id` (set after
  real creation) is ever a valid `listingId` in this request.

**Service orchestration** (`ai.service.ts`): rate-limit check → resolve fields + tier → call the
LLM provider for title if requested → if description requested AND tier is `featured` AND lat/lng
exists, call the landmarks provider wrapped in `try/catch` (same graceful-degradation shape as
`autoDetectCityAction` in `apps/web/src/app/actions/locations.ts` — a Places failure never blocks
generation, it just drops the landmarks) → call the LLM provider for description with tier +
landmarks + optional `secondLanguage`.

**Update (2026-10-07): both OpenAI and Gemini are real, supported providers, not a single
hardcoded choice.** `ListingCopyLlmProvider` was already designed to be swappable (see below) —
`GeminiListingCopyProvider` is a second real implementation of the same interface, sharing its
prompt text with `OpenAiListingCopyProvider` via `listing-copy-prompts.ts` so the two never drift.
`resolveListingCopyProvider` (`listing-copy-llm.provider.ts`) is the pure selection function the
`ai.module.ts` factory calls: with one key configured that provider runs; with both configured,
Gemini wins by default (picked for stronger output on the Indic `secondLanguage` descriptions,
not because OpenAI is deprecated) unless `AI_LISTING_COPY_PROVIDER` (`"openai"` | `"gemini"`)
pins one explicitly. An override naming an unconfigured provider falls back to the stub, same
"assist, not core functionality" stance as everything else here. See `docs/deployment.md`'s "AI
listing-copy assist" section for the ops-side setup.

**Provider interfaces** (so real calls are swappable for deterministic stubs in dev/tests):
```ts
interface ListingCopyLlmProvider {
  generateTitle(input: StructuredListingFields): Promise<string>;
  generateDescription(input: StructuredListingFields & {
    tier: "free" | "featured"; landmarks: string[]; secondLanguage?: IndianLanguage;
  }): Promise<{ text: string; secondLanguageText?: string }>;
}
interface NearbyLandmarksProvider {
  findNearby(lat: number, lng: number): Promise<string[]>;
}
```
- Real `OpenAiListingCopyProvider` — GPT-5 mini via OpenAI SDK, structured JSON output
  (title/description/secondLanguageText). New `OPENAI_API_KEY` env var (`apps/bff/.env.example`,
  `.env.production.example`, `docker-compose.prod.yml`'s bff `environment:` block,
  `docs/deployment.md` — same four places `GOOGLE_MAPS_SERVER_KEY` is documented/wired today).
- Real `GooglePlacesNearbyLandmarksProvider` — reuses the **existing** `GOOGLE_MAPS_SERVER_KEY`
  (already used for Geocoding/Autocomplete/Details/Static Maps in `locations.service.ts`), calling
  the new Places API's `places:searchNearby` with up to 50 `includedTypes` in one request. Needs
  the (new) Places API enabled on the same GCP project — a one-time ops step, not a new credential.
- A NestJS factory provider picks the stub implementation whenever the relevant key is unset or
  `NODE_ENV === 'test'` — a deliberate, scoped exception to this codebase's usual
  "throw `ServiceUnavailableException` if the key is missing" convention, justified because this
  feature is an assist that shouldn't block local dev/CI. `StubListingCopyProvider` returns
  deterministic templated text from the structured fields (long enough to clear
  `TITLE_MAX_LENGTH`/`DESCRIPTION_MIN_LENGTH`, so downstream checks stay exercisable).

**The prompt instruction, not code, is what prevents landmark hallucination**: pass the real
Places-returned names as a closed list with an explicit "narrate only these, never name any other
place" instruction. Flag this as a prompt-review item, not a programmatically-enforceable guarantee.

**Rate limiting — reuse the existing singleton + ledger pattern, don't invent a new one:**
- `RateLimitKind` (`packages/types/src/index.ts:53`) gains `"ai_generate"`.
- `RateLimitSettingsDto` gains `aiGenerateLimit`/`aiGenerateWindowMinutes`; same two fields added to
  the `RateLimitSetting` Prisma model (new migration), default `10` / `1440` (10/day/user — bounds
  worst-case Places cost at ~$0.32/user/day).
- `rate-limit.service.ts`'s `checkAndRecordHit` currently hardcodes the `view` limit/window for
  every non-`publish` kind — it must branch explicitly for `ai_generate` instead of falling through,
  the same way `publish` was deliberately special-cased (not silently reusing `view`'s numbers).
- Controller stacks `@UseGuards(AuthGuard, RateLimitGuard)` + `@RateLimitAction('ai_generate')`
  (`AuthGuard`, not `OptionalAuthGuard` — `RateLimitGuard` no-ops without a `request.user.id`, so an
  anonymous caller must be rejected before the guard, not allowed through unlimited).

**Consolidate the duplicated boost check while touching this area**: add
`apps/bff/src/listings/listing-boost.util.ts` exporting `isListingBoosted(listing)` —
`(listing.boostedUntil?.getTime() ?? 0) > Date.now()` is currently copy-pasted 4× across
`listings.service.ts` (lines 983, 2784, 3682) and `admin.service.ts` (1271); replace all four with
the shared helper and use it as the tier check here too.

**Response shape** (`packages/types/src/listingCopyAssist.ts`):
```ts
export type IndianLanguage = "hi" | "ta" | "te" | "kn" | "ml" | "mr" | "bn" | "gu" | "pa" | "or";
export interface GenerateListingCopyResult {
  title?: string;
  description?: string;
  descriptionSecondLanguage?: string;
  tierUsed: "free" | "featured";
  landmarksUsed: string[]; // real names actually narrated, for UI transparency/debugging
}
```
`tierUsed` is returned explicitly rather than assumed, so a race (boost-activation landing a beat
after the client thinks it succeeded) shows as "still activating, try again" instead of silently
handing back plain text under a Featured banner.

## Regenerate-after-upgrading-to-Featured flow

Two existing signals in `PostAdWizard.tsx` already mark "boost just got confirmed":
- The `showSelectorOnPreview` checkout path's `boostCheckoutOutcome === "succeeded"`.
- `BoostBundlePicker`'s existing `onActivating`/success callback (for boost bought from the
  success screen instead of at review).

Either one shows a small dismissible banner on the success step — *"Your ad is now Featured — want
a richer AI description with nearby landmarks?"* — with one "Generate" button that calls the BFF
with `{ listingId: createdListing.id, fields: ["description"], secondLanguage? }` (no structured
fields — server derives everything from the DB row). Result shows in an editable preview; "Apply"
calls the existing `updateListingAction`, going through `ModerationService.moderate()` exactly like
any manual edit — auto-*offered*, never auto-*applied*.

## Web/mobile UI

- Two "Generate" buttons on the details step, next to `title` and next to the `description`
  textarea (~`PostAdWizard.tsx:1796` on web, mirrored on mobile) — each enabled once the minimum
  structured fields exist (`category && transactionType && price > 0 && cityId`), independent of
  title/description themselves already being filled.
- An optional second-language picker next to the description Generate button: **English is always
  generated; a dropdown offers one additional Indian language, default "None."** When a second
  language is chosen, the result is shown via an **in-page tab toggle** ("English" / "हिन्दी", etc.)
  switching the visible textarea content in place — **not a new browser tab** (a real new-tab/window
  is unusual UX here and would raise an SEO question of its own, needing a separate URL + hreflang
  per language that a v1 doesn't need; one canonical URL, one stored description value picked by
  toggle, stays simplest).
- Handler calls the new BFF endpoint (modeled on `createListingAction`'s token/login-gate pattern,
  `requireLogin({ onSuccess: () => void handleGenerateCopy(field) })` on a missing token) and
  populates `title`/`description` state on success — both remain freely editable afterward.
- Mirror every change in `apps/mobile/src/components/home/PostAdWizard.tsx` — identical structure
  confirmed (`listingId`/`selectedBoostPlan`/`boostCheckoutOutcome`/success step all present).

## Critical files
- `apps/web/src/components/home/PostAdWizard.tsx` / `apps/mobile/src/components/home/PostAdWizard.tsx`
- `apps/bff/src/ai/` (new: module, controller, service, DTO, providers — including
  `listing-copy-prompts.ts`, shared between the OpenAI and Gemini providers)
- `apps/bff/src/rate-limit/rate-limit.service.ts`
- `apps/bff/src/listings/listings.service.ts` (boost-check consolidation)
- `packages/types/src/listingCopyAssist.ts`, `packages/types/src/index.ts`
- `apps/bff/prisma/schema.prisma` (+ new migration)

## Verification
- `ai.service.spec.ts` (stub providers, mocked `PrismaService`): no-`listingId` request always
  resolves `'free'`; a `listingId` request on a boosted listing resolves `'featured'`; ownership
  mismatch → `ForbiddenException`; unknown `listingId` → `NotFoundException`; landmarks provider
  never called when tier is `'free'` or lat/lng missing; a thrown landmarks error still returns a
  description with `landmarksUsed: []`.
- `GooglePlacesNearbyLandmarksProvider` spec mocking `fetch`, same style as
  `locations.service.spec.ts`'s Geocoding mock — verifies URL/header/fieldmask construction and
  graceful degradation on a non-OK response.
- `RateLimitService` spec extended for the new `ai_generate` branch, to catch exactly the bug a
  hardcoded `view`-settings read would reintroduce.
- Manual, no live keys needed (stubs active by default): run the wizard to "details", generate
  title+description, confirm both populate and stay editable, submit normally and confirm
  moderation still runs; simulate a boost purchase in dev, confirm the success-screen banner
  appears, and confirm a regenerate call resolves `tierUsed: 'featured'` with stub landmarks.
- `tsc --noEmit` + full jest suite on `apps/bff`, `apps/web`, `apps/mobile` after implementation.

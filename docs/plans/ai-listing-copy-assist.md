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

**Gemini model: the smallest tier that does the job, confirmed live, not guessed.**
`DEFAULT_GEMINI_MODEL` went through three live checks against the real Generative Language API
before landing on `gemini-3.5-flash-lite`: `gemini-2.5-flash` (what training data would suggest)
had been retired for new API keys; `gemini-3.8-flash` (the flagship the retirement error pointed
at) worked but is more model than this "fill structured fields into a short, templated
description" task needs — the same "cheap, fast, not deep reasoning" stance
`OpenAiListingCopyProvider`'s own `MODEL` comment already takes; `gemini-3.5-flash-lite` (the
newest tier with a "lite" variant — 3.6/3.7/3.8 don't have one yet) produced the same
structure/quality on the full Featured-tier prompt (bullets, bold, a second language) at a
fraction of the size, and rejects `thinkingConfig` outright (400) since it has no hidden
"thinking" step to disable in the first place — simpler than `gemini-3.8-flash`, which needed the
`thinkingConfig: { thinkingBudget: 0 }` workaround to avoid spending more tokens thinking than
answering.

**Update (2026-10-07): the description is formatted, not one dense paragraph.** Free tier gets
1-2 short paragraphs with occasional `**bold**` on a standout fact; Featured gets an opening
paragraph, a `- ` bullet list of 3-5 highlights, and a closing paragraph, with 1-3 bolded phrases.
`buildSystemPrompt` (now taking an `allowFormatting` flag — false for titles, which stay plain
one-liners) instructs the model to use exactly these three marks and no others. The shared parser
(`packages/types/src/listingDescriptionFormat.ts`, `parseListingDescription`) turns that text into
typed blocks (`paragraph` | `bullets`, each with bold/plain runs) — same "shared parsing, separate
per-platform renderer" split as this package's own `messageFormat.ts`/`MessageBody`. Each platform
has its own `ListingDescription` component consuming those blocks: `apps/web/src/components/home/`,
`apps/mobile/src/components/home/`, and `apps/admin/src/components/` (admin's inline-styled, the
others Tailwind/RN-styled) — all three replace what used to be a plain `whitespace-pre-line`
div / RN `<Text>` / `whiteSpace: "pre-wrap"` `<p>`. A hand-typed description with no markdown-ish
syntax still parses as a single plain paragraph, so this is a no-op for existing listings.
Verified live against the real Gemini API (prompt → real response → parsed through the actual
`parseListingDescription` → correct paragraph/bullets/bold structure).

**Update (2026-10-07): Free tier gets its own single-language picker, deliberately separate from
`secondLanguage`.** `GenerateListingCopyInput.language` (`packages/types/src/listingCopyAssist.ts`)
is a new field, Free-tier only (`AiService.resolveFields` only ever sets it in the no-`listingId`
branch — a `listingId` request ignores it exactly like every other structured field). Unlike
`secondLanguage`, which is additive (English generates regardless; a second language is a bonus
version shown via the in-page tab toggle described below), `language` *replaces* English for both
`title` and `description` — a Free poster picks one language up front
("✨ AI-generate in: [English ▾]", English as the default) and both fields are generated in it.
The two fields are kept separate rather than overloaded onto one, specifically so a Free request
that happened to set `secondLanguage` keeps silently no-op'ing exactly as it already did (never
read outside the `featured` branch) instead of that same mistake producing a different, harder to
debug no-op. `languageInstruction()` in `listing-copy-prompts.ts` wires it into both
`buildTitlePrompt` and `buildDescriptionPrompt`. Mirrored on mobile with a Pressable-based picker
list (no native `<select>` there) backed by `generationLanguage`/`generationLanguagePickerOpen`.

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

**Update (2026-10-07): two production bugs found via live testing right after this feature's
button/reorder changes shipped, both now fixed:**
- **Raw `ThrottlerException: Too Many Requests` was reaching the user verbatim.** Both web's
  `bffFetch` and mobile's `BffError.userMessage` surface a 4xx response's `message` field as-is —
  `ThrottlerException`'s own default message is literally its class name, not something a seller
  can act on. `rate-limit.service.ts` now passes `ThrottlerException` a kind-specific, readable
  message ("You've reached today's AI-generate limit — try again tomorrow, or write it yourself
  for now.") instead of leaving it at the default. The underlying limit itself (10/day/user) is
  unchanged — a seller hitting this during normal use (two hits per Generate: title *and*
  description, plus any regenerate) is expected at the current cap, not a bug; raise
  `aiGenerateLimit` via the admin rate-limit settings if that cap turns out too tight in practice.
- **An uncaught `SyntaxError` was reaching the user as a raw 500 "Internal server error".** Both
  `GeminiListingCopyProvider` and `OpenAiListingCopyProvider` ask the model for a formatted
  description ("a blank line between paragraphs" — `buildSystemPrompt`'s `allowFormatting`), and
  despite `responseMimeType`/`response_format: json_object`, the model sometimes emits that blank
  line as a literal unescaped newline **byte** inside the JSON string value instead of the
  required `\n` escape. Strict `JSON.parse` rejects a raw control character inside a string
  outright ("Bad control character in string literal in JSON"), which was an unhandled
  `SyntaxError` → Nest's default 500 for a generation that had actually succeeded upstream.
  Confirmed live in production logs the same day. Fixed with a shared `parseModelJson` helper
  (`listing-copy-prompts.ts`, used by both providers, same "shared so the two never drift" reasoning
  as the prompt builders themselves): tries a straight parse first, retries once after escaping any
  control character found strictly inside a string literal (tracking quote/escape state, so real
  whitespace between JSON tokens is left alone), and only then throws a clean
  `ServiceUnavailableException` if the reply is unrecoverably broken (e.g. truncated by a token
  limit) — never a raw `SyntaxError` past this point.

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

- Two "✨ AI Generate" buttons on the details step, immediately beside the `Title`/`Description`
  labels (not at the far end of the field row) — each enabled once the minimum structured fields
  exist (`category && transactionType && price > 0 && cityId`), independent of title/description
  themselves already being filled. **Update (2026-10-07):** renamed from plain "Generate" and given
  a distinct gold pill style (`aiGenerateButtonClass` on web, `styles.aiGenerateButton` on mobile)
  so the one control on this screen that writes the field for you doesn't read as just another
  button — both changes (renamed label + adjacent placement) came from direct feedback that the
  original "Generate" buttons, sitting far from their field's label, were easy to miss. The same
  renamed/restyled button is reused on the Featured-regenerate success-step banner ("✨ AI
  Generate"/"✨ AI Regenerate").
- An optional second-language picker next to the description Generate button: **English is always
  generated; a dropdown offers one additional Indian language, default "None."** When a second
  language is chosen, the result is shown via an **in-page tab toggle** ("English" / "हिन्दी", etc.)
  switching the visible textarea content in place — **not a new browser tab** (a real new-tab/window
  is unusual UX here and would raise an SEO question of its own, needing a separate URL + hreflang
  per language that a v1 doesn't need; one canonical URL, one stored description value picked by
  toggle, stays simplest). This is Featured-only and additive — see the Free-tier `language` picker
  described above, which is a different, replacing concept. **Update (2026-10-07):** both this
  picker and the Free-tier one now use the shared `SelectField` component
  (`apps/web/src/components/home/SelectField.tsx`, `narrow` prop) instead of a bare `<select>` —
  the bare element rendered the browser's native grey arrow pinned to the far edge of an
  auto-width control, visibly inconsistent with every other dropdown on this page (City,
  Price qualifier, …), which all already go through `SelectField` for its themed `▾` drawn right
  next to the value. Caught via direct feedback right after the Free-tier picker shipped.
- Handler calls the new BFF endpoint (modeled on `createListingAction`'s token/login-gate pattern,
  `requireLogin({ onSuccess: () => void handleGenerateCopy(field) })` on a missing token) and
  populates `title`/`description` state on success — both remain freely editable afterward.
- Mirror every change in `apps/mobile/src/components/home/PostAdWizard.tsx` — identical structure
  confirmed (`listingId`/`selectedBoostPlan`/`boostCheckoutOutcome`/success step all present).

**Update (2026-10-07): the "details" step was reordered so richer context exists by the time a
seller reaches Title/Description.** Originally Title/Description came first (right after Category),
before any of the category-specific attributes, pricing, photos, or video — meaning "AI Generate"
had the least possible structured context to work with at the exact moment it was most likely to
be used. New order on both web and mobile: Location pin → City/Area → category-specific attributes
+ pricing (`CategoryFieldsAccordion`) → Photos → Video → the Free-tier language picker → Title →
Description → "Owner or Agent?" → Preview/Back. Location and City/Area stay early (title/description
generation doesn't depend on them the way it depends on category/price/attributes, and they're
needed to drive the city/area autocomplete regardless); only the Title/Description/language-picker
block itself moved, to immediately before the seller-type question and the Preview button. No
state, validation (`detailsIssue`/`detailsValid`), or `photoSectionRef` logic changed — this was a
pure JSX reorder, confirmed with `tsc --noEmit` on both apps after moving the blocks.

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

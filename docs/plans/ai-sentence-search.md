# AI sentence search: understand what the seeker typed

## Status: built 2026-10-20 (BFF endpoint + web search bar). Not yet measured; mobile not done.

## What already exists (important)

The web search bar is **already** a sentence search for the common cases. `SearchBar.tsx` runs a
rule-based reader (`apps/web/src/lib/parseSearchQuery.ts`) on the text, shows a live "Searching for
→ 2 BHK Apartments · Rent & Lease · under ₹25,000 · in Whitefield, Bengaluru" preview, and builds
a real address (`/{city}/…` plus `?minPrice=&maxPrice=&area=`). It reads: category, buy vs
rent-lease, BHK, a one-sided price (`under 25k`, `above 50 lakh`), a city name, and leaves the rest
as an area guess. That is fast, free and predictable, and it stays.

What it cannot read, and therefore what AI is for:

| Typed | Rules today | With AI |
|---|---|---|
| "between 15k and 25k", "15-25k" | one number only, direction lost | min 15000, max 25000 |
| "furnished 2bhk", "semi furnished" | dropped into the area guess | `furnished=semi` |
| "owner only", "no broker" | dropped | `postedBy=owner` |
| "girls PG single sharing" | PG, sharing lost | `sharingType=single` |
| "2 or 3 bhk" | first number only | `bedrooms=2,3` |
| "2bhk in whitefeild" (misspelling), Hinglish, Kannada/Hindi words | wrong area guess | corrected area/city |
| long sentences ("flat for my family near an IT park, ground floor, parking") | whole tail becomes an "area" | supported filters applied, the rest listed as "couldn't filter by …" |

## Decision

AI is a **second pass**, never the first and never per keystroke:

1. Rules run instantly as today (live preview unchanged).
2. On submit, call AI **only when the rules visibly struggled** (`wantsAi` in `SearchBar.tsx`): they
   recognised nothing, a leftover of 3 or more words is being guessed as an area, the text has
   non-English characters, or it contains a hint word they ignore (`furnished`, `semi`, `owner`,
   `broker`, `between`, `sharing`, `girls`/`boys`, `bachelor`, `family`, `or`, a `15-25k` range). A plain
   `2bhk in hsr layout` never reaches the model.
3. If AI is not configured, slow (4 s), rate-limited, or returns nothing usable, the visitor gets
   exactly today's behaviour. AI can only add filters; it can never block a search.

## Safety rules (the model is not trusted)

- **Closed output.** The model returns a fixed JSON shape (transaction, category, bedrooms[],
  min/max price, furnished, postedBy, sharingType, city, area, unmatched[]). The server validates
  every field against the app's own enums and ranges and drops anything else, so a hostile or
  confused prompt can at worst produce a wrong filter, never a link, a script or an unknown route.
- **No invented places.** A city must match a real city name (exact, else a one-or-two-letter typo
  fix against the city list); otherwise it is dropped. The area is passed on as text and resolved
  by the destination page exactly as a typed area is today.
- **Unfilterable asks are shown, not hidden.** Things we cannot filter on ("bachelors allowed",
  "near metro", "ground floor") come back in `unmatched` and the page tells the seeker
  "Couldn't filter by: …" instead of silently ignoring them.
- **Prices in rupees**, clamped, swapped if reversed, and rent-sized numbers are never reinterpreted.
- **Cost and abuse.** Per-IP throttle (10 per minute, the existing `ThrottlerGuard` pattern, client IP
  forwarded by web), 200-character input cap, an in-memory cache of recent interpretations (same
  sentence, same city, 24 h), and a daily call cap (`AI_SEARCH_DAILY_LIMIT`, default 3000) after which
  the endpoint just answers "not available" and rules are used.
- **Privacy.** Only the typed sentence and the browsed city name are sent to the model. No user id,
  phone or email. Nothing is stored.
- **URL rules** ([`.claude/CLAUDE.md`](../../.claude/CLAUDE.md)): destinations are built with the
  existing `buildBrowsePath` and the same query params browse pages already accept (`minPrice`,
  `maxPrice`, `furnished`, `postedBy`, `sharingType`, `bedrooms`, `area`), slugs and names only, never
  ids. Query variants keep their canonical to the plain route.

## Built

- `packages/types/src/searchInterpretation.ts`: the response shape, the allowed value lists and a
  pure `sanitizeSearchInterpretation()` that enforces the rules above (unit-tested in the BFF).
- BFF `POST /search/interpret` (`apps/bff/src/search-interpret/`): throttled, cached, daily-capped,
  Gemini or OpenAI (the keys and provider choice already used by the listing-copy assist), 4 s timeout.
  Returns `{ interpretation: null }` whenever it cannot help.
- Web `SearchBar`: calls it (server action `interpretSearchAction`) on submit when `wantsAi` says so,
  shows "Understanding…" on the button while it waits (4.5 s cap), builds the address from the AI
  reading layered over the rules' (`goFromAi`), and shows "Couldn't filter by: …" under the search box
  for 15 s through a small in-memory store (no URL parameter, nothing stored). Any failure or null
  falls through to the old `go()`.
- Production already has `GEMINI_API_KEY` set (no OpenAI key), so Gemini is used. Optional
  `AI_SEARCH_DAILY_LIMIT` (default 3000 calls a day).

## Not built / next

- Mobile app search (it does not have the rule-based reader; separate change).
- Filtering on facts that have no field today (bachelors allowed, pets, near metro): that is the
  "read facts out of the description" idea, deliberately skipped because descriptions are generated
  from the form fields, so the fields are the source of truth.
- Measuring it: add `search_ai_used` / `search_ai_fallback` events and compare click-through and
  zero-result rates for AI-interpreted vs rule-interpreted searches after a week.

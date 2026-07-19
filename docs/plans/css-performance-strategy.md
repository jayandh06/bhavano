# CSS strategy for build + load performance

## Current state (measured)

- **Next.js 16.2.10, App Router, React 19.**
- **41 `.tsx` components**; **36 use inline `style={{…}}`**; only `layout.tsx` uses `className`
  (font-variable wiring).
- **18 of 41 are `"use client"`** — a large hydration surface.
- Styling = **inline style objects** + a **CSS-custom-property design-token system** in
  `globals.css` (`--bg`, `--green`, `--gold`, …) with light/dark via `:root[data-theme="dark"]`
  and `next-themes`.
- **No CSS framework, no CSS-in-JS runtime library** (no Tailwind / emotion / styled-components).
- **No responsive CSS at all** — zero `@media` / container queries anywhere. This is a *symptom*
  of the inline approach: you can't express breakpoints inline.
- Fonts already optimal: self-hosted via `next/font/google` (Lora + Manrope). **Leave as-is.**

## Baseline measurements (step 0 — captured)

Rendered-HTML payload, dev server (unminified; prod absolute sizes are smaller but the inline-style
*share* holds), captured before any Tailwind work:

| Page | Total HTML | Inline-style bytes | Share | `style="` attrs |
|---|---|---|---|---|
| `/` (homepage) | 76.4 KB | 18.2 KB | ~23% | 185 |
| `/bengaluru` (browse) | 102.6 KB | 27.8 KB | ~27% | 277 |
| `/bengaluru/buy/apartment` | 67.6 KB | 13.6 KB | ~20% | 141 |

Confirms the thesis: **~20–27% of the HTML is inline-style attributes, heaviest on the browse
page** (277 repeated style strings across the listing grid) — this is the uncacheable,
per-navigation payload the migration removes. Production build-time + first-load-JS baseline is
deferred to a dedicated before/after pass (must stop the dev server to avoid `.next` contention).

## Step 1 — Tailwind v4 installed and wired (done, zero visual change)

- `tailwindcss` + `@tailwindcss/postcss` v4.3.3 added to `apps/web`; `postcss.config.mjs` created.
- `globals.css` imports **theme + utilities layers only — Preflight deliberately skipped** (it's
  a global reset that would change rendering); existing tokens mapped via `@theme inline` so
  `bg-bg`/`text-green`/etc. compile to `var(--token)` and the `data-theme` dark swap is untouched.
- **Verified:** Tailwind compiles `globals.css` in ~80ms with no errors; all original rules
  (tokens, keyframes, dark block) preserved verbatim; no Preflight injected. After restarting the
  dev server onto the new pipeline, all three pages render **byte-identical** to the baseline
  above (same total size, same 18.2/27.8/13.6 KB inline-style bytes, same attr counts) with no
  CSS errors in the log — i.e. installing Tailwind is a confirmed no-op until components adopt
  classes. Ready for step 2 (migrate hot-path components, enable Preflight then).

## Step 2 — hot-path components migrated (done)

Migrated `ListingGrid`, `ListingCard`, and `Header` from inline styles to Tailwind utilities.
**Preflight kept OFF** (decision revised from the original plan): it's a *global* reset, so
enabling it mid-migration would risk breaking the ~33 un-migrated components at once. Tailwind v4
utilities don't need it — even `border-style: solid` comes from a registered `--tw-border-style`
custom property, not Preflight (verified). Preflight becomes the *final* step once everything is on
classes. Also added a `min(340px,100%)` grid track (cards no longer overflow narrow phones) and
responsive header padding/gaps + a tagline hidden on small screens.

Measured deltas vs the step-0 baseline (dev-server HTML):

| Page | Inline-style bytes | Δ | Total HTML | Δ |
|---|---|---|---|---|
| `/` | 18.2 KB → 5.5 KB | **−70%** | 76.4 → 72.0 KB | −5.9% |
| `/bengaluru` | 27.8 KB → 6.0 KB | **−78%** | 102.6 → 95.0 KB | −7.4% |
| `/bengaluru/buy/apartment` | 13.6 KB → 5.9 KB | −57% | 67.6 → 64.7 KB | −4.2% |

The browse page (listing grid) got the biggest cut, as predicted — per-card inline style strings
are gone, replaced by one cached stylesheet. Remaining ~6 KB of inline style per page is the
un-migrated components (LocationPicker, SearchBar, CategoryTabs, AreaFilter, BrowseFilterBar,
Footer, page wrappers). Verified: typecheck clean, no dev-log errors, all utilities (token-mapped
and arbitrary) emit correct values, borders render (solid default present).

## What actually costs build/load time here (and what doesn't)

**Not a real problem:** there is no runtime CSS-in-JS engine, so there's no per-render style
serialization or client-side style injection beyond React's own. Build time is *not* currently
inflated by styling.

**The real load-time costs of inline styles:**
1. **HTML payload bloat on list pages.** Every element re-serializes its full style string into the
   SSR HTML. A listing grid of N cards repeats the same long style strings N times — this scales
   with list size and is pure, uncacheable transfer + parse cost on every navigation.
2. **No cross-page caching.** A static `.css` file is fetched once and cached across the whole
   site; inline styles re-ship with every HTML response.
3. **No dedup / atomicity.** Identical style objects are never collapsed.
4. **Per-render allocation** in client components — every render re-creates the style objects
   (minor CPU/GC, but real on large lists).

**The bigger lever than CSS technique:** 18/41 components are client components. Trimming
unnecessary `"use client"` reduces shipped/hydrated JS, which moves load-time metrics (TBT, LCP)
more than any CSS choice. Tracked as a parallel workstream below.

## Recommendation: **Tailwind CSS v4**

For *build + load performance specifically*, Tailwind v4 is the strongest single choice, and it
also closes the responsive gap:

- **Load:** one **atomic, aggressively-cached stylesheet**; HTML carries short class names instead
  of long inline style strings → **smaller HTML, biggest win exactly on the list pages that
  matter**. **Zero runtime JS** added.
- **Build:** v4's Rust/Oxide engine is very fast; unused classes are never emitted (no PurgeCSS
  step to configure). No per-render style-object allocation at runtime.
- **Responsive for free:** `sm:`/`md:`/`lg:` + container queries — fixes the actual UX gap that
  inline styles structurally blocked.
- **Reuses the existing tokens:** the `globals.css` custom properties map directly into Tailwind
  v4's `@theme`, so the design system and `data-theme` dark mode carry over unchanged — no
  re-picking colors.

### Alternatives considered

| Option | Load | Build | Migration | Notes |
|---|---|---|---|---|
| **Tailwind v4** (rec) | Best (atomic, cached, no JS) | Fast (Oxide) | Large but mechanical, incremental | Solves responsive; reuses tokens |
| **CSS Modules** | Great (static, scoped, cached) | Minimal | Verbose (file per component) | Zero deps; no responsive utilities, hand-write media queries |
| **vanilla-extract** (zero-runtime CSS-in-JS) | Great (extracted at build) | Higher build cost | Keeps TS ergonomics | More tooling; overkill given tokens already exist |
| **Plain CSS utility layer** (no framework) | Great | Zero | Manual | Lightest-touch; but reinvents a subset of Tailwind by hand |
| Stay inline | Baseline | Zero | None | Keeps HTML bloat + no responsive |

If the team dislikes utility-class density, **CSS Modules** is the honest runner-up: same load-time
profile, zero dependencies, at the cost of writing breakpoints by hand and more files.

## Plan (incremental, evidence-driven — no big-bang rewrite)

Tailwind coexists with inline styles, so migrate highest-traffic components first and measure.

**0. Baseline measurement (do first, so wins are provable).**
   - `@next/bundle-analyzer` for JS; record `.next` build time.
   - Lighthouse + a raw `curl | wc -c` of the homepage and a city browse page HTML (captures the
     inline-style payload). These numbers anchor every later claim.

**1. Install Tailwind v4** (`tailwindcss @tailwindcss/postcss`), add the PostCSS plugin, import it
   in `globals.css`. Map existing custom properties into `@theme` so `bg-green`, `text-muted`,
   etc. resolve to the current tokens; keep `data-theme` dark mode. No component changes yet —
   verify the app still renders identically.

**2. Migrate the hot path first** (largest HTML-payload / most-repeated):
   `ListingCard` → `ListingGrid` → `Header` → `BrowseFilterBar`/`AreaFilter`. Convert inline
   styles to classes; add `sm:`/`md:` breakpoints as you go (this is where responsive finally
   lands). Re-measure after this batch — expect the biggest single drop in list-page HTML size.

**3. Migrate the rest** page-by-page (`[city]` route, homepage, detail view, footer, pickers).

**4. Delete dead inline-style scaffolding**; keep `globals.css` for tokens/keyframes only.

**5. Parallel workstream — trim client components.** Audit the 18 `"use client"` files; push
   presentational ones back to Server Components. Bigger JS/hydration win than CSS alone; do
   opportunistically alongside each migrated component.

**6. Re-measure against the step-0 baseline**; record deltas in this doc.

## Explicit non-goals / caveats

- **Fonts, `output: standalone`, `next/image` are already optimal — don't touch.**
- Inline styles are *not* a crisis today; the migration's real payoff is **(a) list-page HTML
  size** and **(b) finally getting responsive design**, with build time roughly neutral.
- This is a large mechanical change across ~36 files — sequence it behind the current feature work,
  and gate each batch on the measurement so it stays justified rather than done on faith.

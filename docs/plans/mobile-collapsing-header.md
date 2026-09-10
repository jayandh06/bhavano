# Mobile collapsing header + colourful header bands

Status: **proposed** (not started). Two related but independently shippable pieces:

1. **Colourful header bands** — small, safe, no behaviour change. Do first.
2. **Mobile collapsing header** — new client leaf + one drawer. Larger; own section below.

---

## Part 1 — Colourful header bands

### Problem

`apps/web/src/components/home/Header.tsx` stacks three bands with no differentiation:
green utility bar → flat cream main header → flat cream category tabs. The design system
already defines `--gold: #c9a15a` (dark: `#d9b36b`) but it is used almost nowhere.

### Change (all pure `className` edits — no `"use client"`, no structural change, no bundle cost)

- **Utility bar**: `bg-green` → `bg-[linear-gradient(90deg,var(--green),#10513c)]`; add
  `border-b border-[color:var(--gold)]/30`.
- **Main header** `<header>`: `bg-bg` → `bg-[linear-gradient(180deg,var(--surface),var(--bg))]`;
  shadow `rgba(0,0,0,0.05)` → `rgba(11,61,46,0.08)` (green-tinted).
- **Category tabs row**: `bg-bg` → `bg-surface-alt` so it reads as its own band.
- **Gold as the interaction accent**:
  - Utility links: `hover:text-[color:var(--gold)] transition-colors`.
  - Active category tab underline: already `border-b-gold` — keep; make sure Tools/Plans match.
  - `SearchBar` focus: `focus-within:ring-2 focus-within:ring-[color:var(--gold)]/40`.
- Optional: logo tile `ring-1 ring-[color:var(--gold)]/25`; wordmark subtle green gradient via
  `bg-clip-text`. Skip green→gold clip on the wordmark (reads gimmicky).

Use token-based gradients (`var(--surface)` → `var(--bg)`) so the runtime `data-theme` dark swap
is free. Screenshot light + dark before/after.

---

## Part 2 — Mobile collapsing header

### Problem

On a phone the sticky header pins ~3 rows (identity / city + Post ad / category tabs) ≈ 25% of
the viewport for the entire scroll. The green utility bar (`For Owners / Tools / Plans / Help`)
already scrolls away and is unreachable without returning to the top.

### Target behaviour (mobile `< sm` only; desktop unchanged)

- **At top of page**: current full header.
- **Scrolled down**: collapse to a single ~52px band — `[logo mark] [☰] ········· [+ Post ad]`.
  Scroll back up (quick-return) re-expands.
- **`☰` opens one drawer** containing everything: Cities · Category tabs · Tools · Plans · Help ·
  For Owners · account section (Profile / My listings / Favourites / Messages / Saved searches /
  Logout) when signed in · Theme toggle.
- **Post ad** stays out of the drawer at every scroll position (it is the paid-campaign CTA).
- **Theme toggle** moves *into* the drawer on collapse (set-once preference, not scroll-time).

### Why "one drawer for everything"

Redundancy audit of the utility bar vs. the rest of the header:

| Utility link | Already reachable via | Verdict |
|---|---|---|
| Help → `/help` | Account menu → "Help" (same route) | fully redundant |
| Plans → `/premium` | Account menu → "Bhavano Plus" (same route) | redundant destination |
| For Owners → `/post` | The green **Post ad** button (same route) | redundant |
| Tools → `/tools` | nothing else in the header | **orphaned** |

Plus: the account dropdown only exists when logged in (`userName &&`) — logged-out mobile users
have no menu at all, so the utility bar is currently their only path to those pages.

Conclusion: on mobile, collapse **utility bar + account dropdown + category tabs** into a single
hamburger drawer. Removes the duplication instead of copying it into a drawer. Desktop keeps the
layered bar + account dropdown (room for words there).

### SEO / architecture constraints (this is a rankable, crawled surface)

- **`Header.tsx` stays a Server Component.** All nav content — city picker, category tabs, auth
  links, utility links — stays in the server-rendered HTML.
- Collapse logic lives in a **small `"use client"` leaf** (`CollapsingHeaderShell` or similar)
  wrapping the sticky region — never `"use client"` on `Header.tsx` or any page/layout.
- Use an **`IntersectionObserver` sentinel** (1px div at page top) to toggle a `data-collapsed`
  attribute — no scroll handler, no jank. Re-expand when the sentinel re-enters.
- The drawer **reuses the existing components** (`LocationPicker`, `HeaderAuthButtons`,
  `CategoryTabs`) reflowed via CSS — it does not re-fetch or render different components. All
  drawer links are present in server HTML (visually hidden until opened), not client-only.
- Preserve every `generateMetadata` / `metadata` export on the routes — untouched by this, but
  verify after the refactor.
- No URL / route / slug changes.

### Other implementation notes

- **Layout shift**: the sticky header shrinking pushes content up. Either make the collapsed bar
  `fixed` + reserve a spacer of its height, or animate `height`. This is the fiddly part —
  decide early.
- **Category tabs on browse/listing routes** are primary nav; burying them behind a tap adds
  friction. Option: keep a thin horizontally-scrollable tabs strip pinned even when collapsed on
  those routes; drawer-only elsewhere. Route-configurable.
- **A11y**: `aria-expanded`, `aria-controls`, focus trap in the drawer, `Esc` to close, body
  scroll-lock while open, drawer reachable by keyboard.
- **Brand**: give the collapsed band the Part 1 green tint / gold hairline so it reads as "the
  header, minimised".
- **Tests**: Playwright — collapse on scroll down, re-expand on scroll up, drawer open/close,
  every link reachable, no horizontal body scroll at 360px.

### Phasing

1. Ship **Part 1** (colour bands) on its own — trivial, reversible.
2. Ship **Part 2** as its own PR: `CollapsingHeaderShell` client leaf + drawer + IO sentinel +
   a11y + layout-shift handling + tests.

### Open questions

- Collapsed band: keep a small logo *mark* (icon only) for a home tap-target, or let `☰` double
  as it?
- Does desktop want a milder condense on scroll too, or stay fully as-is?
- Search bar is already `hidden sm:block` (absent on phone) — confirmed out of scope for mobile.

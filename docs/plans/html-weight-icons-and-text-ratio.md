# Lighter HTML: shared icon markup (low text-to-HTML ratio audit)

## Status: icons done and pushed (2026-10-20); card-data trimming deliberately not done

## Problem

A site audit (2026-10-20) warned "364 pages have low text-HTML ratio" (1-3% on the homepage, area, listing and static
pages). Google does not use this ratio for ranking, and the pages' text is in the server HTML (the audit ran with
JavaScript off), so this is a page-weight cleanup, not an indexing bug. Measured on the homepage (369 KB of HTML,
40 KB gzipped, 8.8 KB of visible text):

| Where the bytes were | Size |
|---|---|
| Next.js page data embedded for hydration | 139 KB |
| 200 inline SVG icons | 93 KB |
| Tailwind class names | 72 KB |
| Visible text | 8.8 KB |

## What changed

`Icon.tsx` rendered the full Lucide `<svg>` for every icon (~465 bytes: xmlns, width, height, fill, stroke,
stroke-width, caps, joins, two `lucide-*` classes), repeated about 200 times on the homepage. Now:

- `scripts/icon-sources.mjs` is the list of icon names to Lucide glyphs (the old `ICONS` map).
- `scripts/generate-icon-paths.mjs` (`pnpm --filter @bhavano/web gen:icons`) renders each glyph once and writes only its
  shapes to `src/components/home/iconPaths.generated.ts` (committed).
- `Icon` emits `<svg viewBox="0 0 24 24" class="ic …">` plus those shapes. Everything else (1em size, stroke, 1.75 weight,
  round caps and joins, vertical alignment, `fill: none`) is the shared `.ic` class in `globals.css`, in
  `@layer components` so a call site's own utilities (`w-8`, `text-xl`) still win; `filled` adds `.ic-filled`.
- `lucide-react` is no longer imported by the app, so it is out of the browser bundles (0 client chunks mention it).

**To add or change an icon:** edit `scripts/icon-sources.mjs`, run `gen:icons`, commit both files.

## Result (local production build, same pages and data)

| Homepage | Before | After |
|---|---|---|
| HTML | 368.8 KB | 326.9 KB (-11%) |
| SVG markup | 93.0 KB | 50.1 KB |
| Text-to-HTML ratio | 2.37% | 2.68% |

Icons were checked visually on the homepage (header, tabs, cards, share/heart/camera/pin) and by computed style (stroke
1.75px, fill none, expected sizes). Typecheck, ESLint and the web tests pass.

## Not done, and why

- **Trim what listing cards send to the browser.** Each card embeds all its fields, including up to six absolute photo URLs
  (~110 bytes each), even though only boosted cards cycle photos (the camera badge uses the count). Dropping the extra
  URLs for non-boosted cards and omitting null fields would save roughly 20-25 KB (about 7%) and needs a `photoCount` field
  and changes to both the card and the DTO consumers. The gain is too small for the risk; revisit only if page weight on
  slow phones matters more than it does now.
- **The ratio will not reach the 10% such audits like.** These pages are mostly markup around a few lines of text; the
  warning will probably stay even after this. It is not an SEO problem.

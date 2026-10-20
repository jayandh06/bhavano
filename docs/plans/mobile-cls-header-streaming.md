# Mobile layout shift (CLS) from the streamed header

## Status: fixed locally and committed (2026-10-20); production deploy is a separate step

## Problem

PageSpeed Insights (mobile, field data) for `https://www.bhavano.com/`: **CLS 0.62** (fails Core Web Vitals);
LCP 2.4 s, INP 147 ms, FCP 2 s, TTFB 1.1 s. Desktop was fine.

## What was shifting (measured with `layout-shift` entries on a phone-sized viewport)

On the live homepage a single large shift happened about 0.9 s after load (0.147 even on a fast connection; a slow
phone takes longer to run the JavaScript, so the real-user number is larger):

1. **Category tab strip** — `CategoryTabs` sits in `<Suspense>` inside `Header.tsx` with no fallback. It arrives late in
   the same HTML response (about 60% of the way through the document, swapped in by React's streaming script), so the
   band under the header was a 1px empty slot, then grew to ~45px and pushed the whole page down ~50px. On
   PG / Furniture / Interiors pages a second phone-only chip row (36.6px) is added as well.
2. **Location picker** (`LocationPicker`, also in an empty `<Suspense>`) — its 130x45px button streamed in after the
   search and Post ad buttons were already laid out, pushing them sideways (~140px) and making the row 5px taller.
3. **Play Store icon** (`GooglePlayHeaderIcon`) — rendered only after hydration (`useIsAndroidBrowser`), so on Android
   phones it popped in and grew the header's right-hand group by 40px.

## Fix

- `Header.tsx`: both `<Suspense>` boundaries now have **fallbacks that reserve the measured size** — tab strip
  `min-h-[44.7px]`, plus `max-sm:min-h-[81.3px]` when the active tab has the phone chip row (same condition as
  `CategoryTabs`); location picker `w-[130px] h-[45.3px]`. If the tab padding, the chip row or the picker's padding
  changes, update these numbers (comment in `Header.tsx`).
- `GooglePlayBadge.tsx` / `layout.tsx`: the icon is always in the server HTML, hidden by default, and revealed on
  Android phones by CSS keyed on `html[data-android="1"]`, which a tiny `beforeInteractive` script in `layout.tsx` sets
  before first paint (same test as `isAndroidBrowser`: Android and not a WebView). No hydration-dependent markup, no
  layout change.

## Result (local production build, phone viewport with an Android user agent, measured against production data)

| Page | Before | After |
|---|---|---|
| `/` | 0.147 (one shift) | 0 |
| `/pg` | 0.147 | 0 |
| Desktop `/` | 0 | 0 (header looks unchanged) |

## Not done / to watch

- The PageSpeed number is field data (28-day, real devices) and will take weeks to drop; re-run PageSpeed on the lab
  tab after deploying, and check Search Console's Core Web Vitals report later.
- Other possible shifts under a throttled phone (late fonts, listing-card images without reserved space) did not show
  up in these measurements on a fast connection; re-measure with the lab run before assuming they are fine.
- The other Core Web Vitals items (TTFB 1.1 s, LCP 2.4 s) are separate work.

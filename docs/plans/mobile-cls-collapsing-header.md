# Mobile CLS from the collapsing header

## Problem

PageSpeed Insights (mobile, field data, 25 Oct 2026) for `https://www.bhavano.com/`: **CLS 0.62**, 79% of page loads
poor; LCP 2.3 s and INP 159 ms are fine. An earlier fix for the streamed header pieces
(`mobile-cls-header-streaming.md`) took the first-load lab CLS to 0, but the field number stayed high.

## Cause (measured with `layout-shift` entries on a phone-sized viewport)

`MobileHeaderCollapse` swapped the tall header for a 52px bar as soon as the page scrolled one pixel: it removed
the ~140px header (`display: none`) and added a 52px spacer. The whole page jumped up ~139px (a 0.16 shift), and
jumped back down when scrolling to the top (another 0.16). Every real visit that scrolls a little and returns
adds to the session's score. The first-load measurement never scrolled, so it showed 0.

## Fix

- `Header.tsx`: on phones the header is no longer sticky (`sm:sticky sm:top-0`); it scrolls away with the page.
- `MobileHeaderCollapse.tsx`: the header is never removed and no spacer is added. The sentinel moved to just below
  the header, and the fixed 52px bar appears once the header has scrolled off the top. The bar overlays the
  content, so nothing moves.
- Desktop is unchanged (header still sticky).

## Behaviour change

On a phone the full header (top links, logo/search row, tabs) now scrolls away with the page instead of being
replaced by the bar after the first pixel; the bar appears when the header is gone.

## Checked

Live page with the equivalent CSS injected: zero layout shifts scrolling down to 150, 600, 2000 px and back to 0
(before: 0.16 on the first scroll and 0.16 on return).

## To watch

The PageSpeed field number is a 28-day window and will take weeks to drop. A fixed install-app card appears at the
bottom on the first scroll; it is a fixed element, so it did not add to the shift in these measurements.

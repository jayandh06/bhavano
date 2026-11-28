# Background trellis

The site was flat cream with white cards. This adds a very faint, drawn background so the top bar, the
page and the footer read as three different surfaces.

## Design

A 30px tile of crossing diagonals with a small five-dot flower at each crossing (a jaali-style
diamond trellis). It is our own SVG, so there is no photo, download or licence to track.

| Surface | Where | Light | Dark |
|---|---|---|---|
| Top bar | the green strip in `components/home/Header.tsx` (`trellis-band`) | darker-than-green lines and dots | very faint dark lines on the brighter green |
| Logo/search row | the `<header>` background in `Header.tsx` (`--trellis-head`) | green hairlines, gold flowers, a touch stronger than the page | light hairlines, dim gold flowers |
| Category tab row | `Header.tsx` | plain, no trellis | plain |
| Page | `body` in `globals.css` (`--trellis-body`) | green hairlines (3.5%), gold flowers (8%) on cream | light hairlines (1.8%), gold flowers (7%) on near-black |
| Footer | `components/home/Footer.tsx` (`trellis-band`) | deep green with the top bar's dark trellis; text and links switch to `on-green` | the brighter green, same faint trellis |

Everything is deliberately faint: light mode lines 0.045 to 0.06 and flowers 0.2 to 0.24 (green
bands 0.2 and 0.26, darker than the green); dark mode roughly a third of that.

## How it works

Tiles are CSS custom properties (`--trellis-band`, `--trellis-body`) holding `url("data:image/svg+xml,...")`,
declared in `:root` and overridden in `:root[data-theme="dark"]`. Colours cannot read CSS variables
inside a data URI, so each theme has its own tile. No image request, no JavaScript, no change to
server or client components, so no SEO impact. Cards and inputs are opaque, so they sit cleanly on top.

## In the app (built 2026-11-28, not yet released)

The app draws the same tile with `react-native-svg` (`components/Trellis.tsx`; the numbers are in `theme/trellis.ts`, and a test fails
if they drift from `globals.css`).

| Surface | App |
|---|---|
| `band` | The utility bar and the bottom tab bar |
| `head` | The header rows on Home, Requirements and Blog, the slim collapsed bar and every screen's title bar, over a surface-to-page fade |
| `body` | Behind every screen's content, the first-launch country chooser and the forced-update screen |

Cards, inputs, the category strip, sheets and footers inside a screen stay solid. Checked in a browser build in light and dark mode;
scrolling on a lower-end Android phone is not yet checked.

## Website note

Page wrappers (`min-h-screen bg-bg`, on every page) paint solid cream over the body, so `globals.css` also puts the body tile on `.min-h-screen.bg-bg`. Without that the body trellis never showed on the listing area.

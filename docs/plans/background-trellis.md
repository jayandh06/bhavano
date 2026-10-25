# Background trellis

The site was flat cream with white cards. This adds a very faint, drawn background so the top bar, the
page and the footer read as three different surfaces.

## Design

A 30px tile of crossing diagonals with a small five-dot flower at each crossing (a jaali-style
diamond trellis). It is our own SVG, so there is no photo, download or licence to track.

| Surface | Where | Light | Dark |
|---|---|---|---|
| Top bar | the green strip in `components/home/Header.tsx` (`trellis-band`) | light lines and dots on green | dark lines and dots on the brighter green, about half as strong |
| Logo/search row and tab row | the `<header>` background and the tab row in `Header.tsx` (`--trellis-head`) | green hairlines, gold flowers, a touch stronger than the page | light hairlines, dim gold flowers |
| Page | `body` in `globals.css` (`--trellis-body`) | green hairlines, gold flowers on cream | light hairlines, dim gold flowers on near-black |
| Footer | `components/home/Footer.tsx` (`trellis-band`) | deep green with the top bar's trellis; text and links switch to `on-green` | the brighter green, same quieter trellis |

Dark mode is quieter on purpose: a light line on near-black glows, so lines are about 0.025 opacity
and flowers about 0.09 (light mode: 0.07 and 0.30).

## How it works

Tiles are CSS custom properties (`--trellis-band`, `--trellis-body`) holding `url("data:image/svg+xml,...")`,
declared in `:root` and overridden in `:root[data-theme="dark"]`. Colours cannot read CSS variables
inside a data URI, so each theme has its own tile. No image request, no JavaScript, no change to
server or client components, so no SEO impact. Cards and inputs are opaque, so they sit cleanly on top.

## Not done

The mobile app still has its flat background. The same tile can be drawn with `react-native-svg`
behind the screens; it would ship in the next app release.

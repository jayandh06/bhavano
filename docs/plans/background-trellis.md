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
| Page | `body` in `globals.css` (`--trellis-body`) | very faint green hairlines, gold flowers on cream | very faint light hairlines, dim gold flowers on near-black |
| Footer | `components/home/Footer.tsx` (`trellis-band`) | deep green with the top bar's dark trellis; text and links switch to `on-green` | the brighter green, same faint trellis |

Everything is deliberately faint: light mode lines 0.045 to 0.06 and flowers 0.2 to 0.24 (green
bands 0.2 and 0.26, darker than the green); dark mode roughly a third of that.

## How it works

Tiles are CSS custom properties (`--trellis-band`, `--trellis-body`) holding `url("data:image/svg+xml,...")`,
declared in `:root` and overridden in `:root[data-theme="dark"]`. Colours cannot read CSS variables
inside a data URI, so each theme has its own tile. No image request, no JavaScript, no change to
server or client components, so no SEO impact. Cards and inputs are opaque, so they sit cleanly on top.

## Not done

The mobile app still has its flat background. The same tile can be drawn with `react-native-svg`
behind the screens; it would ship in the next app release.

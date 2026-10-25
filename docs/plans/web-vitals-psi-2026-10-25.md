# PageSpeed findings, 25 Oct 2026 (mobile, `https://bhavano.com/`)

Field data: LCP 2.3 s, INP 159 ms (both good), CLS 0.62 (fixed separately, see
`mobile-cls-collapsing-header.md`), FCP 1.9 s, TTFB 1.0 s.

## Done

- **LCP image was lazy-loaded.** The LCP element is the first Featured-rail photo, which `next/image` rendered with
  `loading="lazy"` and no priority, so the browser found it late. `FeaturedRail` now marks the first card
  `imageLoading="preload"` (high priority, preloaded from the HTML) and the next two `eager`; the rest stay lazy.
  `ListingCard` takes the new optional `imageLoading` prop.

## Looked at, not changed

- **Document request +420 ms (1 redirect).** The test URL was the apex `bhavano.com`, which redirects to `www`. Links
  and ads that already use `www` do not pay it. Test `https://www.bhavano.com/` to see the real number.
- **Render-blocking CSS (14 KiB, est. 150 ms).** `experimental.inlineCss` would inline it, at the cost of larger HTML on
  every page and no CSS caching between pages. Worth trying only if FCP still matters after the LCP change.
- **Legacy JavaScript (13 KiB).** Next's own polyfill chunk (`Array.prototype.at/flat`, `Object.fromEntries`, ...). It is
  loaded with `nomodule`, so modern browsers do not run it; not worth fighting.
- **Unused JavaScript (224 KiB).** Almost all of it is Google Tag Manager and gtag (504 KiB transferred). Loading GTM later
  would cut it but risks missing fast bounces in ads attribution, so it is left as is. The first-party chunk has about
  24 KiB unused.

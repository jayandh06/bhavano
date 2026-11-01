# Layout shift reporter

PageSpeed field data (1 Nov 2026, mobile, 28 days): CLS 0.59 (fails), LCP 2.2 s, INP 183 ms. Lab runs and a phone-size scripted scroll of the
homepage show CLS about 0, so the shift only happens to real visitors (a late sign-in prompt, an in-app browser, another page, ...).

## What it does
`LayoutShiftReporter` (client leaf in the root layout) sums non-input layout shifts. When a visitor leaves a page with a total of 0.1 or more
it `sendBeacon`s `{cls, path, width, shifts[{value, at, sources}]}` to `/api/web-vitals/cls`, which writes one `[cls] {...}` line to the web
container log (shipped to Loki by Alloy). Path only (no query string), element selectors only (tag, id, 3 classes), no text.

## Reading it
Loki: `{container="bhavano-web-1"} |= "[cls]"`; or `docker logs bhavano-web-1 | grep "\[cls\]"` on the host. Group by `path` and by the first
`sources` entry, fix the biggest, then confirm in PageSpeed's field data (it lags: 28-day window).

## Remove
Delete the component, its layout line and the route once the cause is fixed.

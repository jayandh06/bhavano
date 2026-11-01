# Defer tracking scripts (Meta Pixel, GTM)

PageSpeed (desktop, 1 Nov 2026): score 69, Total Blocking Time 1,390 ms while FCP/LCP/CLS were good and real-user Core Web Vitals passed.
Tracking scripts were the main cause: GTM (with the GA4 and Ads tags) 511 KiB / ~970 ms blocking, Meta Pixel 270 KiB; our own chunks ~557 ms.

## Change
`apps/web/src/app/layout.tsx` defines `window.__bhavanoAfterIdle(fn)`, which runs `fn` on the first pointerdown / keydown / scroll / touchstart
or after 3.5 s. The Meta Pixel and GTM loaders still set up their queues immediately (`fbq` stub, `dataLayer`) but insert the remote script
through it. Events pushed before the script loads replay when it does, so none are lost (`lib/gtm.ts` only pushes to `dataLayer`).

## Caveats
- A visitor who leaves within 3.5 s without interacting is not seen by GA4 / Ads / Meta browser tags. Attribution used for conversions is
  server side (`bhavano_acq` cookie, `User.acquisition*`, Data Manager upload), so it is unaffected.
- Not done: removing duplicate tags inside the GTM container (needs the GTM console), trimming Pixel events.

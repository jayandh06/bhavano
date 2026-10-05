# Admin remembered filters and how screens are entered

Each admin list screen remembers its last filter in one cookie (`bhavano_admin_filters`), decided
in `apps/admin/src/middleware.ts` via `decideFilterAction` (`lib/rememberedFilters.ts`): a bare
visit to a screen with a remembered filter is redirected (307) to the filtered URL, `?__clearFilters=1`
clears it, and any URL with a real query is remembered. The reasoning for doing this in middleware
rather than on the client is in that file's header comment.

## Bug: date presets did nothing until "Apply filters" was pressed (2026-09-25)

Reported on the Listings screen: switching 1 / 7 / 15 / 30 days flickered and snapped back, and only
worked after pressing Apply filters once.

**Cause (reproduced locally in a production build with headless Chromium):** entering a screen
through a client-side `<Link>` navigation (the nav-bar tab, or a "← Back to listings" link) while a
filter was remembered made middleware answer that fetch with a 307. Next's router followed the
redirect and showed the filtered page, but was then left unable to act on the next `<Link>` click
there: a preset showed its pending state and reverted, with **no request sent** and no URL change.
A real page load (typing the URL, refresh) took the identical redirect and was fine, and so was the
page after pressing Apply (a full document load) — which is exactly the "works after Apply"
pattern. It only happens when a filter is remembered, so a first-ever visit was fine.

**Fix:** links whose target is a restorable bare path are now full page loads:
- `AdminNav` tabs are plain `<a>` instead of `<Link>`.
- The ten "← Back to listings" links use `components/FullPageLink.tsx` (an `<a>` behind a component
  so `@next/next/no-html-link-for-pages` doesn't flag each call site).

Tab switches are now a full reload (a few hundred ms) — acceptable for an internal tool.

**Also shipped the same day:** `DateRangeFilter` preset pills now show a pending state (selected +
"…") via `useLinkStatus()`, so a slow listings query on a cold start no longer looks like a dead
click (`docs/plans/admin-lazy-loaded-lists.md`).

## Bug: Listings kept filtering by some listing's owner (2026-10-05)

Reported: the Listings screen kept opening with the User filter set to an owner's name from some
listing, without the admin ever choosing it.

**Cause:** a listing row's owner-name link (`/?userId=…&userLabel=…&__skipRemember=1`) was meant to
filter once without being remembered. Middleware honoured the marker by leaving the cookie alone
and **redirecting to the same URL minus the marker**, but the browser then requested that clean
URL, which middleware saw as an ordinary filtered visit and remembered. So every owner click became
the remembered filter, restored on every later bare visit.

**Fix:** `SKIP_REMEMBER_PARAM` is now a plain no-op: the marker stays in the URL and the cookie is
untouched. Tab, sort, page, date-preset and column links copy every param, so browsing that owner's
listings stays unremembered too. "Apply filters" drops the marker (`CarriedParams` omits it), so a
filter the admin actually applies is remembered as before. Cost: `__skipRemember=1` is visible in
the address bar on that view.

An already-polluted cookie stays until the admin presses Reset or applies a filter once.

## Tried and rejected (don't retry these)

- **Rewriting instead of redirecting for client navigations** (`NextResponse.rewrite` when
  `Sec-Fetch-Dest: empty`): fixed presets but left Reset, entered the same way, a no-op — the
  router state is inconsistent when the URL and the rendered page's search params disagree.
- **Keeping Next's `_rsc` token on the redirect:** no effect.
- **Answering client navigations with a stub non-RSC response** so Next falls back to a page load:
  breaks Next's own background prefetches (the page never went network-idle).
- Next strips both `_rsc` and the `RSC` header before middleware runs, so neither can tell a client
  navigation from a document load; `Sec-Fetch-Dest` can, but none of the above was worth using it for.

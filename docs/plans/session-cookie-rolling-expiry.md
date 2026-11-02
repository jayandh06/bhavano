# Page-visit session cookie: 30-minute rolling expiry

## Problem (2 Nov 2026)

Admin Page visits showed two rows for one person, three minutes apart: same account, phone, IP, referrer (`www.google.com`) and landing page
(`/messages/<id>`), with 3 and 1 page views. `bhavano_sid`, the cookie that ties page views to a Visit, was a browser-session cookie (no
expiry). On Android a link tapped from another app (an email, WhatsApp, the Google app, a notification) opens in an in-app browser tab that
does not reuse the earlier cookie, so the second tap started a new session. (Likely cause, not proven for this case; the symptom, the same
person split into two visits minutes apart, is what the data shows.)

## Change

`bhavano_sid` now lives 30 minutes and is rewritten on every page view, so a return inside 30 minutes continues the same session, the same
Visit row and the same page trail (`apps/web/src/lib/sessionCookie.ts`):
- `middleware.ts` writes it on every counted document navigation (the steady-state early return included);
- `/api/analytics/pageview` rewrites it on every client-side navigation ping, so someone browsing by client-side links for longer than 30
  minutes keeps their session.

## What changes in the numbers

Sessions are now defined by 30 minutes of inactivity rather than "until the browser closes". Expect fewer, longer sessions: people who
return within 30 minutes (including after closing the browser) no longer count as new, and views per session rise a little. Comparisons
of sessions or views per session before and after 2 Nov 2026 are therefore not like for like. Campaign analytics counts a visit per
session, so ad visit counts can drop slightly for the same real traffic. The 24 h window used for attributing sign-ups and payments is
unchanged. "Group by user" on Page visits still combines one person's sessions across longer gaps.

## Not changed

Cookie name, `httpOnly`, `SameSite=Lax`, `Secure` in production; the permanent `bhavano_acq` cookie; the mobile app (it does not use this
cookie). Old rows are not merged.

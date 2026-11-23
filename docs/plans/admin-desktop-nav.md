# Admin: website-style menu on desktop, hamburger on small screens

## Status: built 2026-11-23

**Ask (owner):** make the admin menu more web style for desktop instead of a hamburger.

**What changed (`AdminNav.tsx`, `globals.css`)**
- From 960 px wide, the six groups (Moderation, People, Analytics, Outreach, Billing & promotions, Settings) sit in
  the top bar as dropdowns. A dropdown opens on hover or click and closes on Escape or an outside click. The group
  that holds the current page is underlined and the current page is highlighted inside it. Groups with more than
  eight links (Settings) open in two columns; the last two groups open towards the left so a wide panel is never cut
  off at the window edge.
- Below 960 px the existing "Menu" button and panel are unchanged. The 960 px breakpoint (not 1024) is so ordinary
  laptop windows get the bar; the six triggers, brand and Logout need about 900 px.
- Links are still plain `<a>` full page loads, for the reason documented in `AdminNav.tsx` and
  `admin-remembered-filters.md`. The group list (`NAV_GROUPS`) is shared by both menus, so a new link appears in both.

**Not verified:** previewed the real stylesheet and markup in a static page at 1020 px (bar, active group, wide Settings
dropdown on screen); not run inside the logged-in admin, and the click and keyboard paths were not exercised there.

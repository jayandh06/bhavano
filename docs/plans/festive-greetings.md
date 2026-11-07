# Festive greetings on the home page (Diwali 2026)

Built 7 Nov 2026. A Diwali banner at the top of the home page, for the days around the festival, gone afterwards without a deploy.

- **What:** `DiwaliBanner` (`apps/web/src/components/home/DiwaliBanner.tsx`): a dark green to saffron card with a marigold toran along the top, three clay lamps (one on a phone) whose flames flicker, "शुभ दीपावली" and "Happy Diwali from Bhavano", and two buttons: Browse homes (scrolls to the listings) and Post a free ad (`/post?from=diwali_banner`, a new entry source, shown in the admin trail as "Diwali banner").
- **SEO and speed:** a server component, inline SVG and CSS only, no images, no client JavaScript, fixed minimum height so nothing shifts. Uses a `<section aria-label>` and plain paragraphs, so the page still has one `<h1>`.
- **Dates:** `apps/web/src/lib/festive.ts`. Diwali 2026 (Lakshmi Puja Sunday 8 Nov): shown 5 Nov 00:00 to 12 Nov 00:00 India time. Check the festival date against a calendar for each year and add a window.
- **Preview any day:** `/?festive=diwali` forces it on, `/?festive=off` hides it.
- **Motion:** flames and sparkles animate only when the visitor has not asked for reduced motion (`globals.css`).
- **Not done:** no festive treatment on other pages, the mobile app, or the admin; no logo change.

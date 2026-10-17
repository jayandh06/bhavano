# Blog in the mobile app

## What
The website blog (`/blog`, `/blog/[slug]`) is now also in the iOS/Android app: a **Blog** row in the
home drawer opens `app/blog/index.tsx`, and each post opens `app/blog/[slug].tsx`.

## Design
- **One source of posts.** `apps/web/src/lib/blog/posts.ts` moved to `packages/types/src/blogPosts.ts`
  (exported as `@bhavano/types/blogPosts`). The web file is now a re-export, so web imports and its
  tests are unchanged. A post added once shows up on both platforms.
- **Posts ship inside the app bundle**, like they ship inside the web build. A new post reaches the
  app only with a new app release (or OTA update); the web gets it on deploy. Fine for now; if
  posts need to reach the app faster, move them behind a BFF endpoint.
- **Native renderer** `src/components/home/BlogBody.tsx` mirrors the web `BlogBody`. Inline
  `[label](/path)` links open a native screen when one exists (`/contact`, `/help`, `/about`,
  `/blog`); otherwise they open the website in the browser via `appWebUrl`.
- **`packages/types/dist` is committed** (EAS resolves it without a build hook), so `pnpm build` in
  `packages/types` must be run and the output committed whenever `blogPosts.ts` changes.
- **SEO:** no change to web routes, metadata or JSON-LD; the web pages are still server-rendered.

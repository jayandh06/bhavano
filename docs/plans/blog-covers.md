# Blog cover images: drawn scenes, with an optional photo per article

Requested 2026-10-24: add images to the existing blog articles. Decisions: drawn, branded covers for
every article (no text in any image), plus an optional real photograph that replaces a drawn cover
where a good, licensed one exists. A cover on every article and on the blog list, web and app.

## What exists
- **Drawn covers** (`packages/types/src/blogCovers.ts`): 16 flat scenes made of rectangles, circles,
  ellipses, polygons and paths on a 200 x 105 canvas: flats, house, plot, approvals (document and
  shield), calculator, key, map, skyline, crane, bed, desk, boxes, magnifier, chart, phone, people.
  The same description is drawn by the website (inline SVG, `BlogCover.tsx`) and the app
  (`react-native-svg`, `BlogCover.tsx`), so there are no image files to host and nothing to load.
- **Which scene:** `motifFor(slug)`: an explicit table for every current article, then word rules for
  a new one (a slug with "pg" gets the bed, "emi" the calculator, "builders-in-" the skyline…), then
  the flats. **Variety:** one of five brand colour sets and the details (lit windows, where the sun
  sits, the skyline's buildings) come from a hash of the slug, so no two articles match.
- **Rules:** no text in any picture (there is no text shape), no faces, no real buildings or logos,
  nothing that looks like a listing photo. Alt text describes the scene; on a list card the picture is
  marked decorative because the title beside it already says what the article is.
- **Where it shows:** the blog list (a thumbnail beside each card, on top on a phone), the top of every
  article, and the same two places in the app.
- **Photo slot:** `BlogPost.cover` (`{ src, alt, credit?, creditUrl?, licence? }`). When set it replaces
  the drawn cover, as an image in the list and article (web and app) and as the share image, the
  schema.org `image` and the Open Graph image on the web. `src` is a file under
  `apps/web/public/blog/covers/`, 1200 x 630. The app loads it from the site.

## Photos: rules
- Free-licence only (CC0 or public domain, or the Unsplash, Pexels or Pixabay licence), commercial use
  allowed. The licence page is checked for every photo and the source, photographer, licence and date
  are recorded in `docs/plans/blog-image-credits.md` before the file goes in.
- Generic subjects only: doors and keys, empty rooms, documents, calculators, skylines, building
  exteriors. Not a real builder's project, not a logo or branded tower, not a flat that could read as a
  listing, not identifiable faces without a stated model release.
- Not for the builder guides: a photo of a company's project could look like an endorsement, so they
  keep their drawn skyline.
- Save as WebP, 1200 x 630, under about 100 KB. Show a small "Photo:" credit line (the code does this
  when `credit` is set).

## Limits
- The drawn covers are SVG, which social sites do not render, so articles without a photo keep the
  site-wide share image. A photo cover also fixes that for its article.
- The app carries the drawn covers from its next release (the posts and the scenes ship in the bundle).
- The drawings are deliberately simple and diagrammatic; they are not AI-generated pictures. If
  photographic or AI-generated images are wanted, produce them with an image tool and add them through
  the photo slot.

## Photos in use

Two articles carry a photograph instead of a drawn cover (see `blog-image-credits.md`): `rent-or-buy-questions` and `society-maintenance-charges-explained`. Every other article, including the builder guides, keeps its drawn cover. A test checks that each photo file exists, is WebP under 110 KB, has alt text and a credit, and has a row in the credits file.

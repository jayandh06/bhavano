# "Established builders in <city>" blog posts

**Status 2026-10-24: published, with the site owner (Jayandhan Rajasundaram) as reviewer.** The facts
in `builder-guides-review.md` were not independently re-checked by me: the reviewer line is the
owner's confirmation. The text below describes how the posts were drafted; "to publish" is done.

Requested 2026-10-24: "top 10 construction builders in each city". Decisions taken with the owner:
- **Not ranked.** Builders are listed alphabetically; no post says "best" or "top". A ranking is a
  factual claim about each named company that the site cannot stand behind (the blog's rules at the
  top of `packages/types/src/blogPosts.ts`: no figures or claims the site cannot back).
- **The 11 main cities:** Bengaluru, Mumbai, Delhi NCR, Pune, Hyderabad, Chennai, Kolkata,
  Ahmedabad, Jaipur, Lucknow, Coimbatore (the cities marked popular in `seedCities.ts`).
- **Drafted first, then published** once the owner confirmed the facts, as with the approvals posts.

## Where it is
`packages/types/src/builderGuides.ts` exports `BUILDER_GUIDES` (11 posts, `builders-in-<city>`)
built from one list of cities and builders, so a correction is one line. They are appended to
`POSTS`, so they are on the site and in the sitemap, and reach the app with its next release. Rules
are enforced by
`apps/web/src/lib/builderGuides.test.ts`: alphabetical, no ranking words, no digits in a builder's
line, an explicit "not a ranking / nobody paid" note, no author or reviewer yet, links only to real posts.

## What each post says
A note (not advice, not an endorsement, not a ranking, not complete, nobody paid); the builders, each
with one neutral line (where it is based and what it builds, no numbers or praise); a seven-step
method to check any builder (project RERA number on the state authority, past delivery against
promised dates, recorded complaints, a visit to a finished project, approvals, construction stage,
a lawyer reading the agreement); a city-specific paragraph (which authority, which local approvals);
questions to ask a builder; links to the city's listings and the EMI calculator. The method is the
part that does not go stale.

## Published
Done 2026-10-24: appended to `POSTS`, `reviewedBy` set on each post, the "not published" test
inverted, the blog link test's allowed list extended with the city pages and the explainers they link
to, web deployed. The app carries the posts from its next release.

To correct a name later: edit the entry in `builderGuides.ts` and redeploy web. To remove a company,
delete its line; the tests keep the list alphabetical and figure-free.

## Why the smaller cities have fewer names
Jaipur has 3, Lucknow 6, Coimbatore 8. For these there is little independent information; the
searches found mostly builders' own pages and property-portal listings. A short list that says
so is better than a padded one.

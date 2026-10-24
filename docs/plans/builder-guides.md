# "Established builders in <city>" blog posts (draft, not published)

Requested 2026-10-24: "top 10 construction builders in each city". Decisions taken with the owner:
- **Not ranked.** Builders are listed alphabetically; no post says "best" or "top". A ranking is a
  factual claim about each named company that the site cannot stand behind (the blog's rules at the
  top of `packages/types/src/blogPosts.ts`: no figures or claims the site cannot back).
- **The 11 main cities:** Bengaluru, Mumbai, Delhi NCR, Pune, Hyderabad, Chennai, Kolkata,
  Ahmedabad, Jaipur, Lucknow, Coimbatore (the cities marked popular in `seedCities.ts`).
- **Drafted, not deployed.** Held until the company facts have been checked, as with the approvals posts.

## Where it is
`packages/types/src/builderGuides.ts` exports `BUILDER_GUIDE_DRAFTS` (11 posts, `builders-in-<city>`)
built from one list of cities and builders, so a correction is one line. It is **not** in `POSTS`,
so nothing is in the sitemap, the site or the app. Rules are enforced by
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

## To publish
1. Have the facts in `docs/plans/builder-guides-review.md` checked.
2. Add `...BUILDER_GUIDE_DRAFTS` to the end of `POSTS` in `blogPosts.ts`.
3. Add `reviewedBy` (real people who checked it, honest roles) to each post.
4. Remove the "are not published yet" test or invert it, deploy web, and ship the app so it carries the posts.
5. The sitemap picks the posts up automatically.

## Why the smaller cities have fewer names
Jaipur has 3, Lucknow 6, Coimbatore 8. For these there is little independent information; the
searches found mostly builders' own pages and property-portal listings. A short list that says
so is better than a padded one.

import type { BlogPost } from "./blogPosts";
/** DRAFT blog posts: "established builders in <city>" for the 11 main cities.
 *
 * Deliberately NOT part of POSTS (blogPosts.ts), so nothing here is published, in the sitemap or in
 * the app until someone has checked the company facts. To publish after review, add
 * `...BUILDER_GUIDE_DRAFTS` to the end of POSTS, add `reviewedBy` for the real people who checked
 * them, and ship. See docs/plans/builder-guides.md and docs/plans/builder-guides-review.md.
 *
 * Framing, by decision (2026-10-24): builders are listed alphabetically, never ranked, and no post
 * says "best" or "top". Each builder gets one short, neutral line (where it is based and the kind
 * of projects it builds). No figures, awards, delivery counts, financial claims or opinions: those
 * are the claims that go stale or can be disputed, and the blog's rules say the site must stand
 * behind anything numeric. The real value of the post is the checking method, which does not age. */
interface BuilderEntry {
    name: string;
    /** One neutral line: where it is based, what it builds. No numbers, no praise. */
    note: string;
}
interface CityGuide {
    /** Slug suffix, also the city's URL slug on the site. */
    citySlug: string;
    city: string;
    /** The authority where projects in this city register, as buyers will find it online. */
    rera: string;
    /** One paragraph of what is specific to buying a home from a builder in this city. */
    localNote: string;
    /** Alphabetical. */
    builders: BuilderEntry[];
}
export declare const BUILDER_GUIDE_PUBLISHED = "2026-10-24";
export declare const BUILDER_GUIDE_DRAFTS: BlogPost[];
/** For tests and the review sheet: the raw entries behind each post. */
export declare const BUILDER_GUIDE_SOURCE: readonly CityGuide[];
export {};

import type { BlogPost } from "./blogPosts";
/** Blog posts: "established builders in <city>" for the 11 main cities, appended to POSTS in
 * blogPosts.ts. Published 2026-10-24 with the site owner as reviewer. Before changing a name or a
 * line here, read docs/plans/builder-guides.md and docs/plans/builder-guides-review.md.
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
export declare const BUILDER_GUIDES: BlogPost[];
/** For tests and the review sheet: the raw entries behind each post. */
export declare const BUILDER_GUIDE_SOURCE: readonly CityGuide[];
export {};

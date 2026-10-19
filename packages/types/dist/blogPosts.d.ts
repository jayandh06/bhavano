/** Blog content lives in code for now: a post is a typed object, rendered by /blog/[slug]. No CMS,
 * no database, no new dependency. Adding a post means adding an entry to POSTS and deploying.
 *
 * Authorship is honest by design. `author` is a real person's name and role, set only when that
 * person actually wrote or reviewed the post; without it the byline is "Bhavano Editorial Team".
 * Don't add invented authors or bios — a byline is a claim about a real person, and this site has a
 * Trust page that says what we do and don't verify.
 *
 * Content rules: general advice and plain explanations only. No prices, rents or statistics unless
 * they come from data the site can stand behind, and no legal or financial advice.
 *
 * Inline links inside text use [label](/path) and are rendered by the post page. */
export type BlogBlock = {
    type: "p";
    text: string;
} | {
    type: "h2";
    text: string;
} | {
    type: "ul";
    items: string[];
} | {
    type: "ol";
    items: string[];
} | {
    type: "note";
    text: string;
};
export interface BlogPost {
    slug: string;
    title: string;
    /** Meta description and the index card summary. Keep under ~160 characters. */
    description: string;
    /** ISO date. */
    published: string;
    /** ISO date, only when the post was materially revised. */
    updated?: string;
    /** Short label shown on the card, e.g. "Checklist". */
    format: string;
    /** Roughly how long it takes to read, in minutes. */
    readingMinutes: number;
    /** A real person's name and role, if one wrote this post. */
    author?: {
        name: string;
        role?: string;
    };
    /** Real people who actually read and checked this post, shown as "Reviewed by". Set only after
     * each person has confirmed they reviewed it, and describe their role honestly: a reviewer who is
     * not a lawyer must not be presented as one, however legal the topic. */
    reviewedBy?: {
        name: string;
        role?: string;
    }[];
    body: BlogBlock[];
}
export declare const DEFAULT_BYLINE = "Bhavano Editorial Team";
export declare const POSTS: BlogPost[];
export declare function getPost(slug: string): BlogPost | undefined;
/** Newest first. */
export declare function sortedPosts(): BlogPost[];
export declare function bylineFor(post: BlogPost): string;
/** Splits text on [label](/path) links so the page can render them as <Link>s. */
export type InlinePart = {
    kind: "text";
    text: string;
} | {
    kind: "link";
    text: string;
    href: string;
};
export declare function parseInline(text: string): InlinePart[];

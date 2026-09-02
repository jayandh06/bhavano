/** Lowercase, hyphenated, URL-safe slug — used both for a listing's stored `slug`
 * (generated once at creation from its title) and to derive city/area path segments
 * on the fly (no dedicated slug column on City/Area; their names have no punctuation
 * that would make the round trip ambiguous). */
export declare function slugify(text: string): string;

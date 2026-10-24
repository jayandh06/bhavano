export declare function sanitizePageViewQuery(search: string | null | undefined): string | null;
/** The query as people read it: `bedrooms=2&area=HSR Layout`, undone from URL encoding where that is
 * safe. For display in admin only; the stored form stays encoded. */
export declare function readablePageViewQuery(query: string | null | undefined): string;

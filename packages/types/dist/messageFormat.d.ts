export type MessageSegment = {
    type: "text";
    value: string;
} | {
    type: "url";
    value: string;
};
/** Splits a chat message body into alternating plain-text and URL segments so a renderer
 * can linkify the URLs while leaving everything else — including embedded `\n` — untouched. */
export declare function segmentMessageBody(body: string): MessageSegment[];
/** A `www.` or bare-domain segment has no scheme to open — this adds one. An already-absolute
 * URL is returned unchanged. Only for use at click/tap time; the displayed text stays as typed. */
export declare function normalizeUrlForOpening(url: string): string;
/** The path (with query and hash) of a link to Bhavano's own site, or null for any other site,
 * so the web and app can open it in place instead of in a new browser tab. */
export declare function bhavanoSitePath(url: string): string | null;

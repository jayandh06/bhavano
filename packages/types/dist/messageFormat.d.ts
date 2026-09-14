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
/** A `www.`-prefixed segment has no scheme to open — this adds one. An already-absolute
 * URL is returned unchanged. Only for use at click/tap time; the displayed text stays as typed. */
export declare function normalizeUrlForOpening(url: string): string;

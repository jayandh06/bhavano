"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.segmentMessageBody = segmentMessageBody;
exports.normalizeUrlForOpening = normalizeUrlForOpening;
exports.bhavanoSitePath = bhavanoSitePath;
// An HTML link (its href is what's shown and opened; the label is dropped so it can't dress a
// link up as something else), then http(s)://, bare www., and bare bhavano.com links. No other
// scheme (e.g. javascript:) ever matches, so a segment can be dropped straight into an <a href>
// or Linking.openURL with no sanitizing.
const URL_REGEX = /<a\s[^>]*?href\s*=\s*["'](https?:\/\/[^"'\s<>]+)["'][^>]*>[\s\S]*?<\/a>|https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|(?:[a-z0-9-]+\.)*bhavano\.com(?![\w-]|\.\w)(?:[/?#][^\s<>"]*)?/gi;
/** Trims sentence punctuation a URL regex swept up along with the link (a period ending
 * the sentence, a closing paren that was never opened) so the link doesn't include text
 * that was never part of it. A trailing `)` is kept when the match itself contains a
 * balancing `(` (e.g. a Wikipedia-style `..._(disambiguation)` URL). */
function trimTrailingPunctuation(match) {
    let end = match.length;
    while (end > 0) {
        const ch = match[end - 1];
        if (".,!?;:'\"".includes(ch)) {
            end--;
            continue;
        }
        if (ch === ")") {
            const opens = (match.slice(0, end).match(/\(/g) ?? []).length;
            const closes = (match.slice(0, end).match(/\)/g) ?? []).length;
            if (closes > opens) {
                end--;
                continue;
            }
        }
        break;
    }
    return match.slice(0, end);
}
/** Splits a chat message body into alternating plain-text and URL segments so a renderer
 * can linkify the URLs while leaving everything else — including embedded `\n` — untouched. */
function segmentMessageBody(body) {
    const segments = [];
    let lastIndex = 0;
    URL_REGEX.lastIndex = 0;
    let match;
    while ((match = URL_REGEX.exec(body))) {
        const anchorHref = match[1];
        // A bare domain glued to a preceding word or email user (support@bhavano.com,
        // notbhavano.com) isn't a link.
        const bareDomain = !/^(?:<|https?:\/\/|www\.)/i.test(match[0]);
        if (bareDomain && match.index > 0 && /[\w@.-]/.test(body[match.index - 1]))
            continue;
        const url = anchorHref ?? trimTrailingPunctuation(match[0]);
        if (!url)
            continue;
        if (match.index > lastIndex)
            segments.push({ type: "text", value: body.slice(lastIndex, match.index) });
        segments.push({ type: "url", value: url });
        lastIndex = match.index + (anchorHref ? match[0].length : url.length);
    }
    if (lastIndex < body.length)
        segments.push({ type: "text", value: body.slice(lastIndex) });
    return segments;
}
/** A `www.` or bare-domain segment has no scheme to open — this adds one. An already-absolute
 * URL is returned unchanged. Only for use at click/tap time; the displayed text stays as typed. */
function normalizeUrlForOpening(url) {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
/** The path (with query and hash) of a link to Bhavano's own site, or null for any other site,
 * so the web and app can open it in place instead of in a new browser tab. */
function bhavanoSitePath(url) {
    const match = /^(?:https?:\/\/)?(?:www\.)?bhavano\.com(?=$|[/?#])(.*)$/i.exec(url);
    if (!match)
        return null;
    const rest = match[1];
    return rest.startsWith("/") ? rest : `/${rest}`;
}

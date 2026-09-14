export type MessageSegment = { type: "text"; value: string } | { type: "url"; value: string };

// http(s):// or bare www. only — no other scheme (e.g. javascript:) ever matches, so a
// segment can be dropped straight into an <a href> or Linking.openURL with no sanitizing.
const URL_REGEX = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;

/** Trims sentence punctuation a URL regex swept up along with the link (a period ending
 * the sentence, a closing paren that was never opened) so the link doesn't include text
 * that was never part of it. A trailing `)` is kept when the match itself contains a
 * balancing `(` (e.g. a Wikipedia-style `..._(disambiguation)` URL). */
function trimTrailingPunctuation(match: string): string {
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
export function segmentMessageBody(body: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  URL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_REGEX.exec(body))) {
    const url = trimTrailingPunctuation(match[0]);
    if (!url) continue;
    if (match.index > lastIndex) segments.push({ type: "text", value: body.slice(lastIndex, match.index) });
    segments.push({ type: "url", value: url });
    lastIndex = match.index + url.length;
  }
  if (lastIndex < body.length) segments.push({ type: "text", value: body.slice(lastIndex) });
  return segments;
}

/** A `www.`-prefixed segment has no scheme to open — this adds one. An already-absolute
 * URL is returned unchanged. Only for use at click/tap time; the displayed text stays as typed. */
export function normalizeUrlForOpening(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

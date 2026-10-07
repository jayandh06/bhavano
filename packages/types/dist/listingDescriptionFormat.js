"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseListingDescription = parseListingDescription;
const BOLD_REGEX = /\*\*(.+?)\*\*/g;
function parseRuns(text) {
    const runs = [];
    let lastIndex = 0;
    BOLD_REGEX.lastIndex = 0;
    let match;
    while ((match = BOLD_REGEX.exec(text))) {
        if (match.index > lastIndex)
            runs.push({ text: text.slice(lastIndex, match.index), bold: false });
        runs.push({ text: match[1], bold: true });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length)
        runs.push({ text: text.slice(lastIndex), bold: false });
    return runs;
}
const BULLET_LINE = /^[-•]\s+(.*)$/;
/**
 * Parses the limited markdown-like convention the AI listing-copy prompts are instructed to
 * produce (see `buildDescriptionPrompt` in apps/bff/src/ai/providers/listing-copy-prompts.ts):
 * blank-line-separated paragraphs, consecutive `- `/`• ` lines as a bullet list, and `**text**`
 * for a highlighted phrase.
 *
 * Deliberately narrow, same "one regex pass, not a library" precedent as this package's own
 * `messageFormat.ts` — a real-estate description never needs headings, links, or nesting. A
 * block parses as bullets only when *every* non-empty line in it starts with `- `/`• ` — one
 * dash among ordinary sentences is far more likely punctuation than a one-item list, so a mixed
 * block always falls back to a plain paragraph.
 *
 * Each platform renders the returned blocks itself (web: a small React component, mobile: RN
 * `<Text>`/`<View>`, admin: the same as web) — this function only does the parsing, matching how
 * `segmentMessageBody` is the shared logic behind the separate per-platform `MessageBody`
 * components.
 */
function parseListingDescription(text) {
    const blocks = text
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean);
    return blocks.map((block) => {
        const lines = block
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
        const bulletMatches = lines.map((line) => BULLET_LINE.exec(line));
        if (lines.length > 0 && bulletMatches.every((m) => m !== null)) {
            return { type: "bullets", items: bulletMatches.map((m) => parseRuns(m[1])) };
        }
        return { type: "paragraph", runs: parseRuns(lines.join(" ")) };
    });
}

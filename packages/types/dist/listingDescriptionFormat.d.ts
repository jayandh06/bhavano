export type DescriptionRun = {
    text: string;
    bold: boolean;
};
export type DescriptionBlock = {
    type: "paragraph";
    runs: DescriptionRun[];
} | {
    type: "bullets";
    items: DescriptionRun[][];
};
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
export declare function parseListingDescription(text: string): DescriptionBlock[];

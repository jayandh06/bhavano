import type { DetailsIssue } from "@bhavano/types/postDetailsIssues";

/** The step-by-step Details form (version `v3`, docs/plans/post-ad-simpler-form.md): one page whose sections appear one after another, each
 * once the one above it is complete. These are the pure rules for it, kept out of the wizard so they can be tested on their own.
 *
 * Order on the page: location, then photos and video, then the essentials (every required field), then the title, description and the
 * owner question, then the optional sections one at a time. */
export type RevealSectionId = "media" | "essentials" | "copy" | `opt:${string}`;

/** Which block a problem sits in: 0 location, 1 photos, 2 the essentials, 3 title, description and the owner question. */
export function revealRankOfTarget(target: string): 0 | 1 | 2 | 3 {
  // The admin-assisted seller panel sits above the location, so it comes first.
  if (target === "location" || target === "assisted") return 0;
  if (target === "photos") return 1;
  if (target === "title" || target === "description" || target === "owner_type") return 3;
  // posted_by, attr:<field key>, price, brokerage
  return 2;
}

/** The problems in the order the sections appear, so the first problem is always in a section that is already showing. Keeps the order
 * the problems arrived in within a block. */
export function sortIssuesByReveal(issues: DetailsIssue[]): DetailsIssue[] {
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => revealRankOfTarget(a.issue.target) - revealRankOfTarget(b.issue.target) || a.index - b.index)
    .map(({ issue }) => issue);
}

/** A value counts as an answer when it is not empty: "0" and "no" are answers. */
export function isAnswered(value: string | string[] | undefined): boolean {
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim() !== "";
}

/** An optional section counts as done when at least one of its fields has an answer. (Not every field, because many do not apply to every
 * property, such as a RERA number, and the next section must not wait for an answer that does not exist.) */
export function isSectionAnswered(fieldKeys: string[], attributes: Record<string, string | string[]>): boolean {
  return fieldKeys.some((key) => isAnswered(attributes[key]));
}

/** Which sections should be showing right now. Each block waits for the problems above it to be cleared; the optional sections
 * then appear in order, each after the previous one has been answered. `optionalSectionIds` is in display order. */
export function autoRevealedSections(
  issues: DetailsIssue[],
  optionalSectionIds: string[],
  isOptionalAnswered: (sectionId: string) => boolean,
): Set<RevealSectionId> {
  const hasIssueIn = (rank: 0 | 1 | 2 | 3) => issues.some((issue) => revealRankOfTarget(issue.target) === rank);
  const shown = new Set<RevealSectionId>();
  if (hasIssueIn(0)) return shown;
  shown.add("media");
  if (hasIssueIn(1)) return shown;
  shown.add("essentials");
  if (hasIssueIn(2)) return shown;
  shown.add("copy");
  if (hasIssueIn(3)) return shown;
  for (const id of optionalSectionIds) {
    shown.add(`opt:${id}`);
    if (!isOptionalAnswered(id)) break;
  }
  return shown;
}

/** A short name for a section, for the screen-reader announcement when it appears. */
export function revealSectionLabel(id: RevealSectionId, optionalLabels: Record<string, string>): string {
  if (id === "media") return "Photos and video";
  if (id === "essentials") return "The essentials";
  if (id === "copy") return "Title and description";
  return optionalLabels[id.slice("opt:".length)] ?? "More details";
}

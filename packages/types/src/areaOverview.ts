/** Area overview content: the reviewed text shown below the listings on an area's landing page
 * (`/{city}/{area}`). Shared by the BFF (which stores and validates it), the admin app (which
 * edits and reviews it) and the web app (which renders it). See docs/plans/area-overview-pages.md. */

export type AreaOverviewStatus = "draft" | "in_review" | "published";

export interface AreaFaq {
  question: string;
  answer: string;
}

export interface AreaOverviewContent {
  /** Paragraphs under "About {area}". */
  about: string[];
  /** Paragraphs under "Getting around". */
  gettingAround: string[];
  faqs: AreaFaq[];
}

export interface AreaOverviewDto extends AreaOverviewContent {
  areaId: string;
  status: AreaOverviewStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

/** One row of the admin list: every area with listings, with its overview status if it has one. */
export interface AdminAreaOverviewRow {
  areaId: string;
  cityName: string;
  areaName: string;
  activeListings: number;
  status: AreaOverviewStatus | null;
  updatedAt: string | null;
  reviewedByName: string | null;
}

export interface AdminAreaOverviewsPage {
  items: AdminAreaOverviewRow[];
  /** Rows matching the filters (before paging). */
  total: number;
  /** Every city that has at least one row, for the city filter. Not narrowed by the other filters. */
  cities: string[];
}

export type AreaOverviewSortField = "city" | "area" | "listings" | "status" | "updated";

export const AREA_OVERVIEW_SORT_FIELDS: readonly AreaOverviewSortField[] = ["city", "area", "listings", "status", "updated"];

/** Outcome of one area in a bulk status change. */
export interface BulkAreaOverviewItemResult {
  areaId: string;
  ok: boolean;
  error?: string;
}

export interface BulkAreaOverviewResult {
  results: BulkAreaOverviewItemResult[];
}

export interface AdminAreaOverviewDetail {
  areaId: string;
  cityName: string;
  areaName: string;
  activeListings: number;
  overview: AreaOverviewDto | null;
}

/** What a reviewer confirms before an overview can be published. The admin page shows these as
 * tick boxes; publishing requires `checklistConfirmed: true`, which the page only sends when all
 * are ticked. The first one is also enforced by `validateAreaOverviewContent`. */
export const AREA_OVERVIEW_REVIEW_CHECKLIST = [
  "Every fact is correct: where the area is, what it borders, how it is laid out, and the roads or metro named.",
  "Nothing will go out of date soon: no shop, school or project names, and no 'coming soon' claims.",
  "No prices, rents, percentages or investment advice, and no claims about safety or about who lives there.",
  "The wording is fair to every community and is not copied from another website.",
  "It says something specific to this area, and each FAQ answers a real question.",
] as const;

const BANNED_NUMBERS = /₹|\bRs\.?\s?\d|\d\s?%|\blakh|\bcrore/i;
const BANNED_LINKS = /https?:\/\/|www\.|@\w+\.\w+/i;

/** Problems with the text that no reviewer should have to spot by eye. An empty array means the
 * content passes. The same rules run in the editor (live) and in the BFF (before saving). */
export function validateAreaOverviewContent(content: AreaOverviewContent): string[] {
  const problems: string[] = [];
  const paragraphs = (label: string, items: string[], min: number, max: number, minLen: number, maxLen: number) => {
    if (items.length < min) problems.push(`${label}: add at least ${min} paragraph${min === 1 ? "" : "s"}.`);
    if (items.length > max) problems.push(`${label}: at most ${max} paragraphs.`);
    items.forEach((text, i) => {
      const length = text.trim().length;
      if (length < minLen) problems.push(`${label} ${i + 1}: too short (at least ${minLen} characters).`);
      if (length > maxLen) problems.push(`${label} ${i + 1}: too long (at most ${maxLen} characters).`);
    });
  };

  paragraphs("About", content.about, 1, 4, 40, 600);
  paragraphs("Getting around", content.gettingAround, 0, 2, 40, 600);

  if (content.faqs.length < 1) problems.push("FAQs: add at least 1 question.");
  if (content.faqs.length > 6) problems.push("FAQs: at most 6 questions.");
  content.faqs.forEach((faq, i) => {
    if (faq.question.trim().length < 10 || faq.question.trim().length > 120) {
      problems.push(`FAQ ${i + 1} question: between 10 and 120 characters.`);
    }
    if (faq.answer.trim().length < 20 || faq.answer.trim().length > 500) {
      problems.push(`FAQ ${i + 1} answer: between 20 and 500 characters.`);
    }
  });

  const everything = [...content.about, ...content.gettingAround, ...content.faqs.flatMap((f) => [f.question, f.answer])];
  if (everything.some((text) => BANNED_NUMBERS.test(text))) {
    problems.push("Remove prices, rents and percentages. Any figure must come from live listing data, not typed text.");
  }
  if (everything.some((text) => BANNED_LINKS.test(text))) {
    problems.push("Remove web addresses and email addresses.");
  }
  return problems;
}

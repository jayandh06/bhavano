import type { ListingCategory, TransactionType } from "./index";
import { brokerageFeeIssue, listingAttributeIssues } from "./categoryFields";

/** What is still wrong on the posting wizard's Details step, as an ordered list (form order) instead of the
 * single "first problem" the step used to compute. Shared by the web and mobile wizards so both agree with each
 * other and with the server's checks. The first entry is exactly what the old one-line "To preview: ..." message
 * showed. See docs/plans/post-details-step-experience.md, Phase 1. */
export interface DetailsIssue {
  /** Where the problem is, so the screen can scroll to it and mark it: "location", "posted_by", "attr:<field key>",
   * "price", "brokerage", "photos", "owner_type", "assisted", "title" or "description". */
  target: string;
  text: string;
  /** True when it is simply not filled in yet (shown muted); false when a value has to change (shown red). */
  missing: boolean;
  /** "other" is everything except the title and description, which the AI helper fills (so it can run while only
   * these remain). */
  group: "other" | "copy";
}

export interface DetailsIssueInput {
  hasPin: boolean;
  pinLookingUp: boolean;
  hasCity: boolean;
  areaText: string;
  /** The area is an existing one (picked or matched), so its length is not ours to limit. */
  areaIsExisting: boolean;
  areaMaxLength: number;
  /** The category asks "Posted by" as a field (owner or broker). */
  needsPostedBy: boolean;
  postedByAnswered: boolean;
  category: ListingCategory | null;
  transactionType: TransactionType | null;
  attributes: Record<string, string | string[]>;
  priceMissing: boolean;
  priceIssue: string | null;
  /** The listing's total (or monthly rent) the brokerage limits scale with. */
  totalPrice: number | null;
  photoCount: number;
  minPhotos: number;
  /** The separate "Are you the owner or an agent?" question (when the account has not answered it). */
  askSellerType: boolean;
  sellerTypeAnswered: boolean;
  /** Admin-assisted posting only: what is wrong with the seller details, if anything. */
  assistedProblem: string | null;
  title: string;
  titleMin: number;
  description: string;
  descriptionMin: number;
}

export const ATTR_TARGET_PREFIX = "attr:";

export function attributeTarget(fieldKey: string): string {
  return `${ATTR_TARGET_PREFIX}${fieldKey}`;
}

/** Every problem on the Details step, in form order. */
export function postDetailsIssues(input: DetailsIssueInput): DetailsIssue[] {
  const issues: DetailsIssue[] = [];
  const other = (target: string, text: string, missing: boolean) => issues.push({ target, text, missing, group: "other" });

  // City and area come from the pin, never typed (docs/plans/mandatory-pin-and-owner-location-edit.md).
  if (!input.hasPin) other("location", "Drop a pin or search an address to set the location", true);
  else if (input.pinLookingUp) other("location", "Finding the location…", true);
  else if (!input.hasCity) other("location", "Pick the nearest city", true);
  else if (input.areaText.trim().length === 0)
    other("location", "We couldn't read an area for that spot. Move the pin a little or search the address", true);
  else if (!input.areaIsExisting && input.areaText.trim().length > input.areaMaxLength)
    other("location", `Area / locality must be ${input.areaMaxLength} characters or fewer`, false);

  // Asked with its own friendlier copy before the generic attribute sweep, which would say "... is required".
  if (input.needsPostedBy && !input.postedByAnswered) other("posted_by", "Choose Owner or Broker / Agent under Posted by", true);

  if (input.category && input.transactionType) {
    for (const issue of listingAttributeIssues(input.category, input.transactionType, input.attributes)) {
      // The brokerage-against-price check (no field) is made below with the real total; and Posted by was
      // already reported above with its own wording.
      if (!issue.key) continue;
      if (issue.key === "fromBroker" && input.needsPostedBy && !input.postedByAnswered) continue;
      other(attributeTarget(issue.key), issue.text, issue.text.endsWith(" is required"));
    }
  }

  if (input.priceMissing) other("price", "Add a price", true);
  else if (input.priceIssue) other("price", input.priceIssue, false);

  if (input.transactionType) {
    const brokerage = brokerageFeeIssue(input.transactionType, input.totalPrice, input.attributes);
    if (brokerage) other("brokerage", brokerage, false);
  }

  if (input.photoCount < input.minPhotos) other("photos", `Add at least ${input.minPhotos} photos`, true);
  if (input.askSellerType && !input.sellerTypeAnswered) other("owner_type", "Choose Owner or Agent / broker", true);
  if (input.assistedProblem) other("assisted", input.assistedProblem, false);

  const copy = (target: string, text: string, missing: boolean) => issues.push({ target, text, missing, group: "copy" });
  const title = input.title.trim();
  if (title.length === 0) copy("title", "Add a title", true);
  else if (title.length < input.titleMin) copy("title", `Title needs at least ${input.titleMin} characters`, false);
  const description = input.description.trim();
  if (description.length === 0) copy("description", "Add a description", true);
  else if (description.length < input.descriptionMin)
    copy("description", `Description needs at least ${input.descriptionMin} characters`, false);

  return issues;
}

/** The first problem, or null. What "To preview: ..." showed before there was a list. */
export function firstDetailsIssue(issues: DetailsIssue[]): DetailsIssue | null {
  return issues[0] ?? null;
}

/** Problems that stop the AI copy helper from running: everything except the title and description it writes. */
export function hasBlockingOtherIssue(issues: DetailsIssue[]): boolean {
  return issues.some((issue) => issue.group === "other");
}

/** target to message, for putting a message under each field. */
export function issueMessages(issues: DetailsIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) if (!(issue.target in out)) out[issue.target] = issue.text;
  return out;
}

/** The three short screens the mobile app splits Details into: 0 location and photos, 1 the property's details and
 * price, 2 title and description. Web keeps one page; this is how a problem maps to a screen. */
export function detailsPartOfTarget(target: string): 0 | 1 | 2 {
  if (target === "location" || target === "photos") return 0;
  if (target === "owner_type" || target === "assisted" || target === "title" || target === "description") return 2;
  return 1;
}

const PREVIEW_LABEL_BY_TARGET: Record<string, string> = {
  location: "Set the location",
  posted_by: "Choose Owner or Broker",
  price: "Add a price",
  brokerage: "Fix the brokerage",
  photos: "Add photos",
  owner_type: "Choose Owner or Agent",
  assisted: "Fix the seller details",
  title: "Add a title",
  description: "Add a description",
};

/** The Preview button's text while things are left: it names the first one (and how many more) instead of saying
 * "Preview Ad" and then refusing, which is what sellers tapped to find out what was missing. Falls back to the
 * plain label when nothing is left. See docs/plans/post-details-step-experience.md, section 10. */
export function previewButtonLabel(issues: DetailsIssue[]): string {
  const first = issues[0];
  if (!first) return "Preview Ad";
  const short = PREVIEW_LABEL_BY_TARGET[first.target] ?? "Fill the required details";
  return issues.length > 1 ? `${short} (+${issues.length - 1} more)` : short;
}

/** How many problems sit in each target's section, for the "N left" badge on a section header. `attr:<key>` targets
 * are looked up by field key; the shared Price input lives in the pricing section. */
export function issueCountForFields(issues: DetailsIssue[], fieldKeys: string[], includePrice = false): number {
  const keys = new Set(fieldKeys.map(attributeTarget));
  if (includePrice) {
    keys.add("price");
    keys.add("brokerage");
  }
  return issues.filter((issue) => keys.has(issue.target)).length;
}

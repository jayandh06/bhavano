import type { ListingStatus, TransactionType } from "./index";

/**
 * What each ad status means, in the words the owner sees when changing it (web edit form and the
 * mobile edit screen share this so the copy cannot drift). See docs/plans/explain-listing-statuses.md
 * for what each claim below was checked against: Sold, Rented and Deactivated all behave the same
 * (hidden from search, contact blocked, ad slot freed); they differ only in the label on the ad's
 * own page. Do not add a claim here that the code does not do — for example, nothing tells people
 * who showed interest when an ad is closed, so no line promises that.
 */
export interface ListingStatusOption {
  value: ListingStatus;
  /** Owner-facing name. "Deactivated" is shown as "Paused" on the owner's screens only. */
  title: string;
  /** One plain sentence: when to pick it. */
  summary: string;
  /** What happens, one short line each. */
  effects: string[];
}

const HIDDEN_EFFECTS = (label: string): string[] => [
  "Hidden from search and browse",
  `The ad's page stays up, labelled ${label}`,
  "People can no longer contact you through it",
  "Frees one of your ad slots",
];

const OPTIONS: Record<ListingStatus, ListingStatusOption> = {
  active: {
    value: "active",
    title: "Active",
    summary: "Buyers and renters can find and contact you.",
    effects: ["Shown in search and on the site", "Uses one of your ad slots"],
  },
  sold: {
    value: "sold",
    title: "Sold",
    summary: "The deal is done. Mark it Sold so people stop asking.",
    effects: HIDDEN_EFFECTS("Sold"),
  },
  rented: {
    value: "rented",
    title: "Rented",
    summary: "The deal is done. Mark it Rented so people stop asking.",
    effects: HIDDEN_EFFECTS("Rented"),
  },
  deactivated: {
    value: "deactivated",
    title: "Paused",
    summary: "Not available for now, but it may come back.",
    effects: HIDDEN_EFFECTS("Deactivated"),
  },
};

const ORDER: ListingStatus[] = ["active", "sold", "rented", "deactivated"];

/** The name of a status as the owner sees it ("Paused" for deactivated). */
export function ownerStatusLabel(status: ListingStatus): string {
  return OPTIONS[status].title;
}

/** The label shown on the ad's own page (unchanged wording: "Deactivated", not "Paused"). */
export function publicStatusLabel(status: ListingStatus): string {
  return status === "active" ? "Active" : status === "sold" ? "Sold" : status === "rented" ? "Rented" : "Deactivated";
}

/**
 * The options to offer for an ad. A sale ad is closed as Sold and a rent or lease ad as Rented; the
 * other one is offered only if it is already the ad's current value, so an old choice is never
 * hidden from the person who made it. Active and Paused are always offered.
 */
export function statusOptionsFor(transactionType: TransactionType, current: ListingStatus): ListingStatusOption[] {
  const closed: ListingStatus = transactionType === "rent" || transactionType === "lease" ? "rented" : "sold";
  return ORDER.filter((s) => s === "active" || s === "deactivated" || s === closed || s === current).map((s) => OPTIONS[s]);
}

/**
 * What will happen if the owner saves `next`, shown under the cards before they save. Null when
 * nothing changes or the ad goes (back) to Active. `featured` adds the one cost that is easy to
 * miss: nothing pauses a running Featured period, so paid days keep running while the ad is hidden.
 */
export function leavingActiveNotice(
  next: ListingStatus,
  current: ListingStatus,
  opts: { featured?: boolean } = {},
): string | null {
  if (next === "active" || next === current) return null;
  const base = `Your ad will be hidden from search and people can no longer contact you through it. Its page will show as ${publicStatusLabel(next)}. You can switch it back to Active later.`;
  return opts.featured ? `${base} Your Featured days keep running while it is hidden.` : base;
}

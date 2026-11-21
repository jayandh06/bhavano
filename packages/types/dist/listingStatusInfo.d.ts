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
/** The name of a status as the owner sees it ("Paused" for deactivated). */
export declare function ownerStatusLabel(status: ListingStatus): string;
/** The label shown on the ad's own page (unchanged wording: "Deactivated", not "Paused"). */
export declare function publicStatusLabel(status: ListingStatus): string;
/**
 * The options to offer for an ad. A sale ad is closed as Sold and a rent or lease ad as Rented; the
 * other one is offered only if it is already the ad's current value, so an old choice is never
 * hidden from the person who made it. Active and Paused are always offered.
 */
export declare function statusOptionsFor(transactionType: TransactionType, current: ListingStatus): ListingStatusOption[];
/**
 * What will happen if the owner saves `next`, shown under the cards before they save. Null when
 * nothing changes or the ad goes (back) to Active. `featured` adds the one cost that is easy to
 * miss: nothing pauses a running Featured period, so paid days keep running while the ad is hidden.
 */
export declare function leavingActiveNotice(next: ListingStatus, current: ListingStatus, opts?: {
    featured?: boolean;
}): string | null;

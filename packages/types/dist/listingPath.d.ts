import type { ListingCardDto, TransactionType } from "./index";
/** The URL grammar's top-level segment — groups the 4 real `TransactionType` values the same
 * way the homepage's tabs already do (buy+sell, rent+lease), so `/city/buy/...` reads naturally
 * instead of exposing the raw enum. Moved here from apps/web/src/lib/seoRoute.ts (which still
 * re-exports both this and `transactionGroupFor` so no web import changes) because the BFF needs
 * `buildListingPath` too — see notifications.service.ts's notifyListingPosted, which is the
 * reason this file exists at all. Do not fork a second copy in the BFF: the URL grammar has
 * already changed twice in one week, and a second definition would have silently drifted both
 * times. */
export type TransactionGroup = "buy" | "rent-lease";
export declare function transactionGroupFor(t: TransactionType): TransactionGroup;
/** Canonical SEO path for a listing: /{city}/{locality}/{transactionGroup}/{category}/{slug}-{id}.
 * Built entirely from card/detail DTO fields already in hand — no extra fetch needed. Facet
 * (bedroom count/sharing type/condition/service type) is a browse-level filter, not encoded in
 * an individual listing's own canonical URL — see apps/web/src/lib/listingPath.ts's
 * `buildBrowsePath` for that (still web-only: nothing outside the browse UI needs it). */
export declare function buildListingPath(item: Pick<ListingCardDto, "id" | "slug" | "category" | "transactionType" | "cityName" | "area">): string;

import type { ListingCategory, SellerType } from "./index";
import { type FieldOption } from "./categoryFields";
/** "Owner" / "Agent" / "Agent · Sai Realty" (plus "· RERA verified ✓" once admin has checked the
 * agent's RERA number) for a listing's poster, or null when they never said — shown as nothing
 * rather than a guess. See docs/plans/broker-paid-bundles.md. */
export declare function postedByLabel(postedBy: SellerType | null, agency?: string | null, reraVerified?: boolean): string | null;
/** The per-listing "Posted by Broker / Agent" (`fromBroker`) attribute as a SellerType — null
 * when it's blank. */
export declare function sellerTypeFromBroker(value: unknown): SellerType | null;
/** Whether `category`'s form has the per-listing `fromBroker` field. Where it does, that field is
 * the post form's one Owner/Agent question (shown as Owner | Broker / Agent buttons and required
 * before Preview); the separate "Are you the owner or an agent?" block is only for categories
 * without it. Asking both let a switched-off field silently count as "owner". */
export declare function hasFromBrokerField(category: ListingCategory): boolean;
/** How the post/edit forms present `fromBroker`: named answers, Owner first, instead of the
 * config's Yes/No (which reads backwards under "Posted by Broker / Agent" for an owner). */
export declare const POSTED_BY_FORM_LABEL = "Posted by";
export declare const POSTED_BY_FORM_OPTIONS: readonly FieldOption[];
/** The `fromBroker` value a new listing in `category` should start with — the account's
 * Owner/Agent answer, still editable per listing. Empty when the category has no such field or
 * the account hasn't answered. */
export declare function fromBrokerDefault(category: ListingCategory, sellerType: SellerType | null): Record<string, string>;

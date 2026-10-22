import type { ListingCategory, TransactionType } from "./index";
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
export declare const ATTR_TARGET_PREFIX = "attr:";
export declare function attributeTarget(fieldKey: string): string;
/** Every problem on the Details step, in form order. */
export declare function postDetailsIssues(input: DetailsIssueInput): DetailsIssue[];
/** The first problem, or null. What "To preview: ..." showed before there was a list. */
export declare function firstDetailsIssue(issues: DetailsIssue[]): DetailsIssue | null;
/** Problems that stop the AI copy helper from running: everything except the title and description it writes. */
export declare function hasBlockingOtherIssue(issues: DetailsIssue[]): boolean;
/** target to message, for putting a message under each field. */
export declare function issueMessages(issues: DetailsIssue[]): Record<string, string>;
/** The three short screens the mobile app splits Details into: 0 location and photos, 1 the property's details and
 * price, 2 title and description. Web keeps one page; this is how a problem maps to a screen. */
export declare function detailsPartOfTarget(target: string): 0 | 1 | 2;

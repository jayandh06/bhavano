import type { HomeCategoryFilter, ListingCategory, PropertyTypeFilter, TransactionType } from "./index";
import { type FieldOption } from "./categoryFields";
import { type AreaUnit } from "./areaUnit";
/**
 * The questions asked after "Yes, find this for me", and the vocabulary a refined requirement is
 * stored in — see docs/plans/requirement-refinement-questions.md.
 *
 * One module for the BFF (validation, label), the web wizard and the mobile one, so the apps
 * cannot disagree about what is asked, what is already answered, or what a valid answer is. Every
 * option is derived from `CATEGORY_FIELD_CONFIG` — a requirement can never ask for a value no
 * listing is able to hold.
 */
/** Beyond this many areas a requirement is "anywhere" again, and the fan-out to owners and agents
 * stops being targeted. */
export declare const MAX_REQUIREMENT_AREAS = 5;
/** Category-specific wants, keyed like `Listing.attributes`. Every value is a list read as "any
 * of" — "semi or fully furnished", "double or triple sharing" — including the questions that only
 * allow one pick, so readers never have to branch on shape. `amenities` holds amenity keys, all
 * of which are wanted. */
export type RequirementAttributes = Record<string, string[]>;
/** The criteria of a requirement as the questions see them — `CreateRequirementInput` and
 * `RequirementDto` both carry this shape. */
export interface RequirementCriteria {
    category?: ListingCategory;
    transactionType?: TransactionType;
    cityId?: string;
    areaIds?: string[];
    /** BHK buckets, 5 = "5+" (the same convention as the browse filter). */
    bedroomOptions?: number[];
    minPrice?: number;
    maxPrice?: number;
    /** Plot / commercial / storage size, always in sqft; `areaUnit` is only how it was entered. */
    minAreaSqft?: number;
    maxAreaSqft?: number;
    areaUnit?: AreaUnit;
    attributes?: RequirementAttributes;
    moveInBy?: string;
}
/** The home tabs, which are how the whole site already groups intent. */
export type RequirementIntent = HomeCategoryFilter;
export declare const REQUIREMENT_INTENTS: {
    value: RequirementIntent;
    label: string;
}[];
/** Which categories each intent offers — the same lists as the home tabs' property-type facet. */
export declare const INTENT_CATEGORIES: Record<RequirementIntent, ListingCategory[]>;
export declare const REQUIREMENT_CATEGORY_LABELS: Record<ListingCategory, string>;
/** The follow-up for the two intents that span two transaction types. Rent vs lease matters more
 * than it looks: a lease is a lump sum, so the budget question is a different question. */
export declare const INTENT_TRANSACTION_CHOICES: Partial<Record<RequirementIntent, {
    value: TransactionType;
    label: string;
}[]>>;
/** Reads the intent back out of stored criteria. `buy` and `sell` both mean the seeker is buying:
 * listings say `sell`, and some older captures said `buy`. */
export declare function intentOf(category?: ListingCategory, transactionType?: TransactionType): RequirementIntent | undefined;
/** The criteria after choosing an intent: the transaction type that intent implies, and the
 * category kept only where the new intent still offers it. */
export declare function applyIntent(intent: RequirementIntent, current: Pick<RequirementCriteria, "category" | "transactionType">): Pick<RequirementCriteria, "category" | "transactionType">;
/** Whether a category can be had on this transaction at all — the posting rules, with `buy`
 * read as `sell`. */
export declare function isValidRequirementTransaction(category: ListingCategory, transactionType: TransactionType): boolean;
export interface RequirementAttributeQuestion {
    key: string;
    label: string;
    /** Several picks allowed ("any of"). A single-pick question still stores a one-item list. */
    multi: boolean;
    options: FieldOption[];
    /** Asked only for these transaction types — tenant type means nothing to a buyer. */
    transactionTypes?: TransactionType[];
}
/** Deliberately short: the one or two things that decide whether a property is even worth a call,
 * not everything the posting form can say about one. */
export declare const REQUIREMENT_ATTRIBUTE_QUESTIONS: Record<ListingCategory, RequirementAttributeQuestion[]>;
export type RequirementSizeQuestion = {
    kind: "bedrooms";
    label: string;
} | {
    kind: "area";
    label: string;
    units: AreaUnit[];
};
/** The size question, when a category has one: BHK for homes, a floor/land area range otherwise. */
export declare function sizeQuestionFor(category: ListingCategory): RequirementSizeQuestion | undefined;
export declare const REQUIREMENT_BEDROOM_OPTIONS: number[];
/** The amenities a category declares, as a must-haves question. Empty for categories with none. */
export declare function amenityOptionsFor(category: ListingCategory): FieldOption[];
/**
 * Checks attributes against a category and drops what doesn't apply.
 *
 * Two kinds of problem, treated differently: a key or value the category never declares is an
 * error (a client sending it is broken), while a question gated off by the transaction type is
 * silently dropped, because switching rent to buy legitimately strands a tenant-type answer.
 */
export declare function sanitizeRequirementAttributes(category: ListingCategory, transactionType: TransactionType | undefined, attributes: RequirementAttributes): {
    attributes: RequirementAttributes;
    errors: string[];
};
export interface BudgetPreset {
    label: string;
    min?: number;
    max?: number;
}
/** "₹25k", "₹1.5L", "₹2Cr" — compact, for chips and labels where "₹25 Thousand" is too long. */
export declare function formatCompactInr(amount: number): string;
/**
 * Preset budget bands for a category and transaction, and the unit they are in.
 *
 * A starting guess for Tier-1/2 cities, kept here so both apps get the same bands and they can be
 * tuned in one place. Without a category the unit is still right (rent is monthly, a sale is a
 * total), so the bands fall back to the home ones.
 */
export declare function budgetPresetsFor(category: ListingCategory | undefined, transactionType: TransactionType | undefined): {
    unit: string;
    presets: BudgetPreset[];
};
/** `days` from today becomes `moveInBy`; "just exploring" is the absence of one. */
export declare const REQUIREMENT_TIMELINE_OPTIONS: {
    value: string;
    label: string;
    days?: number;
}[];
export type RequirementStep = "city" | "areas" | "intent" | "category" | "details" | "budget" | "amenities" | "timeline";
/** The steps that make sense for these criteria, in the order they are asked. Where comes first
 * — city, then areas — because nothing else about a requirement is actionable without it: no
 * owner or agent can do anything with "a 2 BHK" and no place, and areas are what makes a row
 * lead-ready. The rest follow by value to matching. The city step only ever shows for a row saved
 * without one, since a capture can no longer be; the areas step appears once there is a city. */
export declare function applicableSteps(c: RequirementCriteria): RequirementStep[];
/**
 * The steps the search already answered — computed once, when the questions open, and skipped.
 * A step counts only when every question in it is answered: a search that named 2 BHK but not
 * furnishing still gets the details step, with 2 BHK already ticked.
 */
export declare function answeredSteps(c: RequirementCriteria): Set<RequirementStep>;
/** The steps a requirement is not complete without (see `missingForLead`). They have no Skip,
 * and are asked even when the search had answered them if the answer has since gone — a new city
 * empties the areas. */
export declare const REQUIRED_REQUIREMENT_STEPS: ReadonlySet<RequirementStep>;
/**
 * The steps to walk through, in order: every applicable step the search had not answered when the
 * questions opened, plus any required step that is unanswered now.
 */
export declare function stepsToAsk(draft: RequirementCriteria, answeredAtOpen: Set<RequirementStep>): RequirementStep[];
/** Whether a required step has what it needs to move on — other steps can always be skipped. */
export declare function canLeaveStep(step: RequirementStep, draft: RequirementCriteria): boolean;
export type RequirementGap = "city" | "area" | "transaction" | "propertyType" | "budget";
/** Short, for the label's "— … not specified" and the admin badge. */
export declare const REQUIREMENT_GAP_LABELS: Record<RequirementGap, string>;
/** For a sentence addressed to the seeker: "Needs {a} and {b} before owners and agents…". */
export declare const REQUIREMENT_GAP_PHRASES: Record<RequirementGap, string>;
/**
 * What a requirement still lacks before it is complete. Five things, and without any one of them
 * it is vague: the city; at least one area (at most `MAX_REQUIREMENT_AREAS`); what they want to do
 * (buy, rent, lease — PG, furniture and interiors each imply one); the property type (house,
 * apartment, plot… — PG, furniture and interiors are their own); and a budget (just one of
 * minPrice/maxPrice is enough — see `answeredSteps`'s identical test). Budget joined this list
 * 2026-10-08 (see docs/plans/requirement-refinement-questions.md): an owner or agent reviewing a
 * lead needs a number to judge whether their own listing is even in the right range, the same way
 * they need an area to judge whether it's in the right place. Size and the rest still make a
 * requirement better without being required. */
export declare function missingForLead(c: RequirementCriteria): RequirementGap[];
/**
 * Complete, and so specific enough to be a lead — see `missingForLead`. A city-wide requirement
 * is never one: sent to every agent in a 700 km² city it is spam to them and a flood of calls for
 * the seeker. See docs/plans/requirement-leads-for-brokers.md.
 */
export declare function isLeadReady(c: RequirementCriteria): boolean;
/** "a city, at least one area and the property type" — for the seeker-facing "needs …" lines. */
export declare function describeRequirementGaps(missing: RequirementGap[]): string;
/**
 * The one label format for a refined requirement — written by the BFF as `searchLabel` and
 * previewed by the review step, e.g. "2 or 3 BHK semi-furnished apartment for rent in Adyar or
 * Velachery, Chennai · ₹20k–35k/month · lift, power backup".
 *
 * Honest about gaps: a requirement that is not complete says so ("— area and property type not
 * specified"), so nobody reading it in the queue mistakes it for a precise need.
 */
export declare function formatRequirementLabel(c: RequirementCriteria, names: {
    cityName?: string;
    areaNames?: string[];
}): string;
export interface BrowseFiltersForRequirement {
    homeCategory?: HomeCategoryFilter;
    propertyType?: PropertyTypeFilter;
    category?: ListingCategory;
    transactionType?: TransactionType;
    cityId?: string;
    areaId?: string;
    areaIds?: string[];
    bedrooms?: number[];
    minPrice?: number;
    maxPrice?: number;
    furnished?: string;
    sharingType?: string;
    condition?: string;
    serviceType?: string;
    amenities?: string[];
}
/**
 * The requirement a browse page's filters describe.
 *
 * Browse queries speak the tab vocabulary (`homeCategory` + `propertyType`), not the listing one,
 * and only the raw SEO filters set `category`/`transactionType` — so reading just those two stored
 * "Rent 1 BHK Apartments in Chennai" with no category and no transaction type at all. Rent & Lease
 * becomes `rent`; the rent-or-lease question lets the seeker say otherwise.
 *
 * More areas than `MAX_REQUIREMENT_AREAS` are not a specific ask, so they are left for the areas
 * question rather than stored.
 */
export declare function requirementCriteriaFromBrowse(f: BrowseFiltersForRequirement): RequirementCriteria & {
    areaId?: string;
    bedrooms?: number;
};

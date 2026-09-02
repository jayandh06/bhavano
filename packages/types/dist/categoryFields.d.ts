import type { ListingCategory, TransactionType } from "./index";
export interface FieldOption {
    value: string;
    label: string;
}
/** Section a field is grouped under in the posting/editing UI — each renders as its own
 * accordion with a header from `SECTION_LABELS`. Order of display follows `SECTION_ORDER`,
 * not declaration order in a category's field list. */
export type FieldSection = "basics" | "pricing" | "preferences" | "furnishing" | "amenities" | "roomDetails" | "spaceDetails" | "workspaceDetails" | "itemDetails" | "serviceDetails" | "plotDetails";
export declare const SECTION_LABELS: Record<FieldSection, string>;
/** Fixed display order for sections — independent of the order fields are declared in a
 * category's array, so a field can be added anywhere without reshuffling its section's
 * position in the UI. */
export declare const SECTION_ORDER: FieldSection[];
export interface FieldDef {
    key: string;
    label: string;
    type: "text" | "number" | "select" | "multi-select";
    options?: FieldOption[];
    placeholder?: string;
    min?: number;
    /** A single emoji shown next to the label in both the posting form and the listing detail
     * page — set on amenity/furnishing fields, where a quick visual scan matters more than for a
     * plain count or select. Not required elsewhere. */
    /** Emoji. Still here because the app renders this field as text and has no SVG support —
     * see `iconName`, which the web app uses instead. */
    icon?: string;
    /** A key into the web app's outlined icon set. String, not a union: the icon set is a web
     * concern and this package must not depend on it. */
    iconName?: string;
    /** Caps a `number` field's input to this many digits — e.g. a bedroom/bathroom/appliance
     * count never needs more than 2 (max 99), unlike a currency amount or an area in sqft, which
     * are left unrestricted (`undefined`). Enforced by truncating keystrokes past the limit, not
     * just `<input max>`, since browsers don't stop someone typing a 3rd digit on their own. */
    maxDigits?: number;
    /** Render as a −/+ stepper rather than a bare number box. For small counts the buttons are
     * faster than a keyboard and they are visible on every device, unlike `<input type=number>`
     * spinners, which browsers show only on hover on desktop and not at all on a phone. */
    stepper?: boolean;
    /** Seeded into a new listing's attributes when its category is chosen. Only counts use this:
     * "how many bedrooms" starting at 0 is a real answer and lets the stepper work from a number,
     * whereas an empty price or area would be a guess presented as fact. */
    defaultValue?: string;
    transactionTypes?: TransactionType[];
    section?: FieldSection;
    /** Field is only shown once `attributes[dependsOn.key] === dependsOn.value` — e.g. a
     * broker-fee amount only makes sense once "brokerage fee applicable" is answered "yes".
     * Chains are supported (A gates B gates C); `pruneHiddenAttributes` below keeps a
     * hidden link's stale value from leaking into a still-visible descendant. */
    dependsOn?: {
        key: string;
        value: string;
    };
    /** Must be filled in before the listing can be posted/saved — enforced in both the
     * posting wizard/edit form (disables submit) and the BFF (`ListingsService`). */
    required?: boolean;
}
/** Single source of truth for whether a field should be shown, given the current transaction
 * type and in-progress attribute values — used by the posting wizard, the edit form, and the
 * listing detail page so all three agree on what's visible. */
export declare function fieldIsVisible(field: FieldDef, transactionType: TransactionType, attributes: Record<string, string | string[]>): boolean;
/** Groups an already-visibility-filtered field list into sections, ordered per
 * `SECTION_ORDER` (fields without a `section` land in a trailing "other" bucket). Generic so
 * it works over plain `FieldDef`s (the forms) or `{ section, ... }` display tuples (the
 * listing detail page). */
export declare function groupFieldsBySection<F extends {
    section?: FieldSection;
}>(fields: F[]): {
    section: FieldSection | "other";
    label: string;
    fields: F[];
}[];
/** Strips any attribute whose field is no longer visible (its `dependsOn` condition broke,
 * possibly several links back in a chain) — run after every attribute/transaction-type change
 * so a hidden field's stale value can't linger and reappear if a descendant field depends on
 * it. Iterates to a fixpoint since hiding one field can cascade to hide the next. */
export declare function pruneHiddenAttributes(category: ListingCategory, transactionType: TransactionType, attributes: Record<string, string | string[]>): Record<string, string | string[]>;
/** The attributes a freshly-chosen category starts with — the counts, at zero. Called instead
 * of resetting to an empty object so a stepper has a number to increment from and the form opens
 * with honest answers rather than blanks the poster has to fill in to say "none". */
export declare function defaultAttributesFor(category: ListingCategory): Record<string, string>;
/** One field-def list per category — the single source of truth for both the posting
 * wizard's dynamic step-3 form and the `attributes` JSONB column it maps onto. Adding a
 * future category means adding an entry here, not a new form/code path. */
export declare const CATEGORY_FIELD_CONFIG: Record<ListingCategory, FieldDef[]>;

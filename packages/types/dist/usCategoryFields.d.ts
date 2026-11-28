import type { ListingCategory } from "./index";
import type { FieldDef } from "./categoryFields";
/** A whole building of two or more homes: a duplex up to an apartment block, sold as one property. */
declare const MULTIFAMILY_FIELDS: FieldDef[];
export { MULTIFAMILY_FIELDS };
/** The US categories with a list of their own. Room for rent is a US-only category, so its one list serves. */
export declare const US_CATEGORY_FIELDS: Partial<Record<ListingCategory, FieldDef[]>>;

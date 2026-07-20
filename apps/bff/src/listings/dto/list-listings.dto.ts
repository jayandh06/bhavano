import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { HomeCategoryFilter, ListingCategory, PropertyTypeFilter, TransactionType } from '@bhavano/types';
import { CATEGORY_FIELD_CONFIG } from '@bhavano/types/categoryFields';

const HOME_CATEGORIES: HomeCategoryFilter[] = ['buy', 'rentLease', 'pg', 'furniture', 'interiors'];
const PROPERTY_TYPES: PropertyTypeFilter[] = ['house', 'apartment', 'storage', 'coworking', 'plot', 'commercial'];
const LISTING_CATEGORIES: ListingCategory[] = [
  'house',
  'apartment',
  'pg',
  'storage',
  'coworking',
  'furniture',
  'interiors',
  'plot',
  'commercial',
];
const TRANSACTION_TYPES: TransactionType[] = ['buy', 'sell', 'rent', 'lease'];
const FURNISHING_VALUES = ['unfurnished', 'semi', 'furnished'] as const;
const SORT_VALUES = ['newest', 'price_asc', 'price_desc', 'popular'] as const;

/** Reuses the same option lists the posting wizard validates against — one source of truth
 * for what values these filters (and CATEGORY_FIELD_CONFIG's selects) can ever take. */
const SHARING_TYPE_VALUES = CATEGORY_FIELD_CONFIG.pg.find((f) => f.key === 'sharingType')!.options!.map((o) => o.value);
const CONDITION_VALUES = CATEGORY_FIELD_CONFIG.furniture.find((f) => f.key === 'condition')!.options!.map((o) => o.value);
const SERVICE_TYPE_VALUES = CATEGORY_FIELD_CONFIG.interiors.find((f) => f.key === 'serviceType')!.options!.map((o) => o.value);

export class ListListingsDto {
  @IsOptional()
  @IsIn(HOME_CATEGORIES)
  homeCategory?: HomeCategoryFilter;

  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  propertyType?: PropertyTypeFilter;

  /** Raw exact-category filter — used only by the SEO browse-landing pages, bypasses
   * homeCategory/propertyType tab-grouping entirely. */
  @IsOptional()
  @IsIn(LISTING_CATEGORIES)
  category?: ListingCategory;

  /** Raw exact-transactionType filter — same SEO-browse-page-only usage as `category`. */
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  transactionType?: TransactionType;

  @IsOptional()
  @IsString()
  cityId?: string;

  /** Raw locality filter — used only by the SEO locality browse-landing pages. */
  @IsOptional()
  @IsString()
  areaId?: string;

  /** Multi-select area filter (the browse pages' "Areas" filter, when some-but-not-all of the
   * city's areas are checked) — wire format is a comma-separated list of area ids, matching how
   * this same query string round-trips through `fetchListings`/`ListingsQuery` on the web side. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsString({ each: true })
  areaIds?: string[];

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  /** Multi-select BHK filter (the browse pages' checkbox list) — wire format is a comma-separated
   * list of bucket numbers (5 = "5+"), same transform pattern as `areaIds`. Matched as an OR of
   * exact (1-4) / `gte` (5+) clauses in ListingsService — see `MAX_BEDROOMS`. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean).map(Number) : value))
  @IsInt({ each: true })
  @Min(1, { each: true })
  bedrooms?: number[];

  /** Matches `attributes.furnished` exactly — same values as the posting wizard's schema
   * (packages/types/src/categoryFields.ts). */
  @IsOptional()
  @IsIn(FURNISHING_VALUES)
  furnished?: (typeof FURNISHING_VALUES)[number];

  /** Matches `attributes.sharingType` exactly (PG mega-menu links). */
  @IsOptional()
  @IsIn(SHARING_TYPE_VALUES)
  sharingType?: string;

  /** Matches `attributes.condition` exactly (Furniture mega-menu links) — the JSONB
   * attribute, not the unused top-level `Listing.condition` column. */
  @IsOptional()
  @IsIn(CONDITION_VALUES)
  condition?: string;

  /** Matches `attributes.serviceType` exactly (Interiors mega-menu links). */
  @IsOptional()
  @IsIn(SERVICE_TYPE_VALUES)
  serviceType?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  /** Offset-based page window — used by the SEO browse pages and homepage for stable,
   * crawlable `?page=N` URLs (see docs/plans/seo-distinct-window-pagination.md). Mutually
   * exclusive with `cursor` in practice: `cursor` is for append-style infinite scroll (mobile),
   * `offset` is for numbered pagination where an arbitrary page must be directly addressable. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 24;

  /** Browse-page "Sort By" control — same 4 options for every category, all plain top-level
   * columns (see ListingsService's `ORDER_BY` lookup). Defaults to `newest` when absent. */
  @IsOptional()
  @IsIn(SORT_VALUES)
  sort?: (typeof SORT_VALUES)[number];
}

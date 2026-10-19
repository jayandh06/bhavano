/** Area overview content: the reviewed text shown below the listings on an area's landing page
 * (`/{city}/{area}`). Shared by the BFF (which stores and validates it), the admin app (which
 * edits and reviews it) and the web app (which renders it). See docs/plans/area-overview-pages.md. */
export type AreaOverviewStatus = "draft" | "in_review" | "published";
export interface AreaFaq {
    question: string;
    answer: string;
}
export interface AreaOverviewContent {
    /** Paragraphs under "About {area}". */
    about: string[];
    /** Paragraphs under "Getting around". */
    gettingAround: string[];
    faqs: AreaFaq[];
}
export interface AreaOverviewDto extends AreaOverviewContent {
    areaId: string;
    status: AreaOverviewStatus;
    reviewedByName: string | null;
    reviewedAt: string | null;
    publishedAt: string | null;
    updatedAt: string;
}
/** An area with a published overview, for the homepage's "Popular areas" links. */
export interface PublishedAreaOverviewLink {
    areaId: string;
    cityName: string;
    areaName: string;
    activeListings: number;
}
/** One row of the admin list: every area with listings, with its overview status if it has one. */
export interface AdminAreaOverviewRow {
    areaId: string;
    cityName: string;
    areaName: string;
    activeListings: number;
    status: AreaOverviewStatus | null;
    updatedAt: string | null;
    reviewedByName: string | null;
}
export interface AdminAreaOverviewsPage {
    items: AdminAreaOverviewRow[];
    /** Rows matching the filters (before paging). */
    total: number;
    /** Every city that has at least one row, for the city filter. Not narrowed by the other filters. */
    cities: string[];
}
export type AreaOverviewSortField = "city" | "area" | "listings" | "status" | "updated";
export declare const AREA_OVERVIEW_SORT_FIELDS: readonly AreaOverviewSortField[];
/** Outcome of one area in a bulk status change. */
export interface BulkAreaOverviewItemResult {
    areaId: string;
    ok: boolean;
    error?: string;
}
export interface BulkAreaOverviewResult {
    results: BulkAreaOverviewItemResult[];
}
export interface AdminAreaOverviewDetail {
    areaId: string;
    cityName: string;
    areaName: string;
    activeListings: number;
    overview: AreaOverviewDto | null;
}
/** What a reviewer confirms before an overview can be published. The admin page shows these as
 * tick boxes; publishing requires `checklistConfirmed: true`, which the page only sends when all
 * are ticked. The first one is also enforced by `validateAreaOverviewContent`. */
export declare const AREA_OVERVIEW_REVIEW_CHECKLIST: readonly ["Every fact is correct: where the area is, what it borders, how it is laid out, and the roads or metro named.", "Nothing will go out of date soon: no shop, school or project names, and no 'coming soon' claims.", "No prices, rents, percentages or investment advice, and no claims about safety or about who lives there.", "The wording is fair to every community and is not copied from another website.", "It says something specific to this area, and each FAQ answers a real question."];
/** Problems with the text that no reviewer should have to spot by eye. An empty array means the
 * content passes. The same rules run in the editor (live) and in the BFF (before saving). */
export declare function validateAreaOverviewContent(content: AreaOverviewContent): string[];
/** City overviews share the area overview's content, statuses, checklist and validator. */
export interface CityOverviewDto extends AreaOverviewContent {
    cityId: string;
    status: AreaOverviewStatus;
    reviewedByName: string | null;
    reviewedAt: string | null;
    publishedAt: string | null;
    updatedAt: string;
}
export interface AdminCityOverviewRow {
    cityId: string;
    cityName: string;
    activeListings: number;
    status: AreaOverviewStatus | null;
    updatedAt: string | null;
    reviewedByName: string | null;
}
export interface AdminCityOverviewsPage {
    items: AdminCityOverviewRow[];
    total: number;
}
export interface AdminCityOverviewDetail {
    cityId: string;
    cityName: string;
    activeListings: number;
    overview: CityOverviewDto | null;
}

/** Shared area-unit vocabulary — originally lived only in `apps/web/src/lib/calculatorFormulas.ts`
 * for the standalone `/tools/area-unit-converter` page. Promoted here so the BFF, web, and mobile
 * can all use the same units for a listing's own area field (Plot/Commercial's expanded unit
 * picker) and for "price per unit" — see docs/plans/plot-commercial-area-units-and-price-per-unit.md.
 * `apps/web/src/lib/calculatorFormulas.ts` re-exports from here so the converter page is unaffected. */
export type AreaUnit = "sqft" | "sqm" | "acre" | "hectare" | "cent";
export declare const AREA_UNIT_LABELS: Record<AreaUnit, string>;
export declare function areaUnitShortLabel(unit: AreaUnit, value: number): string;
/** `"1,200 sq ft"` / `"2.5 acres"` — value formatted with Indian grouping, no decimals beyond
 * what's actually present (an integer area doesn't grow a trailing ".00"). */
export declare function formatArea(value: number, unit: AreaUnit): string;
/** Canonical base is square metres (the one exact SI unit) — every other factor is derived from
 * it once, rather than hand-maintaining an N×N conversion table. */
export declare const AREA_UNIT_TO_SQM: Record<AreaUnit, number>;
export declare function convertArea(value: number, from: AreaUnit, to: AreaUnit): number;

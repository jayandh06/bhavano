/** Shared area-unit vocabulary — originally lived only in `apps/web/src/lib/calculatorFormulas.ts`
 * for the standalone `/tools/area-unit-converter` page. Promoted here so the BFF, web, and mobile
 * can all use the same units for a listing's own area field (Plot/Commercial's expanded unit
 * picker) and for "price per unit" — see docs/plans/plot-commercial-area-units-and-price-per-unit.md.
 * `apps/web/src/lib/calculatorFormulas.ts` re-exports from here so the converter page is unaffected. */
export type AreaUnit = "sqft" | "sqm" | "acre" | "hectare" | "cent";

export const AREA_UNIT_LABELS: Record<AreaUnit, string> = {
  sqft: "Square feet",
  sqm: "Square metres",
  acre: "Acre",
  hectare: "Hectare",
  cent: "Cent",
};

/** Short, pluralized label for inline display — "1200 sq ft", "2.5 acres", "₹5,000/cent" — as
 * opposed to `AREA_UNIT_LABELS`'s full name, meant for a dropdown/picker. */
const AREA_UNIT_SHORT_LABELS: Record<AreaUnit, { one: string; many: string }> = {
  sqft: { one: "sq ft", many: "sq ft" },
  sqm: { one: "sq m", many: "sq m" },
  acre: { one: "acre", many: "acres" },
  hectare: { one: "hectare", many: "hectares" },
  cent: { one: "cent", many: "cents" },
};

export function areaUnitShortLabel(unit: AreaUnit, value: number): string {
  const labels = AREA_UNIT_SHORT_LABELS[unit];
  return value === 1 ? labels.one : labels.many;
}

/** `"1,200 sq ft"` / `"2.5 acres"` — value formatted with Indian grouping, no decimals beyond
 * what's actually present (an integer area doesn't grow a trailing ".00"). */
export function formatArea(value: number, unit: AreaUnit): string {
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
  return `${formatted} ${areaUnitShortLabel(unit, value)}`;
}

/** Canonical base is square metres (the one exact SI unit) — every other factor is derived from
 * it once, rather than hand-maintaining an N×N conversion table. */
export const AREA_UNIT_TO_SQM: Record<AreaUnit, number> = {
  sqft: 0.09290304, // exact: (0.3048 m)^2
  sqm: 1,
  acre: 4046.8564224, // exact: 43,560 sqft
  hectare: 10000, // exact, by definition
  cent: 40.468564224, // exact: acre / 100
};

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  return (value * AREA_UNIT_TO_SQM[from]) / AREA_UNIT_TO_SQM[to];
}

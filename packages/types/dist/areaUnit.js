"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AREA_UNIT_TO_SQM = exports.AREA_UNIT_LABELS = void 0;
exports.areaUnitShortLabel = areaUnitShortLabel;
exports.formatArea = formatArea;
exports.convertArea = convertArea;
exports.AREA_UNIT_LABELS = {
    sqft: "Square feet",
    sqm: "Square metres",
    acre: "Acre",
    hectare: "Hectare",
    cent: "Cent",
};
/** Short, pluralized label for inline display — "1200 sq ft", "2.5 acres", "₹5,000/cent" — as
 * opposed to `AREA_UNIT_LABELS`'s full name, meant for a dropdown/picker. */
const AREA_UNIT_SHORT_LABELS = {
    sqft: { one: "sq ft", many: "sq ft" },
    sqm: { one: "sq m", many: "sq m" },
    acre: { one: "acre", many: "acres" },
    hectare: { one: "hectare", many: "hectares" },
    cent: { one: "cent", many: "cents" },
};
function areaUnitShortLabel(unit, value) {
    const labels = AREA_UNIT_SHORT_LABELS[unit];
    return value === 1 ? labels.one : labels.many;
}
/** `"1,200 sq ft"` / `"2.5 acres"` — value formatted with Indian grouping, no decimals beyond
 * what's actually present (an integer area doesn't grow a trailing ".00"). */
function formatArea(value, unit) {
    const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
    return `${formatted} ${areaUnitShortLabel(unit, value)}`;
}
/** Canonical base is square metres (the one exact SI unit) — every other factor is derived from
 * it once, rather than hand-maintaining an N×N conversion table. */
exports.AREA_UNIT_TO_SQM = {
    sqft: 0.09290304, // exact: (0.3048 m)^2
    sqm: 1,
    acre: 4046.8564224, // exact: 43,560 sqft
    hectare: 10000, // exact, by definition
    cent: 40.468564224, // exact: acre / 100
};
function convertArea(value, from, to) {
    return (value * exports.AREA_UNIT_TO_SQM[from]) / exports.AREA_UNIT_TO_SQM[to];
}

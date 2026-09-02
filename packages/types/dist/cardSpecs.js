"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveCardSpecs = deriveCardSpecs;
const categoryFields_1 = require("./categoryFields");
const PROPERTY = [
    { kind: "count", key: "bedrooms", one: "Bed", many: "Beds" },
    { kind: "count", key: "bathrooms", one: "Bath", many: "Baths" },
    { kind: "unit", key: "carpetAreaSqft", suffix: "sqft" },
];
const RECIPES = {
    house: PROPERTY,
    apartment: PROPERTY,
    villa: PROPERTY,
    pg: [
        { kind: "option", key: "sharingType" },
        { kind: "option", key: "gender" },
        { kind: "flag", key: "meals", when: ["yes"], label: "Meals included" },
    ],
    storage: [
        { kind: "unit", key: "sizeSqft", suffix: "sqft" },
        { kind: "option", key: "accessHours" },
    ],
    coworking: [{ kind: "option", key: "seatType" }],
    furniture: [
        { kind: "option", key: "material" },
        { kind: "option", key: "condition" },
    ],
    interiors: [{ kind: "option", key: "serviceType" }],
    plot: [
        { kind: "unit", key: "plotAreaSqft", suffix: "sqft" },
        { kind: "optionSuffix", key: "facing", suffix: "facing" },
    ],
    commercial: [
        { kind: "unit", key: "sqft", suffix: "sqft" },
        { kind: "option", key: "purpose" },
        { kind: "option", key: "furnished" },
    ],
};
/** Attributes arrive as JSON, so a number may be a number or the string a form submitted. */
function toNumber(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : undefined;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}
/** A select's human label, from the same config the form rendered it with — so the chip and the
 * detail page cannot disagree about what "double" is called. */
function optionLabel(category, key, value) {
    if (typeof value !== "string" || value === "")
        return undefined;
    const field = categoryFields_1.CATEGORY_FIELD_CONFIG[category]?.find((f) => f.key === key);
    return field?.options?.find((o) => o.value === value)?.label;
}
/**
 * Card chips for a listing, in recipe order, skipping anything the seller left blank.
 *
 * Returns an empty array when nothing is derivable — a category with no recipe, or a listing
 * posted before its attributes were collected. Callers fall back to the stored `specs` column,
 * which is what the ~17 listings that predate this still render.
 */
function deriveCardSpecs(category, attributes) {
    if (!attributes)
        return [];
    const chips = [];
    for (const chip of RECIPES[category] ?? []) {
        const raw = attributes[chip.key];
        if (raw === undefined || raw === null || raw === "")
            continue;
        if (chip.kind === "count") {
            const n = toNumber(raw);
            if (n === undefined || n <= 0)
                continue;
            chips.push(`${n} ${n === 1 ? chip.one : chip.many}`);
        }
        else if (chip.kind === "unit") {
            const n = toNumber(raw);
            if (n === undefined || n <= 0)
                continue;
            chips.push(`${n.toLocaleString("en-IN")} ${chip.suffix}`);
        }
        else if (chip.kind === "flag") {
            if (typeof raw === "string" && chip.when.includes(raw))
                chips.push(chip.label);
        }
        else {
            const label = optionLabel(category, chip.key, raw);
            if (!label)
                continue;
            chips.push(chip.kind === "optionSuffix" ? `${label} ${chip.suffix}` : label);
        }
    }
    return chips;
}

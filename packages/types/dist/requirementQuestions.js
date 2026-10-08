"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIREMENT_GAP_PHRASES = exports.REQUIREMENT_GAP_LABELS = exports.REQUIRED_REQUIREMENT_STEPS = exports.REQUIREMENT_TIMELINE_OPTIONS = exports.REQUIREMENT_BEDROOM_OPTIONS = exports.REQUIREMENT_ATTRIBUTE_QUESTIONS = exports.INTENT_TRANSACTION_CHOICES = exports.REQUIREMENT_CATEGORY_LABELS = exports.INTENT_CATEGORIES = exports.REQUIREMENT_INTENTS = exports.MAX_REQUIREMENT_AREAS = void 0;
exports.intentOf = intentOf;
exports.applyIntent = applyIntent;
exports.isValidRequirementTransaction = isValidRequirementTransaction;
exports.sizeQuestionFor = sizeQuestionFor;
exports.amenityOptionsFor = amenityOptionsFor;
exports.sanitizeRequirementAttributes = sanitizeRequirementAttributes;
exports.formatCompactInr = formatCompactInr;
exports.budgetPresetsFor = budgetPresetsFor;
exports.applicableSteps = applicableSteps;
exports.answeredSteps = answeredSteps;
exports.stepsToAsk = stepsToAsk;
exports.canLeaveStep = canLeaveStep;
exports.missingForLead = missingForLead;
exports.isLeadReady = isLeadReady;
exports.describeRequirementGaps = describeRequirementGaps;
exports.formatRequirementLabel = formatRequirementLabel;
exports.requirementCriteriaFromBrowse = requirementCriteriaFromBrowse;
const categoryFields_1 = require("./categoryFields");
const postingRules_1 = require("./postingRules");
const bedrooms_1 = require("./bedrooms");
const areaUnit_1 = require("./areaUnit");
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
exports.MAX_REQUIREMENT_AREAS = 5;
exports.REQUIREMENT_INTENTS = [
    { value: "buy", label: "Buy" },
    { value: "rentLease", label: "Rent & Lease" },
    { value: "pg", label: "PG" },
    { value: "furniture", label: "Furniture" },
    { value: "interiors", label: "Interiors" },
];
/** Which categories each intent offers — the same lists as the home tabs' property-type facet. */
exports.INTENT_CATEGORIES = {
    buy: ["house", "apartment", "villa", "plot", "commercial"],
    rentLease: ["house", "apartment", "villa", "commercial", "storage", "coworking"],
    pg: ["pg"],
    furniture: ["furniture"],
    interiors: ["interiors"],
};
exports.REQUIREMENT_CATEGORY_LABELS = {
    house: "House",
    apartment: "Apartment",
    villa: "Villa",
    pg: "PG",
    storage: "Storage",
    coworking: "Coworking",
    furniture: "Furniture",
    interiors: "Interiors",
    plot: "Plot",
    commercial: "Commercial",
};
/** The follow-up for the two intents that span two transaction types. Rent vs lease matters more
 * than it looks: a lease is a lump sum, so the budget question is a different question. */
exports.INTENT_TRANSACTION_CHOICES = {
    rentLease: [
        { value: "rent", label: "Rent (monthly)" },
        { value: "lease", label: "Lease (lump sum)" },
    ],
    furniture: [
        { value: "sell", label: "Buy" },
        { value: "rent", label: "Rent" },
    ],
};
/** Reads the intent back out of stored criteria. `buy` and `sell` both mean the seeker is buying:
 * listings say `sell`, and some older captures said `buy`. */
function intentOf(category, transactionType) {
    if (category === "pg" || category === "furniture" || category === "interiors")
        return category;
    if (transactionType === "buy" || transactionType === "sell")
        return "buy";
    if (transactionType === "rent" || transactionType === "lease")
        return "rentLease";
    return undefined;
}
/** The criteria after choosing an intent: the transaction type that intent implies, and the
 * category kept only where the new intent still offers it. */
function applyIntent(intent, current) {
    const keepCategory = current.category && exports.INTENT_CATEGORIES[intent].includes(current.category) ? current.category : undefined;
    switch (intent) {
        case "buy":
            return { category: keepCategory, transactionType: "sell" };
        case "rentLease":
            return { category: keepCategory, transactionType: current.transactionType === "lease" ? "lease" : "rent" };
        case "pg":
            return { category: "pg", transactionType: "rent" };
        case "furniture":
            return { category: "furniture", transactionType: current.transactionType === "rent" ? "rent" : "sell" };
        case "interiors":
            return { category: "interiors", transactionType: "sell" };
    }
}
/** Whether a category can be had on this transaction at all — the posting rules, with `buy`
 * read as `sell`. */
function isValidRequirementTransaction(category, transactionType) {
    const asListing = transactionType === "buy" ? "sell" : transactionType;
    return postingRules_1.POSTABLE_TRANSACTION_TYPES[category].includes(asListing);
}
function optionsOf(category, key) {
    const field = categoryFields_1.CATEGORY_FIELD_CONFIG[category].find((f) => f.key === key);
    if (!field?.options)
        throw new Error(`categoryFields has no options for ${category}.${key}`);
    return field.options;
}
function question(category, key, label, multi, extra = {}) {
    return { key, label, multi, options: optionsOf(category, key), ...extra };
}
function residentialQuestions(category) {
    return [
        question(category, "furnished", "Furnishing", true),
        question(category, "preferredTenantTypes", "Who's moving in?", false, { transactionTypes: ["rent", "lease"] }),
    ];
}
/** Deliberately short: the one or two things that decide whether a property is even worth a call,
 * not everything the posting form can say about one. */
exports.REQUIREMENT_ATTRIBUTE_QUESTIONS = {
    house: residentialQuestions("house"),
    apartment: residentialQuestions("apartment"),
    villa: residentialQuestions("villa"),
    pg: [
        question("pg", "sharingType", "Sharing", true),
        question("pg", "gender", "For", false),
        question("pg", "meals", "Meals included?", false),
    ],
    storage: [question("storage", "accessHours", "Access needed", false)],
    coworking: [question("coworking", "seatType", "Seat type", true)],
    furniture: [question("furniture", "condition", "New or used?", false), question("furniture", "material", "Material", true)],
    interiors: [question("interiors", "serviceType", "What work do you need?", true)],
    plot: [question("plot", "facing", "Preferred facing", true)],
    commercial: [question("commercial", "purpose", "What is it for?", true), question("commercial", "furnished", "Furnishing", true)],
};
/** The size question, when a category has one: BHK for homes, a floor/land area range otherwise. */
function sizeQuestionFor(category) {
    switch (category) {
        case "house":
        case "apartment":
        case "villa":
            return { kind: "bedrooms", label: "How many bedrooms?" };
        case "plot":
            return { kind: "area", label: "Plot size", units: ["sqft", "cent", "acre", "hectare", "sqm"] };
        case "commercial":
            return { kind: "area", label: "Floor area", units: ["sqft", "sqm", "acre", "cent"] };
        case "storage":
            return { kind: "area", label: "Space needed", units: ["sqft"] };
        default:
            return undefined;
    }
}
exports.REQUIREMENT_BEDROOM_OPTIONS = Array.from({ length: bedrooms_1.MAX_BEDROOMS }, (_, i) => i + 1);
/** The amenities a category declares, as a must-haves question. Empty for categories with none. */
function amenityOptionsFor(category) {
    return (0, categoryFields_1.amenityFieldsFor)(category).map((field) => ({ value: field.key, label: field.label }));
}
/**
 * Checks attributes against a category and drops what doesn't apply.
 *
 * Two kinds of problem, treated differently: a key or value the category never declares is an
 * error (a client sending it is broken), while a question gated off by the transaction type is
 * silently dropped, because switching rent to buy legitimately strands a tenant-type answer.
 */
function sanitizeRequirementAttributes(category, transactionType, attributes) {
    const out = {};
    const errors = [];
    const questions = new Map(exports.REQUIREMENT_ATTRIBUTE_QUESTIONS[category].map((q) => [q.key, q]));
    const amenityKeys = new Set(amenityOptionsFor(category).map((o) => o.value));
    for (const [key, raw] of Object.entries(attributes)) {
        if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string")) {
            errors.push(`${key} must be a list of strings`);
            continue;
        }
        const values = [...new Set(raw)];
        if (values.length === 0)
            continue;
        if (key === "amenities") {
            const unknown = values.filter((v) => !amenityKeys.has(v));
            if (unknown.length > 0)
                errors.push(`${category} has no amenity ${unknown.join(", ")}`);
            else
                out.amenities = values;
            continue;
        }
        const q = questions.get(key);
        if (!q) {
            errors.push(`${category} has no requirement question ${key}`);
            continue;
        }
        if (q.transactionTypes && (!transactionType || !q.transactionTypes.includes(transactionType)))
            continue;
        const allowed = new Set(q.options.map((o) => o.value));
        const unknown = values.filter((v) => !allowed.has(v));
        if (unknown.length > 0) {
            errors.push(`${key} has no option ${unknown.join(", ")}`);
            continue;
        }
        if (!q.multi && values.length > 1) {
            errors.push(`${key} takes one answer`);
            continue;
        }
        out[key] = values;
    }
    return { attributes: out, errors };
}
/** "₹25k", "₹1.5L", "₹2Cr" — compact, for chips and labels where "₹25 Thousand" is too long. */
function formatCompactInr(amount) {
    const trim = (n) => String(Math.floor(n * 100 + 1e-9) / 100);
    if (amount >= 10_000_000)
        return `₹${trim(amount / 10_000_000)}Cr`;
    if (amount >= 100_000)
        return `₹${trim(amount / 100_000)}L`;
    if (amount >= 1_000)
        return `₹${trim(amount / 1_000)}k`;
    return `₹${Math.round(amount)}`;
}
function presets(bounds) {
    const out = [{ label: `Under ${formatCompactInr(bounds[0])}`, max: bounds[0] }];
    for (let i = 0; i < bounds.length - 1; i++) {
        out.push({
            label: `${formatCompactInr(bounds[i])}–${formatCompactInr(bounds[i + 1]).slice(1)}`,
            min: bounds[i],
            max: bounds[i + 1],
        });
    }
    out.push({ label: `${formatCompactInr(bounds[bounds.length - 1])}+`, min: bounds[bounds.length - 1] });
    return out;
}
const HOME_SALE = [3_000_000, 6_000_000, 10_000_000, 20_000_000, 50_000_000];
const HOME_RENT = [10_000, 20_000, 35_000, 60_000, 100_000];
const HOME_LEASE = [500_000, 1_000_000, 2_000_000];
/**
 * Preset budget bands for a category and transaction, and the unit they are in.
 *
 * A starting guess for Tier-1/2 cities, kept here so both apps get the same bands and they can be
 * tuned in one place. Without a category the unit is still right (rent is monthly, a sale is a
 * total), so the bands fall back to the home ones.
 */
function budgetPresetsFor(category, transactionType) {
    const buying = transactionType === "buy" || transactionType === "sell";
    switch (category) {
        case "pg":
            return { unit: "per bed, per month", presets: presets([6_000, 10_000, 15_000]) };
        case "coworking":
            return { unit: "per seat, per month", presets: presets([5_000, 10_000]) };
        case "storage":
            return { unit: "per month", presets: presets([5_000, 10_000]) };
        case "furniture":
            return { unit: transactionType === "rent" ? "per month" : "total", presets: presets([10_000, 25_000, 50_000]) };
        case "interiors":
            return { unit: "for the whole job", presets: presets([200_000, 500_000, 1_000_000]) };
        case "plot":
            return { unit: "total price", presets: presets([2_000_000, 5_000_000, 10_000_000, 30_000_000]) };
        case "commercial":
            if (buying)
                return { unit: "total price", presets: presets(HOME_SALE) };
            if (transactionType === "lease")
                return { unit: "lease amount", presets: presets(HOME_LEASE) };
            return { unit: "per month", presets: presets([25_000, 75_000, 200_000]) };
        default:
            if (buying)
                return { unit: "total price", presets: presets(HOME_SALE) };
            if (transactionType === "lease")
                return { unit: "lease amount", presets: presets(HOME_LEASE) };
            return { unit: "per month", presets: presets(HOME_RENT) };
    }
}
// ---------------------------------------------------------------------------
// Step 7 — timeline
// ---------------------------------------------------------------------------
/** `days` from today becomes `moveInBy`; "just exploring" is the absence of one. */
exports.REQUIREMENT_TIMELINE_OPTIONS = [
    { value: "now", label: "Immediately", days: 7 },
    { value: "month", label: "Within a month", days: 30 },
    { value: "quarter", label: "In 1–3 months", days: 90 },
    { value: "exploring", label: "Just exploring" },
];
/** The steps that make sense for these criteria, in the order they are asked. Where comes first
 * — city, then areas — because nothing else about a requirement is actionable without it: no
 * owner or agent can do anything with "a 2 BHK" and no place, and areas are what makes a row
 * lead-ready. The rest follow by value to matching. The city step only ever shows for a row saved
 * without one, since a capture can no longer be; the areas step appears once there is a city. */
function applicableSteps(c) {
    const intent = intentOf(c.category, c.transactionType);
    const steps = ["city"];
    if (c.cityId)
        steps.push("areas");
    steps.push("intent");
    if (intent === "buy" || intent === "rentLease")
        steps.push("category");
    if (c.category && (exports.REQUIREMENT_ATTRIBUTE_QUESTIONS[c.category].length > 0 || sizeQuestionFor(c.category))) {
        steps.push("details");
    }
    steps.push("budget");
    if (c.category && amenityOptionsFor(c.category).length > 0)
        steps.push("amenities");
    steps.push("timeline");
    return steps;
}
function detailsAnswered(c) {
    if (!c.category)
        return false;
    const size = sizeQuestionFor(c.category);
    if (size?.kind === "bedrooms" && !c.bedroomOptions?.length)
        return false;
    if (size?.kind === "area" && c.minAreaSqft === undefined && c.maxAreaSqft === undefined)
        return false;
    return exports.REQUIREMENT_ATTRIBUTE_QUESTIONS[c.category]
        .filter((q) => !q.transactionTypes || (c.transactionType && q.transactionTypes.includes(c.transactionType)))
        .every((q) => (c.attributes?.[q.key]?.length ?? 0) > 0);
}
/**
 * The steps the search already answered — computed once, when the questions open, and skipped.
 * A step counts only when every question in it is answered: a search that named 2 BHK but not
 * furnishing still gets the details step, with 2 BHK already ticked.
 */
function answeredSteps(c) {
    const done = new Set();
    if (c.cityId)
        done.add("city");
    if (intentOf(c.category, c.transactionType))
        done.add("intent");
    if (c.category)
        done.add("category");
    if (detailsAnswered(c))
        done.add("details");
    if ((c.areaIds?.length ?? 0) > 0)
        done.add("areas");
    if (c.minPrice !== undefined || c.maxPrice !== undefined)
        done.add("budget");
    if ((c.attributes?.amenities?.length ?? 0) > 0)
        done.add("amenities");
    if (c.moveInBy)
        done.add("timeline");
    return done;
}
/** The steps a requirement is not complete without (see `missingForLead`). They have no Skip,
 * and are asked even when the search had answered them if the answer has since gone — a new city
 * empties the areas. */
exports.REQUIRED_REQUIREMENT_STEPS = new Set([
    "city",
    "areas",
    "intent",
    "category",
    "budget",
]);
/**
 * The steps to walk through, in order: every applicable step the search had not answered when the
 * questions opened, plus any required step that is unanswered now.
 */
function stepsToAsk(draft, answeredAtOpen) {
    const answeredNow = answeredSteps(draft);
    return applicableSteps(draft).filter((step) => !answeredAtOpen.has(step) || (exports.REQUIRED_REQUIREMENT_STEPS.has(step) && !answeredNow.has(step)));
}
/** Whether a required step has what it needs to move on — other steps can always be skipped. */
function canLeaveStep(step, draft) {
    return !exports.REQUIRED_REQUIREMENT_STEPS.has(step) || answeredSteps(draft).has(step);
}
/** Short, for the label's "— … not specified" and the admin badge. */
exports.REQUIREMENT_GAP_LABELS = {
    city: "city",
    area: "area",
    transaction: "buy or rent",
    propertyType: "property type",
    budget: "budget",
};
/** For a sentence addressed to the seeker: "Needs {a} and {b} before owners and agents…". */
exports.REQUIREMENT_GAP_PHRASES = {
    city: "a city",
    area: "at least one area",
    transaction: "whether you're buying or renting",
    propertyType: "the property type",
    budget: "a budget",
};
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
function missingForLead(c) {
    const missing = [];
    if (!c.cityId)
        missing.push("city");
    if (!c.areaIds?.length)
        missing.push("area");
    if (!c.transactionType)
        missing.push("transaction");
    if (!c.category)
        missing.push("propertyType");
    if (c.minPrice === undefined && c.maxPrice === undefined)
        missing.push("budget");
    return missing;
}
/**
 * Complete, and so specific enough to be a lead — see `missingForLead`. A city-wide requirement
 * is never one: sent to every agent in a 700 km² city it is spam to them and a flood of calls for
 * the seeker. See docs/plans/requirement-leads-for-brokers.md.
 */
function isLeadReady(c) {
    return missingForLead(c).length === 0;
}
function joinAnd(items) {
    if (items.length <= 1)
        return items.join("");
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
/** "a city, at least one area and the property type" — for the seeker-facing "needs …" lines. */
function describeRequirementGaps(missing) {
    return joinAnd(missing.map((gap) => exports.REQUIREMENT_GAP_PHRASES[gap]));
}
function joinOr(items) {
    if (items.length <= 1)
        return items.join("");
    return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
function optionLabel(category, key, value) {
    const q = exports.REQUIREMENT_ATTRIBUTE_QUESTIONS[category].find((x) => x.key === key);
    return q?.options.find((o) => o.value === value)?.label ?? value;
}
function transactionPhrase(transactionType) {
    if (transactionType === "buy" || transactionType === "sell")
        return "to buy";
    if (transactionType === "rent")
        return "for rent";
    if (transactionType === "lease")
        return "on lease";
    return "";
}
function budgetPhrase(c) {
    if (c.minPrice === undefined && c.maxPrice === undefined)
        return undefined;
    const range = c.minPrice !== undefined && c.maxPrice !== undefined
        ? `${formatCompactInr(c.minPrice)}–${formatCompactInr(c.maxPrice).slice(1)}`
        : c.maxPrice !== undefined
            ? `up to ${formatCompactInr(c.maxPrice)}`
            : `${formatCompactInr(c.minPrice)}+`;
    const monthly = c.transactionType === "rent" || c.category === "pg";
    return monthly ? `${range}/month` : c.transactionType === "lease" ? `${range} lease` : range;
}
function sizePhrase(c) {
    if (c.minAreaSqft === undefined && c.maxAreaSqft === undefined)
        return undefined;
    const unit = c.areaUnit ?? "sqft";
    const show = (sqft) => (0, areaUnit_1.formatArea)(Math.round((0, areaUnit_1.convertArea)(sqft, "sqft", unit) * 100) / 100, unit);
    if (c.minAreaSqft !== undefined && c.maxAreaSqft !== undefined)
        return `${show(c.minAreaSqft)} – ${show(c.maxAreaSqft)}`;
    return c.maxAreaSqft !== undefined ? `up to ${show(c.maxAreaSqft)}` : `from ${show(c.minAreaSqft)}`;
}
function subjectPhrase(c) {
    const txn = transactionPhrase(c.transactionType);
    const attr = (key) => (c.category ? (c.attributes?.[key] ?? []).map((v) => optionLabel(c.category, key, v)) : []);
    switch (c.category) {
        case undefined:
            return ["Property", txn].filter(Boolean).join(" ");
        case "pg": {
            const sharing = attr("sharingType").map((s) => s.toLowerCase());
            const gender = attr("gender")[0]?.toLowerCase();
            return ["PG", sharing.length ? joinOr(sharing) : "", gender ? `for ${gender}` : ""].filter(Boolean).join(", ");
        }
        case "furniture": {
            const condition = attr("condition")[0]?.toLowerCase();
            return [condition ? `${condition[0].toUpperCase()}${condition.slice(1)} furniture` : "Furniture", txn].filter(Boolean).join(" ");
        }
        case "interiors": {
            const work = attr("serviceType");
            return work.length ? `${joinOr(work)} interiors` : "Interiors work";
        }
        default: {
            const bhk = c.bedroomOptions?.length
                ? `${joinOr([...c.bedroomOptions].sort((a, b) => a - b).map(bedrooms_1.bedroomLabel))} BHK`
                : "";
            const furnished = joinOr(attr("furnished").map((f) => f.toLowerCase()));
            const noun = c.category === "commercial"
                ? "commercial space"
                : c.category === "storage"
                    ? "storage space"
                    : c.category === "coworking"
                        ? "coworking seat"
                        : c.category;
            const head = [bhk, furnished, noun, txn].filter(Boolean).join(" ");
            return `${head[0].toUpperCase()}${head.slice(1)}`;
        }
    }
}
/**
 * The one label format for a refined requirement — written by the BFF as `searchLabel` and
 * previewed by the review step, e.g. "2 or 3 BHK semi-furnished apartment for rent in Adyar or
 * Velachery, Chennai · ₹20k–35k/month · lift, power backup".
 *
 * Honest about gaps: a requirement that is not complete says so ("— area and property type not
 * specified"), so nobody reading it in the queue mistakes it for a precise need.
 */
function formatRequirementLabel(c, names) {
    const where = names.areaNames?.length
        ? ` in ${joinOr(names.areaNames)}${names.cityName ? `, ${names.cityName}` : ""}`
        : names.cityName
            ? ` in ${names.cityName}`
            : "";
    const extras = [
        budgetPhrase(c),
        sizePhrase(c),
        c.category && c.attributes?.amenities?.length
            ? c.attributes.amenities.map((a) => amenityOptionsFor(c.category).find((o) => o.value === a)?.label.toLowerCase() ?? a).join(", ")
            : undefined,
    ].filter(Boolean);
    const missing = missingForLead(c);
    const gap = missing.length ? ` — ${joinAnd(missing.map((m) => exports.REQUIREMENT_GAP_LABELS[m]))} not specified` : "";
    const label = `${subjectPhrase(c)}${where}${extras.length ? ` · ${extras.join(" · ")}` : ""}${gap}`;
    return label.length > 200 ? `${label.slice(0, 199)}…` : label;
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
function requirementCriteriaFromBrowse(f) {
    const category = f.category ??
        f.propertyType ??
        (f.homeCategory === "pg" || f.homeCategory === "furniture" || f.homeCategory === "interiors" ? f.homeCategory : undefined);
    const transactionType = f.transactionType ??
        (f.homeCategory === "buy" || f.homeCategory === "interiors"
            ? "sell"
            : f.homeCategory === "rentLease" || f.homeCategory === "pg"
                ? "rent"
                : undefined);
    const areas = f.areaIds?.length ? f.areaIds : f.areaId ? [f.areaId] : [];
    const areaIds = areas.length <= exports.MAX_REQUIREMENT_AREAS ? areas : [];
    // Kept while the category is still unknown ("2 BHK" on the Rent tab with no property type): the
    // property-type question comes first, and refining to a category without bedrooms clears it.
    const bedroomOptions = !category || sizeQuestionFor(category)?.kind === "bedrooms" ? [...new Set(f.bedrooms ?? [])].sort((a, b) => a - b) : [];
    const raw = {};
    if (f.furnished)
        raw.furnished = [f.furnished];
    if (f.sharingType)
        raw.sharingType = [f.sharingType];
    if (f.condition)
        raw.condition = [f.condition];
    if (f.serviceType)
        raw.serviceType = [f.serviceType];
    if (f.amenities?.length)
        raw.amenities = f.amenities;
    const attributes = category ? sanitizeRequirementAttributes(category, transactionType, raw).attributes : {};
    return {
        category,
        transactionType,
        cityId: f.cityId,
        areaId: f.areaId,
        areaIds,
        bedroomOptions,
        bedrooms: bedroomOptions.length ? Math.min(...bedroomOptions) : undefined,
        minPrice: f.minPrice,
        maxPrice: f.maxPrice,
        attributes: Object.keys(attributes).length ? attributes : undefined,
    };
}

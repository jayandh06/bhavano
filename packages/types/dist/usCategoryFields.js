"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.US_CATEGORY_FIELDS = void 0;
/**
 * What a US listing is asked, per category (docs/plans/us-listing-model.md, phase 2). A list of the US's own, not India's
 * with fields hidden. Read it through `categoryFieldsFor(category, "us")`.
 *
 * A key is kept wherever the US means the same thing India does (`bedrooms`, `carpetAreaSqft`, `furnished`,
 * `societyName`, `lift`...), so listing cards, filters, saved searches and buyers' requests keep reading one value.
 * Only types are imported from categoryFields, which imports this file.
 */
const option = (value, label) => ({ value, label });
const YES_NO = [option("yes", "Yes"), option("no", "No")];
function yesNo(key, label, section, transactionTypes) {
    return { key, label, type: "select", section, options: YES_NO, ...(transactionTypes ? { transactionTypes } : {}) };
}
function dollars(key, label, transactionTypes) {
    return { key, label, type: "number", min: 0, maxDigits: 7, rupees: true, section: "pricing", transactionTypes };
}
function amenity(key, label, icon) {
    return { key, label, icon, iconName: key, type: "select", section: "amenities", options: YES_NO };
}
function floorLabel(n) {
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
    return `${n}${suffix}`;
}
/** The same stored values as India's floor list, so an answer reads the same wherever it came from. */
const FLOOR_OPTIONS = [
    option("basement", "Basement"),
    option("ground", "Ground"),
    ...Array.from({ length: 50 }, (_, i) => option(String(i + 1), floorLabel(i + 1))),
    option("top", "Top floor"),
];
const AVAILABLE_FROM = [
    option("immediately", "Immediately"),
    option("within-15-days", "Within 15 days"),
    option("within-30-days", "Within 30 days"),
    option("after-30-days", "After 30 days"),
];
const HOME_LEASE_TERMS = [
    option("month-to-month", "Month to month"),
    option("6", "6 months"),
    option("12", "12 months"),
    option("24", "24 months or more"),
    option("flexible", "Flexible"),
];
const COMMERCIAL_LEASE_TERMS = [
    option("month-to-month", "Month to month"),
    option("12", "1 year"),
    option("24", "2 years"),
    option("36", "3 years"),
    option("60", "5 years or more"),
];
/** Assistance animals are not pets under the Fair Housing Act, so "no pets" must not read as refusing them. */
const PET_POLICY = [
    option("cats", "Cats allowed"),
    option("dogs", "Dogs allowed"),
    option("none", "No pets (assistance animals are welcome)"),
];
const FURNISHING = [
    option("unfurnished", "Unfurnished"),
    option("semi", "Partially furnished"),
    option("furnished", "Furnished"),
];
function availability(section, transactionTypes, leaseTerms) {
    return [
        { key: "availableFrom", label: "Available from", type: "select", section, transactionTypes, options: AVAILABLE_FROM },
        { key: "leaseTerm", label: "Lease term", type: "select", section, transactionTypes, options: leaseTerms },
    ];
}
const yearBuilt = (section) => ({
    key: "yearBuilt",
    label: "Year built",
    type: "number",
    min: 1700,
    max: 2100,
    maxDigits: 4,
    section,
    placeholder: "e.g. 1998",
});
const fromBroker = {
    key: "fromBroker",
    label: "Posted by Broker / Agent",
    type: "select",
    section: "pricing",
    required: true,
    options: YES_NO,
};
function count(key, label, section, required = false) {
    return { key, label, type: "number", min: 0, maxDigits: 2, stepper: true, defaultValue: "0", section, ...(required ? { required } : {}) };
}
/** A home. `lot` for one that stands on its own land (house, townhouse); `floor` for one inside a building. */
function homeFields({ lot, floor }) {
    return [
        { ...count("bedrooms", "Bedrooms", "basics", true), min: undefined },
        { ...count("bathrooms", "Full bathrooms", "basics", true), min: undefined },
        count("halfBathrooms", "Half bathrooms", "basics"),
        { key: "carpetAreaSqft", label: "Square feet", type: "number", min: 1, maxDigits: 6, required: true, section: "basics" },
        ...(lot
            ? [{ key: "lotSizeAcres", label: "Lot size (acres)", type: "number", decimal: true, min: 0.01, unit: "acres", section: "basics" }]
            : []),
        yearBuilt("basics"),
        ...(floor ? [{ key: "floor", label: "Floor", type: "select", section: "basics", options: FLOOR_OPTIONS }] : []),
        {
            key: "parkingType",
            label: "Parking",
            type: "select",
            section: "basics",
            options: [option("garage", "Garage"), option("driveway", "Driveway"), option("street", "Street"), option("none", "None")],
        },
        { key: "parkingSpaces", label: "Parking spaces", type: "number", min: 0, maxDigits: 2, section: "basics" },
        { key: "furnished", label: "Furnishing", type: "select", section: "basics", options: FURNISHING },
        {
            key: "laundry",
            label: "Laundry",
            type: "select",
            section: "basics",
            options: [option("in-unit", "In unit"), option("on-site", "On site"), option("none", "None")],
        },
        {
            key: "heating",
            label: "Heating",
            type: "select",
            section: "basics",
            options: [option("central", "Central"), option("heat-pump", "Heat pump"), option("other", "Other"), option("none", "None")],
        },
        {
            key: "cooling",
            label: "Cooling",
            type: "select",
            section: "basics",
            options: [option("central", "Central air"), option("window", "Window units"), option("other", "Other"), option("none", "None")],
        },
        yesNo("utilitiesIncluded", "Utilities included", "basics", ["rent"]),
        { key: "societyName", label: "Community / building name", type: "text", compact: true, section: "basics", placeholder: "e.g. The Domain" },
        yesNo("gatedCommunity", "Gated community", "basics"),
        ...availability("basics", ["rent"], HOME_LEASE_TERMS),
        { key: "petPolicy", label: "Pets", type: "multi-select", section: "basics", transactionTypes: ["rent"], options: PET_POLICY },
        yesNo("newConstruction", "New construction", "basics", ["sell"]),
        yesNo("priceNegotiable", "Price negotiable", "pricing", ["rent"]),
        dollars("securityDeposit", "Security deposit ($)", ["rent"]),
        dollars("applicationFee", "Application fee ($)", ["rent"]),
        dollars("hoaFee", "Monthly HOA fee ($)", ["sell"]),
        dollars("propertyTaxYearly", "Yearly property tax ($)", ["sell"]),
        fromBroker,
        amenity("cctv", "Security cameras", "📹"),
        amenity("lift", "Elevator", "🛗"),
        amenity("gym", "Fitness center", "🏋️"),
        amenity("swimmingPool", "Pool", "🏊"),
        amenity("clubHouse", "Clubhouse", "🏛️"),
        amenity("playArea", "Playground", "🎠"),
    ];
}
const STORAGE_FIELDS = [
    { key: "sizeSqft", label: "Size (sqft)", type: "number", required: true, section: "spaceDetails" },
    {
        key: "storageType",
        label: "Storage type",
        type: "select",
        section: "spaceDetails",
        options: [
            option("self-storage", "Self-storage unit"),
            option("garage", "Garage"),
            option("vehicle", "Vehicle / RV storage"),
            option("warehouse", "Warehouse space"),
        ],
    },
    {
        key: "accessHours",
        label: "Access hours",
        type: "select",
        section: "spaceDetails",
        options: [option("24x7", "24/7"), option("business", "Business hours only")],
    },
    { key: "ceilingHeightFt", label: "Ceiling height (ft)", type: "number", min: 1, maxDigits: 3, unit: "ft", section: "spaceDetails" },
    yesNo("driveUp", "Drive-up access", "spaceDetails"),
    yesNo("loadingDock", "Loading dock", "spaceDetails"),
    yesNo("securityGuard", "On-site security", "spaceDetails"),
    yesNo("climateControlled", "Climate controlled", "spaceDetails"),
    dollars("securityDeposit", "Security deposit ($)", ["rent"]),
    ...availability("spaceDetails", ["rent"], HOME_LEASE_TERMS),
    { key: "website", label: "Website (optional)", type: "text", section: "spaceDetails", placeholder: "https://yourbusiness.com" },
];
const COMMERCIAL_FIELDS = [
    { key: "sqft", label: "Area", type: "area", units: ["sqft", "acre"], required: true, section: "spaceDetails" },
    {
        key: "purpose",
        label: "Property type",
        type: "select",
        section: "spaceDetails",
        required: true,
        options: [
            option("office", "Office"),
            option("retail", "Retail"),
            option("warehouse", "Industrial / warehouse"),
            option("restaurant", "Restaurant"),
            option("hotel", "Hotel / hospitality"),
            option("self-storage", "Self-storage facility"),
            option("land", "Land"),
            option("other", "Other"),
        ],
    },
    { key: "floor", label: "Floor", type: "text", section: "spaceDetails", placeholder: "e.g. Ground, 2nd floor" },
    { key: "furnished", label: "Furnishing", type: "select", section: "spaceDetails", options: FURNISHING },
    count("washroomCount", "Restrooms", "spaceDetails"),
    { ...count("carParkingCount", "Parking spaces", "spaceDetails"), maxDigits: 3 },
    yearBuilt("spaceDetails"),
    yesNo("lift", "Elevator", "spaceDetails"),
    dollars("securityDeposit", "Security deposit ($)", ["lease"]),
    ...availability("spaceDetails", ["lease"], COMMERCIAL_LEASE_TERMS),
    {
        key: "rentEscalationPercent",
        label: "Yearly rent increase (%)",
        type: "number",
        decimal: true,
        min: 0,
        max: 25,
        unit: "%",
        section: "pricing",
        transactionTypes: ["lease"],
    },
    dollars("propertyTaxYearly", "Yearly property tax ($)", ["sell"]),
    { key: "website", label: "Website (optional)", type: "text", section: "spaceDetails", placeholder: "https://yourbusiness.com" },
    fromBroker,
];
const HOUSE_FIELDS = homeFields({ lot: true });
const UNIT_FIELDS = homeFields({ floor: true });
/** The US categories with a list of their own. Room for rent is a US-only category, so its one list serves. */
exports.US_CATEGORY_FIELDS = {
    house: HOUSE_FIELDS,
    townhouse: HOUSE_FIELDS,
    apartment: UNIT_FIELDS,
    condo: UNIT_FIELDS,
    storage: STORAGE_FIELDS,
    commercial: COMMERCIAL_FIELDS,
};

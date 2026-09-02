"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENTITY_TAGLINE = exports.LEGAL_ENTITY = void 0;
exports.entityCopyright = entityCopyright;
exports.entityAddressLines = entityAddressLines;
exports.entityOperatorSentence = entityOperatorSentence;
/** The legal entity behind the Bhavano brand. Shared by web and mobile so the name can never
 * drift between the two — DLT/telco header verification (and payment-aggregator onboarding)
 * rejects a submission when the registered entity name on the form doesn't appear verbatim on
 * the site, so `legalName` must stay character-for-character identical to the MCA record.
 * See docs/plans/finfolia-entity-disclosure.md. */
exports.LEGAL_ENTITY = {
    /** Registered name at the MCA. Rendered verbatim wherever the operator is named. */
    legalName: "Finfolia Technologies LLP",
    brand: "Bhavano",
    supportEmail: "support@bhavano.com",
    /** Optional fields below are omitted from the UI until they're filled in — every consumer
     * renders them conditionally, so a blank here ships as a missing line rather than a visible
     * placeholder. */
    llpin: undefined,
    gstin: undefined,
    supportPhone: undefined,
    registeredAddress: undefined,
};
/** "Bhavano is a product of Finfolia Technologies LLP" — the one-line brand/entity link that
 * satisfies the "entity name is not mentioned in the website" check. */
exports.ENTITY_TAGLINE = `${exports.LEGAL_ENTITY.brand} is a product of ${exports.LEGAL_ENTITY.legalName}`;
/** Copyright line for the site footer. Names the entity, not the brand — a brand-only copyright
 * is exactly what fails verification. */
function entityCopyright(year = new Date().getFullYear()) {
    return `© ${year} ${exports.LEGAL_ENTITY.legalName}. All rights reserved.`;
}
/** The registered office as renderable lines, or `[]` when the address hasn't been filled in. */
function entityAddressLines() {
    const address = exports.LEGAL_ENTITY.registeredAddress;
    if (!address)
        return [];
    return [
        address.line1,
        address.line2,
        `${address.city}, ${address.state} ${address.pincode}`,
        address.country,
    ].filter((line) => !!line);
}
/** Long-form operator sentence used in Terms and Privacy — appends the LLPIN and registered
 * office only once those are set. */
function entityOperatorSentence() {
    const parts = [
        `${exports.LEGAL_ENTITY.brand} is owned and operated by ${exports.LEGAL_ENTITY.legalName}, a limited liability partnership registered in India`,
    ];
    if (exports.LEGAL_ENTITY.llpin)
        parts.push(` (LLPIN: ${exports.LEGAL_ENTITY.llpin})`);
    const address = entityAddressLines();
    if (address.length > 0)
        parts.push(`, with its registered office at ${address.join(", ")}`);
    return `${parts.join("")}.`;
}

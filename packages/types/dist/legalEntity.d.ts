/** The legal entity behind the Bhavano brand. Shared by web and mobile so the name can never
 * drift between the two — DLT/telco header verification (and payment-aggregator onboarding)
 * rejects a submission when the registered entity name on the form doesn't appear verbatim on
 * the site, so `legalName` must stay character-for-character identical to the MCA record.
 * See docs/plans/finfolia-entity-disclosure.md. */
export declare const LEGAL_ENTITY: {
    /** Registered name at the MCA. Rendered verbatim wherever the operator is named. */
    readonly legalName: "Finfolia Technologies LLP";
    readonly brand: "Bhavano";
    readonly supportEmail: "support@bhavano.com";
    /** Optional fields below are omitted from the UI until they're filled in — every consumer
     * renders them conditionally, so a blank here ships as a missing line rather than a visible
     * placeholder. */
    readonly llpin: string | undefined;
    readonly gstin: string | undefined;
    readonly supportPhone: string | undefined;
    readonly registeredAddress: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        pincode: string;
        country: string;
    } | undefined;
};
/** "Bhavano is a product of Finfolia Technologies LLP" — the one-line brand/entity link that
 * satisfies the "entity name is not mentioned in the website" check. */
export declare const ENTITY_TAGLINE: string;
/** Copyright line for the site footer. Names the entity, not the brand — a brand-only copyright
 * is exactly what fails verification. */
export declare function entityCopyright(year?: number): string;
/** The registered office as renderable lines, or `[]` when the address hasn't been filled in. */
export declare function entityAddressLines(): string[];
/** Long-form operator sentence used in Terms and Privacy — appends the LLPIN and registered
 * office only once those are set. */
export declare function entityOperatorSentence(): string;

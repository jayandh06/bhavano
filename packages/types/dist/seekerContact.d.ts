/** Showing an interested seeker's phone number to the owner of the ad they looked at: free while the ad is Featured, otherwise unlocked one lead at a time with a
 * contact-reveal credit. Admin-controlled (Admin -> Settings -> Seeker contact), off by default. See docs/plans/featured-seeker-contact-for-owners.md. */
/** "notice": every seeker with a verified phone is shareable unless they said no. "opt_in": only seekers who said yes. */
export type SeekerContactConsentMode = "notice" | "opt_in";
export interface SeekerContactSettingsDto {
    enabled: boolean;
    consentMode: SeekerContactConsentMode;
    /** Lead unlocks a new ad owner gets before credits are needed (separate from a seeker's free reveals). */
    freeLeadRevealsPerOwner: number;
}
export declare const DEFAULT_SEEKER_CONTACT_SETTINGS: SeekerContactSettingsDto;
/** What a seeker chose for themselves. "unset" until they touch the toggle. */
export type ContactShareChoice = "unset" | "yes" | "no";
export declare function normalizeContactShareChoice(raw: string | null | undefined): ContactShareChoice;
/** Whether a seeker's number may be shown to an owner at all, before any payment: depends on the mode and on what they chose. */
export declare function seekerIsShareable(mode: SeekerContactConsentMode, choice: ContactShareChoice): boolean;
/** Interests older than this stop showing numbers: a stale lead is the one most likely to annoy. */
export declare const LEAD_CONTACT_WINDOW_DAYS = 30;
/** `+919876543210` -> `+91 98••••••10`. Only ever built from a number we are NOT allowed to show, so it keeps just enough to look like a phone. */
export declare function maskPhone(phone: string): string;
/** What the owner's interested list may do with one lead's contact. */
export type LeadContactState = 
/** The number is in `phone`. */
"available"
/** Shareable, but the owner has to spend a credit (or free lead reveal) to see it: `phoneMasked` is set. */
 | "unlockable"
/** Nothing to show: no verified phone, the seeker said no, the interest is too old, or the feature is off. */
 | "none";
/** The owner-side totals the interested list needs to price an unlock. */
export interface LeadContactSummaryDto {
    /** The admin switch. When false every lead is `none` and the UI shows the plain Message-only list. */
    enabled: boolean;
    /** The ad is Featured right now (or the owner has Agent Pro): every shareable lead is `available` for free. */
    featured: boolean;
    /** Lead unlocks left before credits are needed. */
    freeLeadReveals: number;
    /** Contact-reveal credits the owner holds (unexpired). */
    creditsRemaining: number;
    creditPackSize: number;
    creditPackPriceRupees: number;
}
export interface UnlockLeadContactResponseDto {
    phone: string;
}
export interface ContactSharePreferenceDto {
    /** The switch is off: nothing is shared, the toggle can be hidden. */
    enabled: boolean;
    mode: SeekerContactConsentMode;
    choice: ContactShareChoice;
    /** What the toggle should show right now (true = owners of Featured ads may call this person). */
    sharing: boolean;
}

"use strict";
/** Showing an interested seeker's phone number to the owner of the ad they looked at: free while the ad is Featured, otherwise unlocked one lead at a time with a
 * contact-reveal credit. Admin-controlled (Admin -> Settings -> Seeker contact), off by default. See docs/plans/featured-seeker-contact-for-owners.md. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEAD_CONTACT_WINDOW_DAYS = exports.DEFAULT_SEEKER_CONTACT_SETTINGS = void 0;
exports.normalizeContactShareChoice = normalizeContactShareChoice;
exports.seekerIsShareable = seekerIsShareable;
exports.maskPhone = maskPhone;
exports.DEFAULT_SEEKER_CONTACT_SETTINGS = {
    enabled: false,
    consentMode: "notice",
    freeLeadRevealsPerOwner: 0,
};
function normalizeContactShareChoice(raw) {
    return raw === "yes" || raw === "no" ? raw : "unset";
}
/** Whether a seeker's number may be shown to an owner at all, before any payment: depends on the mode and on what they chose. */
function seekerIsShareable(mode, choice) {
    return mode === "opt_in" ? choice === "yes" : choice !== "no";
}
/** Interests older than this stop showing numbers: a stale lead is the one most likely to annoy. */
exports.LEAD_CONTACT_WINDOW_DAYS = 30;
/** `+919876543210` -> `+91 98••••••10`. Only ever built from a number we are NOT allowed to show, so it keeps just enough to look like a phone. */
function maskPhone(phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6)
        return "••••••";
    const last = digits.slice(-2);
    const first = digits.length > 10 ? digits.slice(-10, -8) : digits.slice(0, 2);
    const country = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : "";
    return `${country}${first}••••••${last}`;
}

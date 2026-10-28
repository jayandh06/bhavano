"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_LOGIN_DISABLED_MESSAGE = exports.EMAIL_LOGIN_DISABLED_CODE = exports.PHONE_VERIFICATION_REQUIRED_CODE = exports.DEFAULT_PHONE_REQUIREMENT_MODE = exports.PHONE_REQUIREMENT_MODES = exports.DEFAULT_EMAIL_LOGIN_MODE = exports.EMAIL_LOGIN_MODES = void 0;
exports.isPhoneRequirementMode = isPhoneRequirementMode;
exports.effectivePhoneRequirement = effectivePhoneRequirement;
exports.emailLoginIsRestricted = emailLoginIsRestricted;
exports.isEmailLoginMode = isEmailLoginMode;
/** Whether signing in with an email identity (Google, Apple) is allowed, set by an admin. Phone OTP is always allowed.
 * - all: as before.
 * - existing_only: people who already have an account can still use Google / Apple, but a brand-new account cannot be created that way (stops throwaway-email sign-ups).
 * - existing_no_phone: the migration to mobile. Only an existing account that has NO mobile number can use Google / Apple, and it is made to verify one straight away (the
 *   "required" prompt and the contact-details lock apply to it); once it has a number, Google / Apple are refused for it and it signs in with the mobile OTP.
 * - off: Google / Apple sign-in is closed to everyone except staff. */
exports.EMAIL_LOGIN_MODES = ["all", "existing_only", "existing_no_phone", "off"];
exports.DEFAULT_EMAIL_LOGIN_MODE = "all";
/** What accounts that have no mobile number (they signed up with Google / Apple) are asked to do, set by an admin. Moving everyone to mobile sign-in first.
 * - off: nothing extra.
 * - ask: a skippable "Add your mobile number" prompt every day they open the site or app.
 * - required: the prompt cannot be skipped, and contact details stay locked, until a mobile number is verified (they can still log out). */
exports.PHONE_REQUIREMENT_MODES = ["off", "ask", "required"];
exports.DEFAULT_PHONE_REQUIREMENT_MODE = "off";
function isPhoneRequirementMode(value) {
    return typeof value === "string" && exports.PHONE_REQUIREMENT_MODES.includes(value);
}
/** The phone requirement actually in force: the migration mode forces "required" whatever the separate setting says. */
function effectivePhoneRequirement(settings) {
    return settings.emailLogin === "existing_no_phone" ? "required" : settings.phoneRequirement;
}
/** True when the login screens should still show Google / Apple (with a note that it is for existing accounts only). */
function emailLoginIsRestricted(mode) {
    return mode === "existing_only" || mode === "existing_no_phone";
}
/** The `code` on the 403 for an action that needs a verified mobile number (also used when publishing). */
exports.PHONE_VERIFICATION_REQUIRED_CODE = "PHONE_VERIFICATION_REQUIRED";
/** The `code` on the 403 a Google / Apple sign-in gets while that is closed to the account trying it. */
exports.EMAIL_LOGIN_DISABLED_CODE = "EMAIL_LOGIN_DISABLED";
exports.EMAIL_LOGIN_DISABLED_MESSAGE = "Please sign in with your mobile number.";
function isEmailLoginMode(value) {
    return typeof value === "string" && exports.EMAIL_LOGIN_MODES.includes(value);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_LOGIN_DISABLED_MESSAGE = exports.EMAIL_LOGIN_DISABLED_CODE = exports.DEFAULT_EMAIL_LOGIN_MODE = exports.EMAIL_LOGIN_MODES = void 0;
exports.isEmailLoginMode = isEmailLoginMode;
/** Whether signing in with an email identity (Google, Apple) is allowed, set by an admin. Phone OTP is always allowed.
 * - all: as before.
 * - existing_only: people who already have an account can still use Google / Apple, but a brand-new account cannot be created that way (stops throwaway-email sign-ups).
 * - off: Google / Apple sign-in is closed to everyone except staff. */
exports.EMAIL_LOGIN_MODES = ["all", "existing_only", "off"];
exports.DEFAULT_EMAIL_LOGIN_MODE = "all";
/** The `code` on the 403 a Google / Apple sign-in gets while that is closed to the account trying it. */
exports.EMAIL_LOGIN_DISABLED_CODE = "EMAIL_LOGIN_DISABLED";
exports.EMAIL_LOGIN_DISABLED_MESSAGE = "Please sign in with your mobile number.";
function isEmailLoginMode(value) {
    return typeof value === "string" && exports.EMAIL_LOGIN_MODES.includes(value);
}

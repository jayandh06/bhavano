/** Whether signing in with an email identity (Google, Apple) is allowed, set by an admin. Phone OTP is always allowed.
 * - all: as before.
 * - existing_only: people who already have an account can still use Google / Apple, but a brand-new account cannot be created that way (stops throwaway-email sign-ups).
 * - off: Google / Apple sign-in is closed to everyone except staff. */
export declare const EMAIL_LOGIN_MODES: readonly ["all", "existing_only", "off"];
export type EmailLoginMode = (typeof EMAIL_LOGIN_MODES)[number];
export declare const DEFAULT_EMAIL_LOGIN_MODE: EmailLoginMode;
export interface LoginSettingsDto {
    emailLogin: EmailLoginMode;
}
/** What the login screens may offer; public, so it holds nothing but the mode. */
export type LoginMethodsDto = LoginSettingsDto;
/** The `code` on the 403 a Google / Apple sign-in gets while that is closed to the account trying it. */
export declare const EMAIL_LOGIN_DISABLED_CODE = "EMAIL_LOGIN_DISABLED";
export declare const EMAIL_LOGIN_DISABLED_MESSAGE = "Please sign in with your mobile number.";
export declare function isEmailLoginMode(value: unknown): value is EmailLoginMode;

/** Whether signing in with an email identity (Google, Apple) is allowed, set by an admin. Phone OTP is always allowed.
 * - all: as before.
 * - existing_only: people who already have an account can still use Google / Apple, but a brand-new account cannot be created that way (stops throwaway-email sign-ups).
 * - off: Google / Apple sign-in is closed to everyone except staff. */
export declare const EMAIL_LOGIN_MODES: readonly ["all", "existing_only", "off"];
export type EmailLoginMode = (typeof EMAIL_LOGIN_MODES)[number];
export declare const DEFAULT_EMAIL_LOGIN_MODE: EmailLoginMode;
/** What accounts that have no mobile number (they signed up with Google / Apple) are asked to do, set by an admin. Moving everyone to mobile sign-in first.
 * - off: nothing extra.
 * - ask: a skippable "Add your mobile number" prompt every day they open the site or app.
 * - required: the prompt cannot be skipped, and contact details stay locked, until a mobile number is verified (they can still log out). */
export declare const PHONE_REQUIREMENT_MODES: readonly ["off", "ask", "required"];
export type PhoneRequirementMode = (typeof PHONE_REQUIREMENT_MODES)[number];
export declare const DEFAULT_PHONE_REQUIREMENT_MODE: PhoneRequirementMode;
export declare function isPhoneRequirementMode(value: unknown): value is PhoneRequirementMode;
export interface LoginSettingsDto {
    emailLogin: EmailLoginMode;
    phoneRequirement: PhoneRequirementMode;
}
/** Who an admin's "add your mobile number" in-app message would reach, for the Login methods page. An in-app message is a thread about one ad, so only
 * accounts that own an ad can receive it; the rest see the prompt when they next open the site or app. */
export interface MoveToMobileAudienceDto {
    /** Accounts with no mobile number. */
    emailOnly: number;
    /** Of those, the ones that own a live ad (the message goes into a thread about their newest one). */
    ownersWithAds: number;
    /** Of those, the ones already messaged (never sent twice). */
    alreadyMessaged: number;
}
export interface MoveToMobileSendResultDto {
    sent: number;
    skipped: number;
}
/** The `code` on the 403 for an action that needs a verified mobile number (also used when publishing). */
export declare const PHONE_VERIFICATION_REQUIRED_CODE = "PHONE_VERIFICATION_REQUIRED";
/** What the login screens may offer; public, so it holds nothing but the mode. */
export type LoginMethodsDto = LoginSettingsDto;
/** The `code` on the 403 a Google / Apple sign-in gets while that is closed to the account trying it. */
export declare const EMAIL_LOGIN_DISABLED_CODE = "EMAIL_LOGIN_DISABLED";
export declare const EMAIL_LOGIN_DISABLED_MESSAGE = "Please sign in with your mobile number.";
export declare function isEmailLoginMode(value: unknown): value is EmailLoginMode;

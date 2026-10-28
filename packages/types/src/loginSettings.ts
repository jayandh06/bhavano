/** Whether signing in with an email identity (Google, Apple) is allowed, set by an admin. Phone OTP is always allowed.
 * - all: as before.
 * - existing_only: people who already have an account can still use Google / Apple, but a brand-new account cannot be created that way (stops throwaway-email sign-ups).
 * - off: Google / Apple sign-in is closed to everyone except staff. */
export const EMAIL_LOGIN_MODES = ["all", "existing_only", "off"] as const;
export type EmailLoginMode = (typeof EMAIL_LOGIN_MODES)[number];

export const DEFAULT_EMAIL_LOGIN_MODE: EmailLoginMode = "all";

/** What accounts that have no mobile number (they signed up with Google / Apple) are asked to do, set by an admin. Moving everyone to mobile sign-in first.
 * - off: nothing extra.
 * - ask: a skippable "Add your mobile number" prompt every day they open the site or app.
 * - required: the prompt cannot be skipped, and contact details stay locked, until a mobile number is verified (they can still log out). */
export const PHONE_REQUIREMENT_MODES = ["off", "ask", "required"] as const;
export type PhoneRequirementMode = (typeof PHONE_REQUIREMENT_MODES)[number];

export const DEFAULT_PHONE_REQUIREMENT_MODE: PhoneRequirementMode = "off";

export function isPhoneRequirementMode(value: unknown): value is PhoneRequirementMode {
  return typeof value === "string" && (PHONE_REQUIREMENT_MODES as readonly string[]).includes(value);
}

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
export const PHONE_VERIFICATION_REQUIRED_CODE = "PHONE_VERIFICATION_REQUIRED";

/** What the login screens may offer; public, so it holds nothing but the mode. */
export type LoginMethodsDto = LoginSettingsDto;

/** The `code` on the 403 a Google / Apple sign-in gets while that is closed to the account trying it. */
export const EMAIL_LOGIN_DISABLED_CODE = "EMAIL_LOGIN_DISABLED";
export const EMAIL_LOGIN_DISABLED_MESSAGE = "Please sign in with your mobile number.";

export function isEmailLoginMode(value: unknown): value is EmailLoginMode {
  return typeof value === "string" && (EMAIL_LOGIN_MODES as readonly string[]).includes(value);
}

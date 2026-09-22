/** Shared between `app/actions/listings.ts` (a `"use server"` file, which can only export async
 * functions — a plain string constant can't live there) and PostAdWizard.tsx: the wizard's own
 * client-side `!activeToken` check is normally what catches a logged-out submit before any
 * request goes out, but a session can still lapse between that check and the server action's own
 * (a slow photo/video upload in between, a token that expired in the interim). Matching on this
 * exact string is how the wizard tells "genuinely logged out, reopen the login dialog" apart from
 * every other failure reason, which it shows as a plain error instead. */
export const NEEDS_LOGIN_ERROR = "You must be logged in to post an ad.";

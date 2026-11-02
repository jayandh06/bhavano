/** The `bhavano_sid` analytics session cookie: how long a session survives without activity.
 *
 * It used to be a browser-session cookie (no expiry, gone when the browser closes). On Android a link tapped from another app (an
 * email, WhatsApp, the Google app, a notification) opens in an in-app browser tab that does not reuse the earlier cookie, so one
 * person tapping the same link twice three minutes apart became two sessions and two Page visits rows. Now the cookie lives
 * 30 minutes and is pushed forward by every page view, like a Google Analytics session, so a return inside that window continues the
 * same session and the same page trail. See docs/plans/session-cookie-rolling-expiry.md. */
export const SESSION_COOKIE_NAME = "bhavano_sid";

export const SESSION_IDLE_SECONDS = 30 * 60;

/** Options for (re)writing the cookie. `secure` is false only on the local dev server, which is plain http. */
export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_IDLE_SECONDS,
  };
}

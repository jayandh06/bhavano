import { describe, expect, it } from "vitest";
import { SESSION_IDLE_SECONDS, sessionCookieOptions } from "./sessionCookie";

describe("sessionCookieOptions", () => {
  it("expires the session 30 minutes after the last page view, not when the browser closes", () => {
    expect(SESSION_IDLE_SECONDS).toBe(1800);
    expect(sessionCookieOptions(true).maxAge).toBe(1800);
  });

  it("stays httpOnly and lax, and is Secure only where the site is https", () => {
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});

import { test as setup } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { BFF_URL, DEMO_USER_PHONE, STORAGE_STATE_PATH } from "../support/constants";

/** Non-secure cookie name Auth.js uses when the app runs over plain http (e.g. localhost) —
 * see @auth/core's `defaultCookies()`. Also doubles as the `salt` `encode()` needs, since
 * Auth.js derives its per-cookie encryption key from `salt = cookie name`
 * (see @auth/core/lib/utils/session.js's `getLoggedInUser`). */
const SESSION_COOKIE_NAME = "authjs.session-token";

/** Mints a real BFF + NextAuth session for the seeded demo user and saves it as Playwright
 * storage state, so every authenticated spec starts already logged in — real OTP/Google login
 * can't be automated locally (see docs/plans/web-smoke-tests.md), so this bypasses the UI
 * entirely and constructs the exact session cookie a real login would leave behind. */
setup("authenticate as seeded demo user", async ({ context, baseURL }) => {
  const res = await fetch(`${BFF_URL}/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: DEMO_USER_PHONE }),
  });
  if (!res.ok) {
    throw new Error(
      `BFF dev-login failed (${res.status}) — is ALLOW_DEV_LOGIN=true set on the BFF, and has ` +
        `\`pnpm --filter @bhavano/bff prisma:seed\` run (seeds the demo user, phone ${DEMO_USER_PHONE})?`,
    );
  }
  const { accessToken, user } = (await res.json()) as {
    accessToken: string;
    user: { id: string; name?: string; email?: string };
  };

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET/NEXTAUTH_SECRET must be set in the environment running this setup (see apps/web/.env)");
  }

  // Matches the `jwt()` callback's shape in apps/web/src/auth.ts exactly — `sub`/`accessToken`
  // are what the `session()` callback reads to populate `session.user.id`/`session.accessToken`.
  const sessionToken = await encode({
    secret,
    salt: SESSION_COOKIE_NAME,
    maxAge: 60 * 60, // matches the BFF accessToken's own 1h TTL
    token: {
      sub: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      accessToken,
    },
  });

  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      url: baseURL ?? "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await context.storageState({ path: STORAGE_STATE_PATH });
});

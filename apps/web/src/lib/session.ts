/** NextAuth's own session cookie can outlive the BFF access token embedded
 * inside it, so a session can still look "logged in" (cookie valid, `session.user.name` present)
 * for hours after the embedded token has actually expired server-side. Pages already handle this
 * on the content side (catching `BffAuthError` and showing a login prompt — see
 * docs/plans/fix-stale-session-crash-on-authed-pages.md), but the header was still reading
 * `session.user.name` directly and showing the logged-in account menu regardless. Decoding the
 * token's own `exp` claim here — no signature verification needed, this only decides what the
 * header displays, the BFF is still the one actually enforcing auth on every real request — lets
 * the header agree with the page content instead of contradicting it. */
function decodeJwtClaimMs(token: string, claim: "exp" | "iat"): number | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const value = json[claim];
    return typeof value === "number" ? value * 1000 : null;
  } catch {
    return null;
  }
}

/** Whether a still-valid token should be swapped for a fresh one: once it's a day old, or halfway
 * through its life if that's sooner (admin tokens only last a day). */
export function isAccessTokenDueForRenewal(accessToken?: string | null): boolean {
  if (!isAccessTokenValid(accessToken)) return false;
  const issuedAt = decodeJwtClaimMs(accessToken, "iat");
  const expiresAt = decodeJwtClaimMs(accessToken, "exp");
  if (issuedAt === null || expiresAt === null) return false;
  return Date.now() - issuedAt > Math.min(24 * 60 * 60 * 1000, (expiresAt - issuedAt) / 2);
}

/** Whether the BFF token was issued to an admin (its `role` claim). Display only, like the expiry
 * check above: admin endpoints still enforce the role themselves. */
export function isAdminAccessToken(accessToken?: string | null): boolean {
  if (!isAccessTokenValid(accessToken)) return false;
  try {
    const payload = accessToken.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string };
    return json.role === "admin";
  } catch {
    return false;
  }
}

/** A type predicate (not just `boolean`) so `if (!isAccessTokenValid(session.accessToken)) return;`
 * narrows `session.accessToken` itself to `string` afterwards — needed at call sites that pass it
 * straight into a function expecting a required `string` (e.g. `uploadPhoto`). */
export function isAccessTokenValid(accessToken?: string | null): accessToken is string {
  if (!accessToken) return false;
  const expiresAtMs = decodeJwtClaimMs(accessToken, "exp");
  return expiresAtMs !== null && expiresAtMs > Date.now();
}

/** The name to show in the header — `undefined` (rendered as logged-out/"Login") whenever the
 * BFF access token backing this session has expired, even if NextAuth's own cookie is still
 * valid. */
export function sessionHeaderName(session: { accessToken?: string; user?: { name?: string | null } } | null): string | null | undefined {
  if (!session?.user?.name) return undefined;
  return isAccessTokenValid(session.accessToken) ? session.user.name : undefined;
}

/** The BFF access token to hand to client components that talk to the BFF directly (today: the
 * header's Messages count badge and its socket) — `undefined` once the token has expired, the
 * same gate `sessionHeaderName` applies to the displayed name, so the two never disagree. */
export function sessionAccessToken(session: { accessToken?: string } | null): string | undefined {
  return isAccessTokenValid(session?.accessToken) ? session!.accessToken : undefined;
}

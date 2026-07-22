/** NextAuth's own session cookie lives far longer than the BFF's 1h-TTL access token embedded
 * inside it, so a session can still look "logged in" (cookie valid, `session.user.name` present)
 * for hours after the embedded token has actually expired server-side. Pages already handle this
 * on the content side (catching `BffAuthError` and showing a login prompt — see
 * docs/plans/fix-stale-session-crash-on-authed-pages.md), but the header was still reading
 * `session.user.name` directly and showing the logged-in account menu regardless. Decoding the
 * token's own `exp` claim here — no signature verification needed, this only decides what the
 * header displays, the BFF is still the one actually enforcing auth on every real request — lets
 * the header agree with the page content instead of contradicting it. */
function decodeJwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenValid(accessToken?: string | null): boolean {
  if (!accessToken) return false;
  const expiresAtMs = decodeJwtExpiryMs(accessToken);
  return expiresAtMs !== null && expiresAtMs > Date.now();
}

/** The name to show in the header — `undefined` (rendered as logged-out/"Login") whenever the
 * BFF access token backing this session has expired, even if NextAuth's own cookie is still
 * valid. */
export function sessionHeaderName(session: { accessToken?: string; user?: { name?: string | null } } | null): string | null | undefined {
  if (!session?.user?.name) return undefined;
  return isAccessTokenValid(session.accessToken) ? session.user.name : undefined;
}

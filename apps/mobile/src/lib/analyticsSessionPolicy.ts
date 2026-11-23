/** How long an app analytics session survives without activity: the same 30 minutes as the website's `bhavano_sid` cookie
 * (apps/web/src/lib/sessionCookie.ts), so closing and reopening the app inside that window continues one Page visits row
 * instead of starting another. See docs/plans/page-visits-one-row-per-user-per-day.md. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** What is kept in storage between launches. `visitSent` / `jsConfirmSent` ride along so a resumed session does not post its
 * Visit row (and JS confirmation) a second time. */
export interface StoredSession {
  id: string;
  lastActiveAt: number;
  visitSent: boolean;
  jsConfirmSent: boolean;
}

/** Reads what `JSON.stringify(StoredSession)` wrote, or null for anything missing, malformed or from a different shape. */
export function parseStoredSession(raw: string | null | undefined): StoredSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredSession> | null;
    if (!v || typeof v.id !== "string" || v.id.length === 0) return null;
    if (typeof v.lastActiveAt !== "number" || !Number.isFinite(v.lastActiveAt)) return null;
    return { id: v.id, lastActiveAt: v.lastActiveAt, visitSent: v.visitSent === true, jsConfirmSent: v.jsConfirmSent === true };
  } catch {
    return null;
  }
}

/** Whether the session is still the visitor's current one at `now`: active within the idle window. A timestamp in the future
 * (a clock that was set back) is not trusted, so it starts a new session instead of keeping an old one alive. */
export function isSessionLive(session: Pick<StoredSession, "lastActiveAt"> | null | undefined, now: number): boolean {
  if (!session) return false;
  const idle = now - session.lastActiveAt;
  return idle >= 0 && idle <= SESSION_IDLE_MS;
}

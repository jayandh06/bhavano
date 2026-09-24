import * as Crypto from "expo-crypto";

const BFF_URL = process.env.EXPO_PUBLIC_BFF_URL ?? "http://localhost:4000";

/**
 * In-app Page visits / PageView trail — mirrors web's `bhavano_sid` + SoftNavPageViews, but
 * there is no cookie or middleware on native.
 *
 * Session lifetime matches web's session cookie (dies when the browser closes): one id per JS
 * process. A cold start mints a new Visit; fast refresh in dev does too. Not persisted — a
 * durable-per-install id would merge weeks of opens into one admin row, which is not how Page
 * visits are read.
 *
 * See docs/plans/analytics-bot-filtering-and-attribution.md ("Mobile app Page visits").
 */

let sessionId: string | null = null;
let visitSent = false;
let jsConfirmSent = false;

/** Current analytics session id — mint once per process. Safe to call from login to link the
 * Visit row to the user (AuthService.linkVisitToUser). */
export function getAnalyticsSessionId(): string {
  if (!sessionId) sessionId = Crypto.randomUUID();
  return sessionId;
}

async function postJson(path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BFF_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Client": "app" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`analytics ${path} failed (${res.status})`);
  }
}

/** Once per process: create the Visit row as mobile_app + confirm JS (engine already ran).
 * Retries on next pageview if the POST fails. */
async function ensureVisit(landingPath: string): Promise<string> {
  const id = getAnalyticsSessionId();
  if (!visitSent) {
    try {
      await postJson("/analytics/visit", {
        sessionId: id,
        landingPath,
        source: "direct",
        fromApp: true,
      });
      visitSent = true;
    } catch {
      // Leave visitSent false so the next navigation retries — same self-heal idea as BFF
      // backfillMissingVisit when /analytics/visit is lost.
    }
  }
  if (visitSent && !jsConfirmSent) {
    try {
      await postJson("/analytics/confirm", { sessionId: id });
      jsConfirmSent = true;
    } catch {
      // Non-fatal — jsConfirmedAt stays null; page views still land.
    }
  }
  return id;
}

/** One PageView for a path (route change or synthetic wizard step like `/post/preview`).
 * Fire-and-forget from callers; swallows errors so analytics never blocks UI. */
export async function recordAppPageView(path: string): Promise<void> {
  if (!path.startsWith("/")) return;
  try {
    const sessionId = await ensureVisit(path);
    await postJson("/analytics/pageview", {
      sessionId,
      path: path.slice(0, 500),
      fromApp: true,
    });
  } catch {
    // Offline or navigated away — same stance as SoftNavPageViews.
  }
}

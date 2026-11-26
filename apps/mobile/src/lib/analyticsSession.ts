import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { AppState } from "react-native";
import { isSessionLive, parseStoredSession, type StoredSession } from "./analyticsSessionPolicy";
import { readInstallWebSessionId } from "./installAttributionStore";
import { apiUrl } from "./marketEndpoints";
import { beforeMarketLeave, marketKey, onMarketChange } from "./marketState";

/**
 * In-app Page visits / PageView trail — mirrors web's `bhavano_sid` + SoftNavPageViews, but
 * there is no cookie or middleware on native.
 *
 * Session lifetime matches web's `bhavano_sid` cookie: 30 minutes without activity (SESSION_IDLE_MS).
 * The id is kept in storage between launches, so closing and reopening the app inside that window
 * continues the same Visit row instead of starting a new one on every launch (four launches in 28
 * minutes used to show as four rows). After more than 30 minutes idle, in the background or the
 * foreground, the next page view starts a new session. Only the session id and its last activity
 * are stored, not a durable per-install id (that would merge weeks of opens into one admin row).
 *
 * See docs/plans/analytics-bot-filtering-and-attribution.md ("Mobile app Page visits") and
 * docs/plans/page-visits-one-row-per-user-per-day.md.
 */

const STORAGE_KEY = "bhavano.analyticsSession";
/** Each market's server has its own visits, so each keeps its own session. */
const storageKey = () => marketKey(STORAGE_KEY);
/** Activity is flushed to storage at most this often, and immediately when the app leaves the
 * foreground (the AppState listener below), instead of on every page view. */
const PERSIST_THROTTLE_MS = 15_000;

let sessionId: string | null = null;
let lastActiveAt = 0;
let visitSent = false;
let jsConfirmSent = false;
let lastPersistedAt = 0;
let hydration: Promise<void> | null = null;
let linkedForToken: string | null = null;

function persist(): void {
  if (!sessionId) return;
  lastPersistedAt = Date.now();
  const value: StoredSession = { id: sessionId, lastActiveAt, visitSent, jsConfirmSent };
  void AsyncStorage.setItem(storageKey(), JSON.stringify(value)).catch(() => undefined);
}

/** Starts a new session: a new id, nothing sent yet, and the account link to be made again for it. */
function startSession(): string {
  sessionId = Crypto.randomUUID();
  lastActiveAt = Date.now();
  visitSent = false;
  jsConfirmSent = false;
  linkedForToken = null;
  persist();
  return sessionId;
}

/** Loads the stored session once per process. One still inside its idle window is continued; anything
 * else is replaced on first use. If an id was already handed out before storage answered (a very
 * early caller), that newer session is kept rather than switching ids under a caller holding it. */
export function hydrateAnalyticsSession(): Promise<void> {
  if (!hydration) {
    const key = storageKey();
    hydration = AsyncStorage.getItem(key)
      .then((raw) => {
        if (key !== storageKey()) return; // the market changed while reading
        const stored = parseStoredSession(raw);
        if (!sessionId && stored && isSessionLive(stored, Date.now())) {
          sessionId = stored.id;
          lastActiveAt = stored.lastActiveAt;
          visitSent = stored.visitSent;
          jsConfirmSent = stored.jsConfirmSent;
        }
      })
      .catch(() => undefined);
  }
  return hydration;
}

/** Marks activity now, which extends the session. */
function touch(): void {
  lastActiveAt = Date.now();
  if (lastActiveAt - lastPersistedAt >= PERSIST_THROTTLE_MS) persist();
}

/** Replaces the session once it has been idle past the window, so an app left open starts a new
 * visit the way a website tab does. */
function rotateIfIdle(): void {
  if (sessionId && !isSessionLive({ lastActiveAt }, Date.now())) startSession();
}

// Save the market being left, then forget it: the next page view loads or starts the new market's session.
beforeMarketLeave(() => persist());
onMarketChange(() => {
  sessionId = null;
  lastActiveAt = 0;
  visitSent = false;
  jsConfirmSent = false;
  lastPersistedAt = 0;
  hydration = null;
  linkedForToken = null;
});

// Leaving the foreground is when the process is most likely to be killed: save the latest activity then.
AppState.addEventListener("change", (state) => {
  if (state !== "active") persist();
});

/** Current analytics session id: the one continued from the last 30 minutes if there is one, else a
 * new one. Safe to call from login to link the Visit row to the user (AuthService.linkVisitToUser). */
export function getAnalyticsSessionId(): string {
  rotateIfIdle();
  return sessionId ?? startSession();
}

/** Tells the BFF which user this launch's analytics session belongs to.
 *
 * Login links the session to the user only at that instant. The session id is new on every cold
 * start, so a user who is still logged in from last time never passes through login again — and
 * every visit after the first launch showed as anonymous in the admin Page visits list. Call this
 * whenever a session is present (restored from storage or just created). Once per process per
 * token; a failure retries on the next call. */
export async function linkAnalyticsSessionToUser(accessToken: string): Promise<void> {
  await hydrateAnalyticsSession();
  // Before the guard: this can start a new session after an idle gap, which clears the earlier link.
  const id = getAnalyticsSessionId();
  if (linkedForToken === accessToken) return;
  try {
    const res = await fetch(`${apiUrl()}/analytics/link-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client": "app", Authorization: `Bearer ${accessToken}` },
      // `webSessionId`: the website session this install came from (Play referrer `ws`), so the server can also
      // claim that person's earlier anonymous web visits. Absent for installs that did not start on the website.
      body: JSON.stringify({ sessionId: id, webSessionId: await readInstallWebSessionId() }),
    });
    // Only if the session is still the one just linked (a new one may have started meanwhile).
    if (res.ok && sessionId === id) linkedForToken = accessToken;
  } catch {
    // Offline — analytics must never surface an error; retried on the next call.
  }
}

async function postJson(path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${apiUrl()}${path}`, {
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
      if (sessionId === id) {
        visitSent = true;
        persist();
      }
    } catch {
      // Leave visitSent false so the next navigation retries — same self-heal idea as BFF
      // backfillMissingVisit when /analytics/visit is lost.
    }
  }
  if (visitSent && !jsConfirmSent) {
    try {
      await postJson("/analytics/confirm", { sessionId: id });
      if (sessionId === id) {
        jsConfirmSent = true;
        persist();
      }
    } catch {
      // Non-fatal — jsConfirmedAt stays null; page views still land.
    }
  }
  return id;
}

/** One PageView for a path (route change or synthetic wizard step like `/post/preview` /
 * `/post/success`).
 * Fire-and-forget from callers; swallows errors so analytics never blocks UI. */
export async function recordAppPageView(path: string): Promise<void> {
  if (!path.startsWith("/")) return;
  try {
    await hydrateAnalyticsSession();
    const id = await ensureVisit(path);
    await postJson("/analytics/pageview", {
      sessionId: id,
      path: path.slice(0, 500),
      fromApp: true,
    });
    touch();
  } catch {
    // Offline or navigated away — same stance as SoftNavPageViews.
  }
}

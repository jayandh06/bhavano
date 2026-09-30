"use client";

import { useEffect } from "react";
import { renewSessionAction } from "@/app/actions/auth";

const LAST_RENEW_KEY = "bhavano.session.lastRenewAt";
/** The server decides whether the token is due; this just stops asking on every page. */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/** Keeps a logged-in visitor's session alive while they keep visiting: at most every 6 hours it
 * asks the server to renew the BFF token, which happens once the token is a day old (sooner for
 * admins' day-long tokens). See docs/plans/more-login-conversion.md. */
export function SessionKeepAlive() {
  useEffect(() => {
    const last = Number(localStorage.getItem(LAST_RENEW_KEY) ?? "0");
    if (Date.now() - last < CHECK_EVERY_MS) return;
    localStorage.setItem(LAST_RENEW_KEY, String(Date.now()));
    void renewSessionAction().catch(() => undefined);
  }, []);
  return null;
}

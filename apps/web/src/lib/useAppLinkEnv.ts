"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cameFromAdRecently, isAndroidBrowser } from "./appLinks";

const noSubscribe = () => () => {};

/** Android-browser check usable during render: false on the server and the hydration pass, the
 * real answer right after (useSyncExternalStore re-renders once with the client snapshot). */
export function useIsAndroidBrowser(): boolean {
  return useSyncExternalStore(noSubscribe, () => isAndroidBrowser(navigator.userAgent), () => false);
}

/** `cameFromAdRecently` for the current URL, re-read on every render. Server: false. */
export function useCameFromAdRecently(): boolean {
  return useSyncExternalStore(noSubscribe, () => cameFromAdRecently(window.location.search), () => false);
}

/** Whether a "dismissed at" timestamp in localStorage is younger than `windowMs`. Server: true,
 * so a dismissible prompt stays hidden until the client has actually checked. */
export function useDismissedRecently(key: string, windowMs: number): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        const at = Number(localStorage.getItem(key));
        return Number.isFinite(at) && at > 0 && Date.now() - at < windowMs;
      } catch {
        return false;
      }
    },
    () => true,
  );
}

/** True once, right after some earlier action on this tab set `key` in sessionStorage — consumed
 * on first read (a plain effect, not a setState-in-effect: the removal has nothing to render) so
 * revisiting the same page later in the same tab doesn't show it again. Server: false, same
 * reason as the other hooks here — sessionStorage doesn't exist there. */
export function useConsumeSessionFlag(key: string | null): boolean {
  const flagged = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return key !== null && sessionStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  useEffect(() => {
    if (!flagged || key === null) return;
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [flagged, key]);
  return flagged;
}

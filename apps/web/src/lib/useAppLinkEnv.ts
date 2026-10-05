"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
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

const dismissListeners = new Set<() => void>();

/** Whether a timestamp falls on today's date in the visitor's own time zone. */
export function isSameLocalDay(at: number, now: number): boolean {
  return new Date(at).toDateString() === new Date(now).toDateString();
}

function dismissedToday(key: string): boolean {
  try {
    const at = Number(localStorage.getItem(key));
    return Number.isFinite(at) && at > 0 && isSameLocalDay(at, Date.now());
  } catch {
    return false;
  }
}

/** A prompt dismissed for the rest of the day: back on the visitor's next calendar day.
 *
 * Re-read when the tab becomes visible again, so a tab left open overnight shows it the next day
 * without needing a navigation. Server: dismissed, so it stays hidden until the client has
 * checked. */
export function useDismissedToday(key: string): { dismissed: boolean; dismiss: () => void } {
  const subscribe = useCallback((onChange: () => void) => {
    dismissListeners.add(onChange);
    document.addEventListener("visibilitychange", onChange);
    return () => {
      dismissListeners.delete(onChange);
      document.removeEventListener("visibilitychange", onChange);
    };
  }, []);
  const dismissed = useSyncExternalStore(subscribe, () => dismissedToday(key), () => true);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch {
      /* storage blocked: the dismissal just won't outlive this page */
    }
    dismissListeners.forEach((listener) => listener());
  }, [key]);

  return { dismissed, dismiss };
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

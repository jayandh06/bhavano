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

function stillDismissed(key: string, pauseMs: number): boolean {
  try {
    const at = Number(localStorage.getItem(key));
    return Number.isFinite(at) && at > 0 && Date.now() - at < pauseMs;
  } catch {
    return false;
  }
}

function stamp(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage blocked: the dismissal just won't outlive this render */
  }
}

/** A prompt dismissed "for this visit": hidden while the visitor keeps using the site, back once
 * they return after a pause of `pauseMs`. The localStorage timestamp is the last moment they were
 * seen with it dismissed — refreshed on every navigation and whenever the tab is hidden — so the
 * pause counts from when they left, not from when they tapped ✕.
 *
 * Re-read when the tab becomes visible again, so returning to a tab left open in the background
 * brings the prompt back without needing a navigation. Server: dismissed, so it stays hidden until
 * the client has checked. */
export function useDismissedForVisit(
  key: string,
  pauseMs: number,
  pathname: string,
): { dismissed: boolean; dismiss: () => void } {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const onVisibility = () => {
        if (document.visibilityState === "hidden" && stillDismissed(key, pauseMs)) stamp(key);
        onChange();
      };
      dismissListeners.add(onChange);
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        dismissListeners.delete(onChange);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    },
    [key, pauseMs],
  );
  const dismissed = useSyncExternalStore(subscribe, () => stillDismissed(key, pauseMs), () => true);

  // Re-checks storage rather than trusting `dismissed`: on the hydration pass that is the server
  // value (true), and refreshing then would revive an expired dismissal on every full page load.
  useEffect(() => {
    if (stillDismissed(key, pauseMs)) stamp(key);
  }, [key, pauseMs, pathname]);

  const dismiss = useCallback(() => {
    stamp(key);
    dismissListeners.forEach((listener) => listener());
  }, [key]);

  return { dismissed, dismiss };
}

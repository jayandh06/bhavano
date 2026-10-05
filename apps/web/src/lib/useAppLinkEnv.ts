"use client";

import { useSyncExternalStore } from "react";
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

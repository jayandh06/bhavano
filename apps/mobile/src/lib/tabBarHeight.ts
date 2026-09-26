import { useSyncExternalStore } from "react";

/** The bottom tab bar's measured height (its bottom safe-area padding included).
 *
 * BottomTabBar is a permanent sibling *below* every screen, so a screen's own bottom edge is that
 * far above the physical screen bottom. A keyboard-pinned view (the message composer) that
 * translates by the full keyboard height therefore overshoots by exactly this much, leaving a
 * gap; it subtracts this value to land flush on the keyboard. Kept as a module-level store because
 * the bar and the screens aren't in a parent/child relationship to pass it through props. */
let height = 0;
const listeners = new Set<() => void>();

export function setTabBarHeight(next: number): void {
  if (next === height) return;
  height = next;
  listeners.forEach((l) => l());
}

export function useTabBarHeight(): number {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => height,
    () => 0,
  );
}

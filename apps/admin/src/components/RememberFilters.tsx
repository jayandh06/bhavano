"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { persistableQuery, restoreTarget, storageKey } from "@/lib/rememberedFilters";

/**
 * Keeps each admin screen's filters across visits — see lib/rememberedFilters.ts for the reasoning
 * and the rules.
 *
 * Rendered once in the root layout rather than added to each of the twelve filtered screens: it is
 * keyed by pathname, so one instance covers every screen, including any added later. Screens with
 * no filters never write anything, so they never restore anything either.
 *
 * Renders nothing.
 */
export function RememberFilters() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  /** The pathname this component last ran its effect for, or null before the first run ever.
   * "Hydrated" (the one run allowed to restore) means "this is the first effect run since we
   * arrived at this pathname" — computed as `hydratedPathRef.current !== pathname`, NOT a single
   * boolean. This component is a singleton in the root layout that never unmounts across
   * navigation, so a plain `useRef(false)` here would only ever describe the very first page
   * loaded in the whole session: it flips to `true` on that first run and stays `true` forever,
   * so navigating away and back to an earlier screen would never restore its saved filters —
   * worse, it would fall through to the write branch below and overwrite them with the bare
   * query. Tracking the pathname itself makes "hydrated" reset exactly when the visitor actually
   * arrives at a (possibly revisited) screen, while still reading `true` for same-screen filter
   * changes that don't change the path. */
  const hydratedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const key = storageKey(pathname);
    const currentQuery = searchParams.toString();

    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(key);
    } catch {
      // Storage can throw outright (Safari private mode, blocked site data). Remembering filters is
      // a convenience: if it is unavailable, the screen must still work exactly as before.
      return;
    }

    const hydrated = hydratedPathRef.current === pathname;
    const target = restoreTarget({ pathname, currentQuery, saved, hydrated });
    hydratedPathRef.current = pathname;

    if (target) {
      // `replace`, not `push`: the bare URL the visitor arrived at is not a place they should have
      // to press Back through.
      router.replace(target);
      return;
    }

    try {
      // Written on every run past the first, empty included — that is what makes a deliberate
      // reset stick instead of being undone on the next visit.
      window.localStorage.setItem(key, persistableQuery(currentQuery));
    } catch {
      // Same reasoning as the read above.
    }
  }, [pathname, searchParams, router]);

  return null;
}

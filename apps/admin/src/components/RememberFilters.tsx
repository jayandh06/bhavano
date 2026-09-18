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
  /** False until the first effect run for this mounted screen — the one run allowed to restore. */
  const hydratedRef = useRef(false);

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

    const target = restoreTarget({ pathname, currentQuery, saved, hydrated: hydratedRef.current });
    hydratedRef.current = true;

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

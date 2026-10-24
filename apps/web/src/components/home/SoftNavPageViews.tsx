"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sanitizePageViewQuery } from "@bhavano/types/pageViewQuery";

/**
 * Records soft `<Link>` / `router.push` navigations into the same PageView trail that middleware
 * writes for full document loads.
 *
 * Middleware only counts `Sec-Fetch-Dest: document` (see analytics-bot-filtering-and-attribution.md):
 * a real in-app click is an RSC request (`empty`) and was previously invisible, so a poster who
 * opened /post from the header never showed `/post` in Page visits. This fills that gap.
 *
 * The first pathname after mount is skipped — that page was already logged by middleware on the
 * document load that brought the visitor here. Only later pathname changes are pinged. Same-path
 * within 2s is still dropped by AnalyticsService.recordPageView's dedupe.
 *
 * Renders nothing; mounted in the root layout next to JsConfirmation so every route is covered
 * without wrapping page content in a client boundary.
 */
export function SoftNavPageViews() {
  const pathname = usePathname();
  // Filter changes on the same page (a bedrooms chip, a price) only change the query string, so
  // the trail watches that too. Cleaned of ad ids and tokens before it leaves the browser.
  const query = sanitizePageViewQuery(useSearchParams().toString());
  const lastRecorded = useRef<string | null>(null);
  const pastFirstPaint = useRef(false);

  useEffect(() => {
    if (!pathname) return;

    const here = query ? `${pathname}?${query}` : pathname;
    if (!pastFirstPaint.current) {
      pastFirstPaint.current = true;
      lastRecorded.current = here;
      return;
    }

    if (lastRecorded.current === here) return;
    lastRecorded.current = here;

    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, query: query ?? undefined }),
      keepalive: true,
    }).catch(() => {
      // Offline or navigated away mid-flight — same stance as JsConfirmation.
    });
  }, [pathname, query]);

  return null;
}

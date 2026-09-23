"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

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
  const lastRecorded = useRef<string | null>(null);
  const pastFirstPaint = useRef(false);

  useEffect(() => {
    if (!pathname) return;

    if (!pastFirstPaint.current) {
      pastFirstPaint.current = true;
      lastRecorded.current = pathname;
      return;
    }

    if (lastRecorded.current === pathname) return;
    lastRecorded.current = pathname;

    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {
      // Offline or navigated away mid-flight — same stance as JsConfirmation.
    });
  }, [pathname]);

  return null;
}

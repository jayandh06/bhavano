"use client";

import { useEffect } from "react";

/** Reports the pages whose real-visitor layout shift is bad, with the elements that moved.
 *
 * PageSpeed's field data (28 days, Chrome users) put mobile CLS at 0.59 while every lab run and a scripted phone-size scroll of the
 * homepage show ~0, so the cause is something that only happens to real visitors. This records it: when a visitor leaves a page
 * whose shifts add up to 0.1 or more (the "needs improvement" line), it sends the total, the path and the few biggest shifts' elements.
 * Nothing else is sent: no query string, cookies, ids from forms or text typed. See docs/plans/layout-shift-reporter.md.
 *
 * Renders nothing and is a leaf, so nothing moves out of the server-rendered output. */
const REPORT_AT = 0.1;
const MAX_SOURCES = 5;

type ShiftEntry = PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node | null }[] };

/** `div#id.class1.class2`, short: enough to find the element in the code, never its text. */
function describe(node: Node | null | undefined): string {
  if (!node || node.nodeType !== 1) return "?";
  const el = node as Element;
  const classes = (typeof el.className === "string" ? el.className : "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${classes ? `.${classes}` : ""}`.slice(0, 120);
}

export function LayoutShiftReporter() {
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes?.includes("layout-shift")) return;

    let total = 0;
    let sent = false;
    const worst: { value: number; at: number; sources: string[] }[] = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as ShiftEntry[]) {
        if (entry.hadRecentInput) continue;
        total += entry.value;
        worst.push({ value: Math.round(entry.value * 1000) / 1000, at: Math.round(entry.startTime), sources: (entry.sources ?? []).slice(0, 2).map((s) => describe(s.node)) });
        worst.sort((a, b) => b.value - a.value);
        worst.length = Math.min(worst.length, MAX_SOURCES);
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });

    const report = () => {
      if (sent || document.visibilityState !== "hidden" || total < REPORT_AT) return;
      sent = true;
      const body = JSON.stringify({
        cls: Math.round(total * 1000) / 1000,
        path: window.location.pathname,
        width: window.innerWidth,
        shifts: worst,
      });
      try {
        navigator.sendBeacon("/api/web-vitals/cls", new Blob([body], { type: "application/json" }));
      } catch {
        // A dropped report is fine.
      }
    };
    document.addEventListener("visibilitychange", report);
    window.addEventListener("pagehide", report);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", report);
      window.removeEventListener("pagehide", report);
    };
  }, []);

  return null;
}

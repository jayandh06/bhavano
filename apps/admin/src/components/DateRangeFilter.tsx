"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { str, type SearchParams } from "@/lib/searchParams";
import { daysAgoIST, todayIST } from "@/lib/dateRangeDefaults";

const PRESETS = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "15 days", days: 15 },
  { label: "30 days", days: 30 },
] as const;

/** Quick date-range presets (1/7/15/30 days + Custom) for any admin list screen's filter form.
 *
 * Each preset is a plain navigating link, carrying every other current filter forward — clicking
 * one applies immediately, no separate "Apply" click needed, the same way `buildPageHref` already
 * builds hrefs elsewhere in this app. `prefetch={false}` matches this app's established
 * convention for links whose target the visitor might already effectively be on (see
 * AdminNav.tsx's comment) — a preset link always carries a real query so it's not vulnerable to
 * the bare-URL ambiguity that convention was originally about, but there's still no reason to let
 * Next speculatively fire off up to four background writes to the remembered-filters cookie for
 * presets nobody clicked.
 *
 * "Custom" never navigates by itself — it only toggles local visibility of `children` (the page's
 * own native `<input type="date">` pair), which the visitor then submits via the form's existing
 * "Apply filters" button. This component doesn't own those inputs itself: each page keeps its own
 * field labels/styling and just passes them in, so this stays a thin wrapper rather than a second
 * source of truth for the date fields.
 *
 * When a preset is active the date inputs are unmounted (Custom isn't showing). Without a
 * stand-in, "Apply filters" would omit `from`/`to` entirely and the page's silent 1-day default
 * would take over — so picking "7 days" then changing any other filter looked like the date
 * preset "didn't stick". Hidden inputs keep the active range in the form submit.
 */
export function DateRangeFilter({
  basePath,
  sp,
  currentFrom,
  currentTo,
  fromParam = "from",
  toParam = "to",
  children,
}: {
  basePath: string;
  sp: SearchParams;
  /** The page's own effective from/to — already defaulted to the 1-day window when the URL
   * carries neither, so "1 day" highlights correctly even on a first, param-less visit. */
  currentFrom: string;
  currentTo: string;
  fromParam?: string;
  toParam?: string;
  children: React.ReactNode;
}) {
  const matchedPreset = PRESETS.find(
    (p) => daysAgoIST(p.days) === currentFrom && todayIST() === currentTo,
  );
  // Local-only: lets a click on "Custom" reveal the date inputs immediately, before any
  // navigation happens (there may be none — Custom edits the same URL a preset would, but only
  // once "Apply filters" is actually pressed).
  const [customToggled, setCustomToggled] = useState(false);
  const showCustomFields = customToggled || !matchedPreset;

  function hrefForPreset(days: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "page" || key === fromParam || key === toParam) continue;
      const v = str(value);
      if (v) params.set(key, v);
    }
    params.set(fromParam, daysAgoIST(days));
    params.set(toParam, todayIST());
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {PRESETS.map((p) => (
          <Link key={p.label} href={hrefForPreset(p.days)} prefetch={false} style={{ textDecoration: "none" }}>
            <PresetPill label={p.label} active={!showCustomFields && matchedPreset?.label === p.label} />
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setCustomToggled(true)}
          style={{ ...pillStyle(showCustomFields), cursor: "pointer", border: "1px solid var(--border)" }}
        >
          Custom
        </button>
      </div>
      {showCustomFields ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{children}</div>
      ) : (
        <>
          <input type="hidden" name={fromParam} value={currentFrom} />
          <input type="hidden" name={toParam} value={currentTo} />
        </>
      )}
    </div>
  );
}

/** Lives inside the <Link> so `useLinkStatus` can see that link's navigation. A preset re-renders
 * the whole screen on the server (the listings query can take seconds on a cold start), and until
 * that answers nothing on the page changes — no URL, no highlight, no spinner — so a click read as
 * "didn't work" and the natural reaction was to click again. Showing the pill as selected the
 * instant it's pressed (with an ellipsis until the new range arrives) answers "did it register?"
 * immediately. */
function PresetPill({ label, active }: { label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span style={{ ...pillStyle(active || pending), display: "inline-block", opacity: pending ? 0.75 : 1 }}>
      {label}
      {pending ? "…" : ""}
    </span>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 12.5,
    fontWeight: 700,
    padding: "6px 12px",
    borderRadius: 20,
    textDecoration: "none",
    background: active ? "var(--green)" : "var(--surface)",
    color: active ? "var(--on-green)" : "var(--text-soft)",
    border: `1px solid ${active ? "var(--green)" : "var(--border)"}`,
  };
}

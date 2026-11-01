import type { CSSProperties } from "react";

/** Row highlights shared by the admin Page visits, Listings and Users screens, so one colour always means one thing.
 * Strongest first: a row takes the colour of the most valuable thing about it, and every applicable badge still shows.
 * Colours are translucent so they read on the page background. See docs/plans/admin-page-visit-highlights.md. */
export const HIGHLIGHT_STYLES = {
  activePurchase: { tint: "rgba(11, 61, 46, 0.16)", edge: "#0b3d2e", label: "Active purchase", hint: "Holds a paid boost, alert or plan right now" },
  purchased: { tint: "rgba(11, 61, 46, 0.07)", edge: "#4f8a73", label: "Purchased", hint: "This account has paid at least once" },
  featured: { tint: "rgba(201, 161, 90, 0.22)", edge: "#c9a15a", label: "Featured", hint: "Featured now (a running boost), or an ad from this visit that was" },
  featuredPast: { tint: "rgba(201, 161, 90, 0.10)", edge: "#dcc791", label: "Was featured", hint: "Was featured before; the boost has ended" },
  ad: { tint: "rgba(60, 110, 170, 0.10)", edge: "#3c6eaa", label: "Ad posted", hint: "An ad from this visit is live or on its way to going live" },
} as const;

export type HighlightKey = keyof typeof HIGHLIGHT_STYLES;

/** The row's own style for its strongest highlight, or nothing when none applies. `keys` must be ordered strongest first. */
export function rowHighlightStyle(keys: HighlightKey[]): CSSProperties {
  if (keys.length === 0) return {};
  const top = HIGHLIGHT_STYLES[keys[0]];
  return { background: top.tint, boxShadow: `inset 4px 0 0 ${top.edge}` };
}

/** One pill. `text` overrides the default label ("Featured now", "Ad in pipeline"). */
export function HighlightBadge({ highlight, text }: { highlight: HighlightKey; text?: string }) {
  const style = HIGHLIGHT_STYLES[highlight];
  return (
    <span
      title={style.hint}
      style={{
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        padding: "3px 6px",
        borderRadius: 999,
        border: `1px solid ${style.edge}`,
        color: "var(--text)",
        background: "var(--surface)",
        whiteSpace: "nowrap",
      }}
    >
      {text ?? style.label}
    </span>
  );
}

/** The colour key above a table: only the colours that screen uses. */
export function HighlightLegend({ keys, labels }: { keys: HighlightKey[]; labels?: Partial<Record<HighlightKey, string>> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>
      <span style={{ fontWeight: 700 }}>Row colours</span>
      {keys.map((key) => (
        <span key={key} title={HIGHLIGHT_STYLES[key].hint} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: HIGHLIGHT_STYLES[key].tint, borderLeft: `4px solid ${HIGHLIGHT_STYLES[key].edge}` }} />
          {labels?.[key] ?? HIGHLIGHT_STYLES[key].label}
        </span>
      ))}
    </div>
  );
}

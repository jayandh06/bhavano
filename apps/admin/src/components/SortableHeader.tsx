import Link from "next/link";

/** A column header that sorts the table by that column — clicking toggles ascending/descending,
 * as a full-page navigation like every other filter on these admin pages, since the server owns
 * the order (pagination needs it sorted server-side regardless).
 *
 * Takes a finished `href` and `direction` rather than building them, because the two admin tables
 * that use this encode sort differently in the URL: outreach contacts use the `-field` shorthand
 * (buildSortHref/sortDirectionFor), page visits use `field_desc` to match the BFF's own validated
 * sort enum (buildSuffixSortHref/suffixSortDirectionFor). Only the visual is shared.
 */
export function SortableHeader({
  label,
  href,
  direction,
}: {
  label: string;
  href: string;
  /** `null` when the table is sorted by some other column — renders the neutral ↕ affordance, so
   * every sortable column still looks clickable. */
  direction: "asc" | "desc" | null;
}) {
  return (
    <Link
      href={href}
      // Every sortable column on a table renders one of these — 9+ on Page visits alone — and
      // Next's <Link> proactively prefetches every one the moment it's visible, each one a real
      // request (sometimes two, since a dynamic route with no loading.tsx boundary can get a
      // partial prefetch pass followed by a fuller one). Each prefetch's target already carries
      // the real current filter + that column's sort (harmless data-wise, see
      // rememberedFilters.ts's decideFilterAction), but there's no reason to pay for up to a
      // couple dozen background requests nobody asked for just because the headers are on screen.
      prefetch={false}
      style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
    >
      {label}
      <span style={{ color: direction ? "var(--text)" : "var(--muted)", fontSize: 10 }}>
        {direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕"}
      </span>
    </Link>
  );
}

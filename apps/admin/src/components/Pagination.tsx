import Link from "next/link";

/** Numbered pagination for the admin list pages — every page a real `<a href>`, no client JS
 * needed to jump around. Modeled on `apps/web/src/components/home/Pagination.tsx`'s shape
 * (`buildHref` callback so each caller controls its own URL shape, same ellipsis-collapsing
 * logic), restyled with this app's inline `React.CSSProperties` convention instead of Tailwind —
 * `apps/admin` has no shared `Icon` component, so prev/next use plain arrow characters, matching
 * the "← Back to dashboard" / "Load more →" links already used throughout this app. */

function pageNumbersToShow(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("ellipsis");
    result.push(sorted[i]);
  }
  return result;
}

const pageButtonStyle = (active: boolean): React.CSSProperties => ({
  minWidth: 34,
  height: 34,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  background: active ? "var(--green)" : "var(--surface)",
  color: active ? "var(--on-green)" : "var(--text-soft)",
  border: `1px solid ${active ? "var(--green)" : "var(--border)"}`,
});

const adjacentButtonStyle: React.CSSProperties = {
  minWidth: 34,
  height: 34,
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  background: "var(--surface)",
  color: "var(--green)",
  border: "1px solid var(--green)",
};

export function Pagination({
  currentPage,
  totalPages,
  buildHref,
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap", marginTop: 24 }}
    >
      {currentPage > 1 && (
        <Link href={buildHref(currentPage - 1)} aria-label="Previous page" style={adjacentButtonStyle}>
          ← Prev
        </Link>
      )}

      {pageNumbersToShow(currentPage, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} style={{ fontSize: 13, color: "var(--muted)", padding: "0 4px" }}>
            …
          </span>
        ) : (
          <Link key={p} href={buildHref(p)} style={pageButtonStyle(p === currentPage)}>
            {p}
          </Link>
        ),
      )}

      {currentPage < totalPages && (
        <Link href={buildHref(currentPage + 1)} aria-label="Next page" style={adjacentButtonStyle}>
          Next →
        </Link>
      )}
    </nav>
  );
}

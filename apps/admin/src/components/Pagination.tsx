import Link from "next/link";
import { AutoSubmitSelect } from "./AutoSubmitSelect";
import {
  DEFAULT_PAGE_PARAM_NAMES,
  PAGE_SIZE_OPTIONS,
  carriedValue,
  str,
  type PageParamNames,
  type SearchParams,
} from "@/lib/searchParams";

/** Numbered pagination + page-size selector for the admin list pages, together at the bottom of
 * the results — every page a real `<a href>`, no client JS needed to jump around. Modeled on
 * `apps/web/src/components/home/Pagination.tsx`'s shape (`buildHref` callback so each caller
 * controls its own URL shape, same ellipsis-collapsing logic), restyled with this app's inline
 * `React.CSSProperties` convention instead of Tailwind — `apps/admin` has no shared `Icon`
 * component, so prev/next use plain arrow characters, matching the "← Back to dashboard" /
 * "Load more →" links already used throughout this app.
 *
 * The size selector lives here, not in each page's own filter `<form>` up top, so changing it
 * doesn't require scrolling back to the top of a long results list. It submits its own small
 * `<form>` (a size change isn't `<Link>`-navigable) carrying every other current query param
 * forward as a hidden field — `sp` minus `page`/`limit` themselves, the same "leave `page` out so
 * it resets to 1" rule `buildPageHref` uses for the page-number links beside it. No `action`
 * attribute: a GET form with none submits to the current path, which is already this page's own
 * URL for every caller. */

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

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 13,
  background: "var(--surface)",
  color: "var(--text)",
};

export function Pagination({
  currentPage,
  totalPages,
  buildHref,
  pageSize,
  sp,
  paramNames = DEFAULT_PAGE_PARAM_NAMES,
  formId,
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
  pageSize: number;
  sp: SearchParams;
  /** Which query-param names this instance owns — override when a page has more than one
   * `<Pagination>` so they don't collide over the same `?page=`/`?limit=` keys. */
  paramNames?: PageParamNames;
  /** Id of the screen's filter `<form>`. When given, the page buttons SUBMIT that form (with `page` set) instead of
   * following a link built from the URL, so whatever is typed or picked in the form but not yet applied comes along
   * — a link can only carry what is already in the URL, which made paging ignore unapplied filters until "Apply
   * filters" was pressed. */
  formId?: string;
}) {
  const control = (p: number, content: React.ReactNode, style: React.CSSProperties, ariaLabel?: string) =>
    formId ? (
      <button
        key={`page-${p}-${ariaLabel ?? ""}`}
        type="submit"
        form={formId}
        name={paramNames.page}
        value={String(p)}
        aria-label={ariaLabel}
        style={{ ...style, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 700 }}
      >
        {content}
      </button>
    ) : (
      <Link key={p} href={buildHref(p)} prefetch={false} aria-label={ariaLabel} style={style}>
        {content}
      </Link>
    );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        flexWrap: "wrap",
        marginTop: 24,
      }}
    >
      {totalPages > 1 && (
        <nav aria-label="Pagination" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* prefetch={false} on every link here — same reasoning as SortableHeader.tsx: with up
            * to 7 page numbers plus Prev/Next all visible at once, proactively prefetching every
            * one is pure waste, not a correctness issue (each target already carries the real
            * current filters). */}
          {currentPage > 1 && control(currentPage - 1, "← Prev", adjacentButtonStyle, "Previous page")}

          {pageNumbersToShow(currentPage, totalPages).map((p, i) =>
            p === "ellipsis" ? (
              <span key={`ellipsis-${i}`} style={{ fontSize: 13, color: "var(--muted)", padding: "0 4px" }}>
                …
              </span>
            ) : (
              control(p, p, pageButtonStyle(p === currentPage))
            ),
          )}

          {currentPage < totalPages && (
            <Link href={buildHref(currentPage + 1)} prefetch={false} aria-label="Next page" style={adjacentButtonStyle}>
              Next →
            </Link>
          )}
        </nav>
      )}

      <form method="get" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {Object.entries(sp).map(([key, value]) => {
          if (key === paramNames.page || key === paramNames.limit) return null;
          const v = carriedValue(key, value);
          return v !== undefined ? <input key={key} type="hidden" name={key} value={v} /> : null;
        })}
        <label style={{ fontSize: 12, color: "var(--muted)" }}>Per page</label>
        <AutoSubmitSelect
          name={paramNames.limit}
          defaultValue={String(pageSize)}
          style={selectStyle}
          options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
        />
      </form>
    </div>
  );
}

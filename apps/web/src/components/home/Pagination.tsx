/** Server-rendered numbered pagination — every entry a real `<a href>`, no client JS, so
 * Googlebot can follow it directly (see docs/plans/seo-distinct-window-pagination.md). Callers
 * supply `buildHref` so this component stays agnostic to how each caller's URL is shaped (the SEO
 * browse pages vs. the homepage build paths differently). */

import Link from "next/link";
import { Icon } from "./Icon";

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

const pageButtonClass = (active: boolean) =>
  `min-w-9 h-9 flex items-center justify-center rounded-lg text-sm font-semibold ${
    active ? "bg-green text-on-green" : "bg-surface text-text-soft border border-border"
  }`;

// Prev/Next: larger than the numbered page buttons and border-2 in the brand green, so they read
// as the primary way to move through results rather than blending into the page-number row.
const adjacentButtonClass =
  "w-11 h-11 flex items-center justify-center rounded-full text-lg font-bold bg-surface text-green border-2 border-green hover:bg-green hover:text-on-green transition-colors";

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
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 flex-wrap mt-9">
      {currentPage > 1 && (
        <Link href={buildHref(currentPage - 1)} aria-label="Previous page" className={adjacentButtonClass}>
          <Icon name="chevronLeft" />
        </Link>
      )}

      {pageNumbersToShow(currentPage, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="text-sm text-muted px-1">
            …
          </span>
        ) : (
          <Link key={p} href={buildHref(p)} className={pageButtonClass(p === currentPage)}>
            {p}
          </Link>
        ),
      )}

      {currentPage < totalPages && (
        <Link href={buildHref(currentPage + 1)} aria-label="Next page" className={adjacentButtonClass}>
          <Icon name="chevronRight" />
        </Link>
      )}
    </nav>
  );
}

/** Server-rendered numbered pagination — every entry a real `<a href>`, no client JS, so
 * Googlebot can follow it directly (see docs/plans/seo-distinct-window-pagination.md). Callers
 * supply `buildHref` so this component stays agnostic to how each caller's URL is shaped (the SEO
 * browse pages vs. the homepage build paths differently). */

import Link from "next/link";

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
        <Link href={buildHref(currentPage - 1)} className={pageButtonClass(false)}>
          ← Prev
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
        <Link href={buildHref(currentPage + 1)} className={pageButtonClass(false)}>
          Next →
        </Link>
      )}
    </nav>
  );
}

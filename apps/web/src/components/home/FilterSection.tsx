"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Area, ListingCategory } from "@bhavano/types";
import type { HomeTabValue } from "@/lib/homeCategories";
import type { ParsedSegments } from "@/lib/seoRoute";
import { buildAppliedUrl, buildResetUrl, draftIssue, type FilterBase, type FilterDraft } from "@/lib/filterApply";
import { Icon } from "./Icon";

interface FilterSectionValue {
  base: FilterBase;
  /** What the visitor has changed but not applied yet. Empty once applied or after the URL changes. */
  draft: FilterDraft;
  /** Merges a change into the draft. Nothing is searched. */
  update: (patch: Partial<FilterDraft>) => void;
}

const FilterSectionContext = createContext<FilterSectionValue | null>(null);

export function useFilterSection(): FilterSectionValue {
  const value = useContext(FilterSectionContext);
  if (!value) throw new Error("useFilterSection must be used inside <FilterSection>");
  return value;
}

/** The filter strip on the browse pages and the homepage: the "Filters" label, the filter dropdowns, and one **Apply** and one **Reset** for all of them.
 *
 * Picking something in any dropdown only changes a draft held here. Apply writes every pending change in one navigation (`buildAppliedUrl`), so several
 * filters change with a single search; Reset clears every filter. Neither lives inside an individual filter. The draft is dropped whenever the page's URL
 * changes (after Apply, or when a tab or link is used), so it can never show stale picks. Apply is off until something changed and while the draft is not
 * allowed (no area, no BHK, a price that does not parse), and the reason is shown beside it. */
export function FilterSection({
  urlMode,
  cityName,
  areas,
  segments,
  pathAreaName,
  intent,
  category,
  children,
}: {
  urlMode: "path" | "query";
  cityName?: string;
  areas: Area[];
  segments?: ParsedSegments;
  pathAreaName?: string;
  intent: HomeTabValue;
  category?: ListingCategory;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const urlKey = `${pathname}?${search}`;
  const [state, setState] = useState<{ urlKey: string; draft: FilterDraft }>({ urlKey, draft: {} });
  // A draft belongs to the URL it was started on; once the URL moves on it no longer applies.
  const draft = state.urlKey === urlKey ? state.draft : {};

  const base: FilterBase = useMemo(
    () => ({ urlMode, cityName, areas, segments, pathAreaName, intent, category, search }),
    [urlMode, cityName, areas, segments, pathAreaName, intent, category, search],
  );

  const value: FilterSectionValue = {
    base,
    draft,
    update: (patch) => setState({ urlKey, draft: { ...draft, ...patch } }),
  };

  const currentUrl = buildAppliedUrl(base, {});
  const appliedUrl = buildAppliedUrl(base, draft);
  const issue = draftIssue(draft);
  const dirty = appliedUrl !== currentUrl;
  const resetUrl = buildResetUrl(base);
  // Something is narrowing the results now (or is about to be): offer Reset.
  const resettable = dirty || resetUrl !== currentUrl;

  function apply() {
    if (!dirty || issue) return;
    setState({ urlKey, draft: {} });
    router.push(appliedUrl);
  }

  function reset() {
    setState({ urlKey, draft: {} });
    if (resetUrl !== currentUrl) router.push(resetUrl);
  }

  return (
    <FilterSectionContext.Provider value={value}>
      {/* Its own surface-alt panel rather than sitting directly on the page bg — this row is a distinct control surface (narrowing the results below),
        * not page content. The label belongs to the row rather than to any one pill. */}
      <div className="flex gap-2.5 mb-3 flex-wrap items-start bg-surface-alt border border-border rounded-xl p-2.5">
        <span className="flex items-center gap-1.5 self-center pl-0.5 text-[13px] font-semibold text-muted" aria-hidden>
          <Icon name="filter" /> Filters
        </span>
        <div className="flex gap-2.5 flex-wrap">{children}</div>
        <div className="ml-auto flex items-center gap-2 self-center">
          {issue && <span className="text-[12px] text-muted">{issue}</span>}
          {resettable && (
            <button
              type="button"
              onClick={reset}
              className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-text-soft"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={apply}
            disabled={!dirty || !!issue}
            className={`rounded-lg border-0 bg-green px-3.5 py-2 text-[13px] font-bold text-on-green ${
              dirty && !issue ? "cursor-pointer" : "cursor-default opacity-50"
            }`}
          >
            Apply
          </button>
        </div>
      </div>
    </FilterSectionContext.Provider>
  );
}

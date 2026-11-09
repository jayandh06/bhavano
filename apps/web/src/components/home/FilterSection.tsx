"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Area, ListingCategory } from "@bhavano/types";
import type { HomeTabValue } from "@/lib/homeCategories";
import type { ParsedSegments } from "@/lib/seoRoute";
import { activeFilterCount, buildAppliedUrl, buildResetUrl, draftIssue, type FilterBase, type FilterDraft } from "@/lib/filterApply";
import { Icon } from "./Icon";

interface FilterSectionValue {
  base: FilterBase;
  /** What the visitor has changed but not applied yet. Empty once applied or after the URL changes. */
  draft: FilterDraft;
  /** Merges a change into the draft. Nothing is searched. */
  update: (patch: Partial<FilterDraft>) => void;
  /** Drops every pending change. */
  clearDraft: () => void;
  /** Whether the filter panel is showing (the Filters button toggles it). */
  open: boolean;
  toggle: () => void;
  /** How many filters the URL applies right now, for the button's "Filters (3)". */
  count: number;
  /** False when this page has nothing to filter (the All tab with no city), so neither the button nor the panel render. */
  enabled: boolean;
}

const FilterSectionContext = createContext<FilterSectionValue | null>(null);

export function useFilterSection(): FilterSectionValue {
  const value = useContext(FilterSectionContext);
  if (!value) throw new Error("useFilterSection must be used inside <FilterProvider>");
  return value;
}

/** State for the filters on the homepage and the browse pages: which are applied (read from the URL), what is pending (the draft), and whether the panel is open.
 * It wraps both the **Filters** button (`FiltersButton`, which sits in the row before Sort) and the panel (`FilterPanel`, which opens under that row), so they share it.
 *
 * Picking something in any dropdown only changes the draft. The panel's one **Apply** writes every pending change in one navigation (`buildAppliedUrl`), so several
 * filters change with a single search; **Reset** clears every filter. The draft is dropped whenever the page's URL changes (after Apply, or when a tab or link is used), so it
 * can never show stale picks. Apply is off until something changed and while the draft is not allowed (no area, no BHK, a price that does not parse), and the reason is shown
 * beside it. `defaultOpen` shows the panel at the start, for the state where it is the only way forward (no area picked). */
export function FilterProvider({
  urlMode,
  cityName,
  areas,
  segments,
  pathAreaName,
  intent,
  category,
  enabled = true,
  defaultOpen = false,
  children,
}: {
  urlMode: "path" | "query";
  cityName?: string;
  areas: Area[];
  segments?: ParsedSegments;
  pathAreaName?: string;
  intent: HomeTabValue;
  category?: ListingCategory;
  enabled?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const urlKey = `${pathname}?${search}`;
  const [state, setState] = useState<{ urlKey: string; draft: FilterDraft }>({ urlKey, draft: {} });
  const [open, setOpen] = useState(defaultOpen);
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
    clearDraft: () => setState({ urlKey, draft: {} }),
    open,
    toggle: () => setOpen((o) => !o),
    count: activeFilterCount(base),
    enabled,
  };

  return <FilterSectionContext.Provider value={value}>{children}</FilterSectionContext.Provider>;
}

/** The "Filters" button, same look as Finfolia's: outlined with a filter icon, filled while the panel is open, and "Filters (3)" once anything is applied. Place it in the
 * row before Sort. */
export function FiltersButton() {
  const { open, toggle, count, enabled } = useFilterSection();
  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] font-semibold cursor-pointer ${
        open ? "border-green bg-green text-on-green" : "border-border bg-surface text-text-soft"
      }`}
    >
      <Icon name="filter" /> {count > 0 ? `Filters (${count})` : "Filters"}
    </button>
  );
}

/** The panel that opens under the Filters button: the filter dropdowns (children) and one **Apply** and one **Reset** for all of them. Renders nothing while closed. */
export function FilterPanel({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { base, draft, clearDraft, open, enabled } = useFilterSection();
  if (!enabled || !open) return null;

  const currentUrl = buildAppliedUrl(base, {});
  const appliedUrl = buildAppliedUrl(base, draft);
  const issue = draftIssue(draft);
  const dirty = appliedUrl !== currentUrl;
  const resetUrl = buildResetUrl(base);
  // Something is narrowing the results now (or is about to be): offer Reset.
  const resettable = dirty || resetUrl !== currentUrl;

  function apply() {
    if (!dirty || issue) return;
    clearDraft();
    router.push(appliedUrl);
  }

  function reset() {
    clearDraft();
    if (resetUrl !== currentUrl) router.push(resetUrl);
  }

  return (
    // Its own surface-alt panel rather than sitting directly on the page bg — this is a distinct control surface (narrowing the results below), not page content.
    <div className="flex gap-2.5 mb-3 flex-wrap items-start bg-surface-alt border border-border rounded-xl p-2.5">
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
          className={`rounded-lg border-0 bg-green px-3.5 py-2 text-[13px] font-bold text-on-green ${dirty && !issue ? "cursor-pointer" : "cursor-default opacity-50"}`}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

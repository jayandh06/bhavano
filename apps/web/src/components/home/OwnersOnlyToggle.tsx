"use client";

import { buttonClass } from "./BrowseFilterBar";
import { useFilterSection } from "./FilterSection";

/** "Owners only" pill for the Buy / Rent & Lease filter rows — `?postedBy=owner`, a query-param filter, so the canonical stays the plain path. Like every filter it
 * only changes the filter section's draft; Apply searches (and returns to page 1, since the filtered result set has its own page count). `active` is what the URL says now. */
export function OwnersOnlyToggle({ active }: { active: boolean }) {
  const { draft, update } = useFilterSection();
  const shown = draft.query && "postedBy" in draft.query ? draft.query.postedBy === "owner" : active;

  return (
    <button className={buttonClass(shown)} onClick={() => update({ query: { ...draft.query, postedBy: shown ? undefined : "owner" } })} aria-pressed={shown}>
      {shown ? "✓ " : ""}Owners only
    </button>
  );
}

/**
 * How "no area selected" is carried in the URL.
 *
 * `?areas=` absent means *all* areas (no narrowing), which is the default and why it can't also
 * mean none. An explicitly empty value is no good either: `searchParams.get("areas")` returns
 * `""` for it, which is falsy and so reads as absent. Hence a sentinel.
 *
 * It exists because unchecking the last area used to silently re-check the first one — a control
 * that quietly undoes what you just did. Now the state is real, and the page says "select at
 * least one area to search" instead of showing a result set the visitor didn't ask for.
 */
export const AREAS_NONE = "none";

export interface AreaSelectionFromUrl {
  /** The ids to filter by, or undefined for "all areas" — passed straight to `ListingsQuery`. */
  areaIds: string[] | undefined;
  /** True when the visitor has deliberately unchecked everything. Callers must skip the listings
   * fetch entirely (there is nothing to ask for) and render the prompt instead — including *not*
   * rendering the empty-search requirement capture, which would otherwise read as "we have no
   * inventory here" when the real answer is "you haven't picked an area yet". */
  noneSelected: boolean;
}

export function parseAreaSelection(raw: string | string[] | undefined): AreaSelectionFromUrl {
  const value = typeof raw === "string" ? raw : undefined;
  if (value === AREAS_NONE) return { areaIds: undefined, noneSelected: true };
  const areaIds = value ? value.split(",").filter(Boolean) : undefined;
  return { areaIds: areaIds && areaIds.length > 0 ? areaIds : undefined, noneSelected: false };
}

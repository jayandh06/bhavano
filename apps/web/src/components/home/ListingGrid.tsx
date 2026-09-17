import type { CreateRequirementInput, ListingCardDto } from "@bhavano/types";
import { ListingCard } from "./ListingCard";
import { RequirementPrompt } from "./RequirementPrompt";

export function ListingGrid({
  items,
  requirement,
}: {
  items: ListingCardDto[];
  /** The current search, for the zero-results prompt. Omit it and the empty state stays the
   * plain message — used where there is no single coherent search to capture. */
  requirement?: {
    criteria: Omit<CreateRequirementInput, "searchLabel">;
    label: string;
    /** City-scoped `/post` link for the card's secondary action. */
    postAdHref?: string;
  };
}) {
  // Now that the footer sticks to the bottom of the viewport regardless of content height, a
  // zero-result page would otherwise be a large blank void between the filters and the footer —
  // this fills that space with an actual message instead of empty space.
  //
  // And when we know what was searched for, the void becomes the highest-intent moment on the
  // site rather than the point where someone leaves: they have just told us exactly what they
  // want, so ask for it instead of only apologising. See
  // docs/plans/property-requirements-demand-side.md.
  if (items.length === 0) {
    if (requirement) {
      return (
        <RequirementPrompt
          criteria={requirement.criteria}
          label={requirement.label}
          postAdHref={requirement.postAdHref}
        />
      );
    }
    return <p className="text-muted text-sm py-10 text-center">No listings match your filters — try adjusting or clearing them.</p>;
  }

  return (
    // minmax(min(340px,100%), …) so a card never overflows a narrow phone viewport — the
    // auto-fill grid collapses to a single full-width column below ~340px on its own.
    <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">
      {items.map((item) => (
        <ListingCard key={item.id} item={item} />
      ))}
    </div>
  );
}

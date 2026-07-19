import type { ListingCardDto } from "@bhavano/types";
import { ListingCard } from "./ListingCard";

export function ListingGrid({ items, cityName }: { items: ListingCardDto[]; cityName: string }) {
  // Now that the footer sticks to the bottom of the viewport regardless of content height, a
  // zero-result page would otherwise be a large blank void between the filters and the footer —
  // this fills that space with an actual message instead of empty space.
  if (items.length === 0) {
    return <p className="text-muted text-sm py-10 text-center">No listings match your filters — try adjusting or clearing them.</p>;
  }

  return (
    // minmax(min(340px,100%), …) so a card never overflows a narrow phone viewport — the
    // auto-fill grid collapses to a single full-width column below ~340px on its own.
    <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">
      {items.map((item) => (
        <ListingCard key={item.id} item={item} cityName={cityName} />
      ))}
    </div>
  );
}

import type { ListingCardDto } from "@bhavano/types";
import { ListingCard } from "./ListingCard";

export function ListingGrid({ items, cityName }: { items: ListingCardDto[]; cityName: string }) {
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

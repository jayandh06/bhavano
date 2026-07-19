import Link from "next/link";
import type { ListingCardDto } from "@bhavano/types";
import { ListingCard } from "./ListingCard";

export function ListingGrid({
  items,
  cityName,
  loadMoreHref,
}: {
  items: ListingCardDto[];
  cityName: string;
  loadMoreHref: string | null;
}) {
  return (
    <>
      {/* minmax(min(340px,100%), …) so a card never overflows a narrow phone viewport — the
          auto-fill grid collapses to a single full-width column below ~340px on its own. */}
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">
        {items.map((item) => (
          <ListingCard key={item.id} item={item} cityName={cityName} />
        ))}
      </div>

      {loadMoreHref && (
        <div className="flex justify-center mt-9">
          <Link
            href={loadMoreHref}
            className="bg-surface border-[1.5px] border-green text-green rounded-[10px] px-8 py-[13px] text-sm font-bold"
          >
            Load more listings
          </Link>
        </div>
      )}
    </>
  );
}

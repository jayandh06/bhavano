import type { ListingCardDto } from "@bhavano/types";
import { ListingCard } from "./ListingCard";
import { Icon } from "./Icon";

/**
 * A horizontal showcase of boosted listings above the main grid — a boosted listing's only
 * homepage-wide treatment used to be a badge plus a shot at the main feed's featured-cap slots
 * (`docs/plans/homepage-category-mix-and-boost-page-cap.md`), which still competes with
 * everything else for attention inside one grid. This gives every rail slot its own dedicated,
 * unmissable strip instead, fed by `ListListingsDto.featuredOnly` (round-robin'd by category, so
 * one boost-heavy category can't fill the whole rail either).
 *
 * Plain CSS scroll-snap, not a carousel library or client-side state — this is fundamentally "a
 * row the visitor can drag/swipe through," which `overflow-x-auto` already does on its own, on
 * both touch and a mouse wheel, with zero JS.
 */
export function FeaturedRail({ items }: { items: ListingCardDto[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5 mb-2.5 text-[13px] font-bold text-text">
        <Icon name="featured" filled className="text-gold" />
        Featured listings
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:thin] -mx-4 px-4 sm:mx-0 sm:px-0">
        {items.map((item) => (
          <div key={item.id} className="shrink-0 snap-start w-[250px] sm:w-[290px]">
            <ListingCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

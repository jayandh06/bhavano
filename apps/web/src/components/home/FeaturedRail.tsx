import type { ListingCardDto } from "@bhavano/types";
import { ListingCard } from "./ListingCard";
import { Icon } from "./Icon";
import { FeaturedRailScroller } from "./FeaturedRailScroller";

/**
 * A horizontal showcase of boosted listings above the main grid — a boosted listing's only
 * homepage-wide treatment used to be a badge plus a shot at the main feed's featured-cap slots
 * (`docs/plans/homepage-category-mix-and-boost-page-cap.md`), which still competes with
 * everything else for attention inside one grid. This gives every rail slot its own dedicated,
 * unmissable strip instead, fed by `ListListingsDto.featuredOnly` (round-robin'd by category, so
 * one boost-heavy category can't fill the whole rail either).
 *
 * The scroll itself is plain CSS scroll-snap (`overflow-x-auto`, below) — the edge fades and
 * arrow buttons live in FeaturedRailScroller, a separate client component, specifically so this
 * one stays server-rendered: every item's markup (title, price, link) is still real server HTML,
 * only the scroll chrome around it is client-side. See FeaturedRailScroller's own doc comment for
 * why desktop needed that chrome at all (people weren't noticing the row scrolls).
 */
export function FeaturedRail({ items }: { items: ListingCardDto[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5 mb-2.5 text-[13px] font-bold text-text">
        <Icon name="featured" filled className="text-gold" />
        Featured listings
      </div>
      <FeaturedRailScroller>
        {/* items-stretch (the flex default, stated explicitly rather than relied on) is what
          * makes every card match the row's tallest — ListingCard's own `fixedHeight` prop is
          * what lets each card actually fill that height instead of sitting at its natural size
          * inside a now-taller wrapper, with its own Contact button pinned to the bottom via
          * mt-auto rather than wherever its own (title-length-dependent) content happened to end. */}
        {items.map((item) => (
          <div key={item.id} className="shrink-0 snap-start w-[250px] sm:w-[290px]">
            <ListingCard item={item} fixedHeight />
          </div>
        ))}
      </FeaturedRailScroller>
    </div>
  );
}

import Link from "next/link";
import type { Area } from "@bhavano/types";
import { buildBrowseSeoCopy } from "@/lib/browseSeoCopy";
import type { ParsedSegments } from "@/lib/seoRoute";
import { fetchListingInventory } from "@/lib/bff";
import { buildBrowseInventory } from "@/lib/linkInventory";

/** Server-rendered locality SEO block — intro text and related internal links (see
 * docs/plans/seo-locality-landing-content.md). */
export async function BrowseSeoIntro({
  heading,
  cityName,
  areaName,
  segments,
  listingTotal,
  cityAreas,
  part,
}: {
  heading: string;
  cityName: string;
  areaName?: string;
  segments: ParsedSegments;
  listingTotal: number;
  cityAreas: Area[];
  /** Which half to render. The intro paragraphs belong above the results (they describe what the
   * page is); "Explore nearby" belongs below them, because it sends people *away* — putting a dozen
   * outbound links above the listings someone came to read buries the content under its own
   * navigation. Both halves are still server-rendered in the same document, so every link a
   * crawler followed before is still here, in the same place in the DOM order, just lower. */
  part: "intro" | "links";
}) {
  const { introParagraphs, relatedLinks } = buildBrowseSeoCopy({
    heading,
    cityName,
    areaName,
    segments,
    listingTotal,
    cityAreas,
  });

  if (part === "intro") {
    if (introParagraphs.length === 0) return null;
    return (
      <section className="mb-5 max-w-[720px]" aria-label="About this search">
        {introParagraphs.map((text, i) => (
          <p key={i} className="text-sm text-text-soft leading-relaxed m-0 mt-0 mb-2.5 last:mb-0">
            {text}
          </p>
        ))}
      </section>
    );
  }

  // Only link to pages that have listings: a link to an empty page is a link to a noindex page (docs/plans/seo-indexing-cleanup.md).
  // If the inventory cannot be read, keep every link rather than drop the block.
  const inventory = await fetchListingInventory().then(buildBrowseInventory).catch(() => null);
  const links = inventory ? relatedLinks.filter((link) => inventory.has(link.href)) : relatedLinks;
  if (links.length === 0) return null;

  return (
    <section className="mt-10 max-w-[720px]" aria-label="Explore nearby">
      <div className="text-[11px] font-bold text-muted mb-2">EXPLORE NEARBY</div>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-surface-alt border border-border rounded-[20px] px-3.5 py-[7px] text-[13px] text-text no-underline"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

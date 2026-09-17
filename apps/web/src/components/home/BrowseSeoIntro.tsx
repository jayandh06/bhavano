import Link from "next/link";
import type { Area } from "@bhavano/types";
import { buildBrowseSeoCopy } from "@/lib/browseSeoCopy";
import type { ParsedSegments } from "@/lib/seoRoute";

/** Server-rendered locality SEO block — intro text and related internal links (see
 * docs/plans/seo-locality-landing-content.md). */
export function BrowseSeoIntro({
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

  if (relatedLinks.length === 0) return null;

  return (
    <section className="mt-10 max-w-[720px]" aria-label="Explore nearby">
      <div className="text-[11px] font-bold text-muted mb-2">EXPLORE NEARBY</div>
      <div className="flex flex-wrap gap-2">
        {relatedLinks.map((link) => (
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

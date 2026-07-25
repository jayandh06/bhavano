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
}: {
  heading: string;
  cityName: string;
  areaName?: string;
  segments: ParsedSegments;
  listingTotal: number;
  cityAreas: Area[];
}) {
  const { introParagraphs, relatedLinks } = buildBrowseSeoCopy({
    heading,
    cityName,
    areaName,
    segments,
    listingTotal,
    cityAreas,
  });

  if (introParagraphs.length === 0 && relatedLinks.length === 0) return null;

  return (
    <section className="mb-5 max-w-[720px]" aria-label="About this search">
      {introParagraphs.map((text, i) => (
        <p key={i} className="text-sm text-text-soft leading-relaxed m-0 mt-0 mb-2.5 last:mb-0">
          {text}
        </p>
      ))}
      {relatedLinks.length > 0 && (
        <div className="mt-3.5">
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
        </div>
      )}
    </section>
  );
}

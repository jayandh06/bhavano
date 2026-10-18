import { JsonLd } from "@/components/JsonLd";
import { getAreaOverview } from "@/lib/areaOverviews";
import type { ParsedSegments } from "@/lib/seoRoute";

/** Server-rendered area overview, shown on the plain area page only (`/{city}/{area}`), below the
 * listings. Category and facet pages keep their own short intro and are not given this block, so
 * the overview does not compete with them. Renders nothing unless a reviewed overview exists. */
export function AreaOverview({
  cityName,
  areaName,
  segments,
}: {
  cityName: string;
  areaName?: string;
  segments: ParsedSegments;
}) {
  if (!areaName) return null;
  if (segments.transactionGroup || segments.category || segments.facetValue || segments.listingSlugId) return null;
  const overview = getAreaOverview(cityName, areaName);
  if (!overview) return null;

  return (
    <section className="mt-10 max-w-[720px]" aria-label={`About ${areaName}`}>
      <JsonLd
        data={{
          "@type": "FAQPage",
          mainEntity: overview.faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }}
      />
      <h2 className="font-lora text-[20px] font-semibold m-0 mb-2 text-text">
        About {areaName}, {cityName}
      </h2>
      {overview.about.map((text, i) => (
        <p key={i} className="text-sm text-text-soft leading-relaxed m-0 mb-2.5">
          {text}
        </p>
      ))}
      <h3 className="text-[15px] font-bold m-0 mt-5 mb-2 text-text">Getting around</h3>
      {overview.gettingAround.map((text, i) => (
        <p key={i} className="text-sm text-text-soft leading-relaxed m-0 mb-2.5">
          {text}
        </p>
      ))}
      <h3 className="text-[15px] font-bold m-0 mt-5 mb-2 text-text">Frequently asked questions</h3>
      <dl className="m-0 flex flex-col gap-3">
        {overview.faqs.map((f) => (
          <div key={f.question}>
            <dt className="text-sm font-bold text-text">{f.question}</dt>
            <dd className="text-sm text-text-soft leading-relaxed m-0 mt-1">{f.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

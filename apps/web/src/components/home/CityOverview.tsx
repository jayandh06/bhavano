import { JsonLd } from "@/components/JsonLd";
import { fetchPublishedCityOverview } from "@/lib/bff";
import type { ParsedSegments } from "@/lib/seoRoute";

/** Server-rendered city overview, shown on the plain city page only (`/{city}`), below the listings.
 * Area, category and facet pages keep their own intros, so the city text does not compete with
 * them. Renders nothing unless the city has a published (reviewed) overview, which is edited and
 * approved in the admin app (City overviews). */
export async function CityOverview({
  cityName,
  cityId,
  segments,
}: {
  cityName: string;
  cityId?: string;
  segments: ParsedSegments;
}) {
  if (!cityId) return null;
  if (segments.areaSlug || segments.transactionGroup || segments.category || segments.facetValue || segments.listingSlugId) return null;
  const overview = await fetchPublishedCityOverview(cityId);
  if (!overview) return null;

  return (
    <section className="mt-10 max-w-[720px]" aria-label={`About ${cityName}`}>
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
      <h2 className="font-lora text-[20px] font-semibold m-0 mb-2 text-text">About {cityName}</h2>
      {overview.about.map((text, i) => (
        <p key={i} className="text-sm text-text-soft leading-relaxed m-0 mb-2.5">
          {text}
        </p>
      ))}
      {overview.gettingAround.length > 0 && (
        <>
          <h3 className="text-[15px] font-bold m-0 mt-5 mb-2 text-text">Getting around</h3>
          {overview.gettingAround.map((text, i) => (
            <p key={i} className="text-sm text-text-soft leading-relaxed m-0 mb-2.5">
              {text}
            </p>
          ))}
        </>
      )}
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

import { fetchAreaPriceStats } from "@/lib/bff";
import type { ParsedSegments } from "@/lib/seoRoute";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Live asking-price figures for an area's apartments, on the plain area page only. Computed from our
 * own active listings, so each figure shows how many listings it comes from and the date. The BFF
 * returns null for a figure backed by too few listings, and the whole block is hidden when neither
 * figure exists. Plain text, no structured data: these are asking prices, not an offer. */
export async function AreaPrices({
  cityName,
  areaId,
  areaName,
  segments,
}: {
  cityName: string;
  areaId?: string;
  areaName?: string;
  segments: ParsedSegments;
}) {
  if (!areaId || !areaName) return null;
  if (segments.transactionGroup || segments.category || segments.facetValue || segments.listingSlugId) return null;
  const stats = await fetchAreaPriceStats(areaId);
  if (!stats || (!stats.salePricePerSqft && !stats.monthlyRent)) return null;
  const date = new Date(stats.asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <section className="mt-10 max-w-[720px]" aria-label={`Asking prices in ${areaName}`}>
      <h2 className="font-lora text-[20px] font-semibold m-0 mb-2 text-text">
        Asking prices in {areaName}, {cityName}
      </h2>
      <dl className="m-0 flex flex-wrap gap-x-8 gap-y-3">
        {stats.salePricePerSqft && (
          <div>
            <dt className="text-[13px] text-text-soft">Apartments for sale, median per sq ft</dt>
            <dd className="m-0 text-lg font-bold text-text">
              {rupees(stats.salePricePerSqft.median)}
              <span className="ml-2 text-xs font-normal text-text-soft">{stats.salePricePerSqft.count} listings</span>
            </dd>
          </div>
        )}
        {stats.monthlyRent && (
          <div>
            <dt className="text-[13px] text-text-soft">Apartments for rent, median per month</dt>
            <dd className="m-0 text-lg font-bold text-text">
              {rupees(stats.monthlyRent.median)}
              <span className="ml-2 text-xs font-normal text-text-soft">{stats.monthlyRent.count} listings</span>
            </dd>
          </div>
        )}
      </dl>
      <p className="text-xs text-text-soft m-0 mt-2">
        Median asking prices from active Bhavano listings, as of {date}. Asking prices are not sale prices.
      </p>
    </section>
  );
}

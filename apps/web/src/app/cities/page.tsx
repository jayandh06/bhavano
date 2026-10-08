import Link from "next/link";
import { StaticPageLayout } from "@/components/home/StaticPageLayout";
import { fetchCities } from "@/lib/bff";
import { buildBrowsePath } from "@/lib/listingPath";

export const metadata = {
  title: "Browse Cities — Bhavano",
  description: "Every city Bhavano covers for buying, renting, and leasing property across India.",
};

/** Every served city — the counterpart to the footer's "Browse Cities" block (which only shows
 * `isPopular` cities plus a link here), grouped by state, with the popular cities (the ones the ads
 * target) first. See docs/plans/seo-all-cities-footer-links.md,
 * docs/plans/serve-only-ad-targeted-cities.md and docs/plans/focus-on-ad-target-cities.md. */
export default async function CitiesPage() {
  const cities = (await fetchCities(undefined, true).catch(() => [])).filter((city) => city.isServed);
  const topCities = cities.filter((city) => city.isPopular).sort((a, b) => a.name.localeCompare(b.name));

  const byState = new Map<string, typeof cities>();
  for (const city of cities) {
    const list = byState.get(city.state) ?? [];
    list.push(city);
    byState.set(city.state, list);
  }
  const states = [...byState.entries()]
    .map(([state, list]) => [state, list.sort((a, b) => a.name.localeCompare(b.name))] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <StaticPageLayout title="Browse cities">
      <p className="m-0">
        {cities.length.toLocaleString()} cities across India — pick one to browse houses, apartments, villas, plots,
        PG accommodation, coworking desks and commercial spaces there.
      </p>
      {topCities.length > 0 && (
        <div>
          <h2 className="font-bold text-[15px] text-text m-0 mb-3">Top cities</h2>
          <div className="flex flex-wrap gap-2.5 text-[13px]">
            {topCities.map((city) => (
              <Link
                key={city.id}
                href={buildBrowsePath({ cityName: city.name })}
                prefetch={false}
                className="border border-border rounded-lg px-3 py-1.5 font-semibold"
              >
                {city.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      <h2 className="font-bold text-[15px] text-text m-0">All cities by state</h2>
      <div className="grid gap-8 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        {states.map(([state, stateCities]) => (
          <div key={state}>
            <div className="font-bold text-[13px] text-text mb-2.5">{state}</div>
            <div className="flex flex-col gap-2 text-[13px]">
              {stateCities.map((city) => (
                <Link key={city.id} href={buildBrowsePath({ cityName: city.name })} prefetch={false}>
                  {city.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </StaticPageLayout>
  );
}

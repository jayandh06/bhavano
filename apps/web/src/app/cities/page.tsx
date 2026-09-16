import Link from "next/link";
import { StaticPageLayout } from "@/components/home/StaticPageLayout";
import { fetchCities } from "@/lib/bff";
import { buildBrowsePath } from "@/lib/listingPath";

export const metadata = {
  title: "Browse Cities — Bhavano",
  description: "Every city Bhavano covers for buying, renting, and leasing property across India.",
};

/** The full-catalog counterpart to the footer's curated "Browse Cities" block (which only shows
 * `isPopular` cities plus a link here) — see docs/plans/seo-all-cities-footer-links.md. Grouped
 * by state rather than one flat list, since that's what actually makes a few hundred links
 * scannable instead of just long. */
export default async function CitiesPage() {
  const cities = await fetchCities(undefined, true).catch(() => []);

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
        PG accommodation, coworking desks, commercial spaces and furniture listings there.
      </p>
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

import Link from "next/link";
import type { Area, City } from "@bhavano/types";
import { fetchCities } from "@/lib/bff";
import { buildBrowsePath } from "@/lib/listingPath";

// Today's largest seeded city has 20 curated areas — this is a defensive ceiling against a
// future city accumulating far more user-added areas, not an active truncation.
const MAX_FOOTER_AREAS = 24;

const CITY_AREA_COLUMNS = 4;

/** Splits into at most `numColumns` roughly-even columns (fewer if there aren't enough items to
 * fill them) — used for the city/area list, which reads as one wide block of tightly-packed
 * sub-columns rather than separate footer sections. */
function chunkIntoColumns<T>(items: T[], numColumns: number): T[][] {
  if (items.length === 0) return [];
  const perColumn = Math.ceil(items.length / numColumns);
  const columns: T[][] = [];
  for (let i = 0; i < items.length; i += perColumn) columns.push(items.slice(i, i + perColumn));
  return columns;
}

/** Site-wide footer. The location block has two modes: every one of this city's areas when a
 * specific city is in context (any `/{city}/...` browse page), or every city when it isn't
 * (homepage, static/account pages) — both real `<Link>`s via `buildBrowsePath`, closing the gap
 * left by `sitemap.ts` (which only lists a city/area once it already has a listing) and by
 * `MegaMenu`/`LocationPicker` (which never produce crawlable links to a city/area on their own).
 * Laid out as a single flex row (not a uniform grid) so the city/area block — one heading over 4
 * tightly-spaced sub-columns — reads as one wide unit, distinct from the normal wider gap between
 * it and the Brand/Company/Legal sections either side. */
export async function Footer({
  currentCityName,
  cityAreas,
  allCities,
}: {
  /** Present on the `/{city}/...` browse pages — switches the location block to that city's
   * areas instead of the full city list. */
  currentCityName?: string;
  cityAreas?: Area[];
  /** Every city, for the no-specific-city case. Fetched here if the caller doesn't already have
   * it in scope, so every bare `<Footer />` call site still gets a populated location block. */
  allCities?: City[];
}) {
  const cities = currentCityName ? [] : (allCities ?? (await fetchCities(undefined, true).catch(() => [])));

  const locationHeading = currentCityName ? `Areas in ${currentCityName}` : "Browse Cities";
  const locationItems: { key: string; label: string; href: string }[] = currentCityName
    ? (cityAreas ?? [])
        .slice(0, MAX_FOOTER_AREAS)
        .map((area) => ({ key: area.id, label: area.name, href: buildBrowsePath({ cityName: currentCityName, areaName: area.name }) }))
    : cities.map((city) => ({ key: city.id, label: city.name, href: buildBrowsePath({ cityName: city.name }) }));
  const locationColumns = chunkIntoColumns(locationItems, CITY_AREA_COLUMNS);

  return (
    <section className="bg-surface-alt border-t border-border py-12 px-8">
      <div className="max-w-[1280px] mx-auto flex flex-wrap justify-between gap-8">
        <div className="max-w-[260px]">
          <div className="font-lora font-bold text-lg text-green mb-1.5">Bhavano</div>
          <p className="text-[13px] text-text-soft leading-[1.6] m-0">
            Verified listings to buy, rent or lease houses, apartments, coworking desks, PG accommodation and
            furniture across India — no login needed to browse.
          </p>
        </div>
        <div>
          <div className="font-bold text-[13px] text-text mb-2.5">{locationHeading}</div>
          <div className="flex gap-3">
            {locationColumns.map((column, i) => (
              <div key={i} className="flex flex-col gap-2 text-[13px]">
                {column.map((item) => (
                  <Link key={item.key} href={item.href}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="font-bold text-[13px] text-text mb-2.5">Company</div>
          <div className="flex flex-col gap-2 text-[13px]">
            <Link href="/post">Post a free ad</Link>
            <Link href="/help">Help centre</Link>
          </div>
        </div>
        <div>
          <div className="font-bold text-[13px] text-text mb-2.5">Legal</div>
          <div className="flex flex-col gap-2 text-[13px]">
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/contact">Contact Us</Link>
          </div>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto mt-8 pt-5 border-t border-border text-xs text-muted">
        © 2026 Bhavano. All rights reserved.
      </div>
    </section>
  );
}

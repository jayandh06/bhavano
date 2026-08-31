import Link from "next/link";
import type { Area, City } from "@bhavano/types";
import { ENTITY_TAGLINE, entityCopyright } from "@bhavano/types/legalEntity";
import { slugify } from "@bhavano/types/slugify";
import { fetchCities } from "@/lib/bff";
import { buildBrowsePath } from "@/lib/listingPath";

// Today's largest seeded city has 20 curated areas — this is a defensive ceiling against a
// future city accumulating far more user-added areas, not an active truncation. Cities are a
// fixed, admin-curated set (no user-growth path), so the city list itself is never capped.
const MAX_FOOTER_AREAS = 24;

const LOCATION_COLUMNS = 4;

/** Splits into at most `numColumns` roughly-even columns (fewer if there aren't enough items to
 * fill them) — used for the city/area lists, each of which reads as one wide block of
 * tightly-packed sub-columns rather than separate footer sections. */
function chunkIntoColumns<T>(items: T[], numColumns: number): T[][] {
  if (items.length === 0) return [];
  const perColumn = Math.ceil(items.length / numColumns);
  const columns: T[][] = [];
  for (let i = 0; i < items.length; i += perColumn) columns.push(items.slice(i, i + perColumn));
  return columns;
}

function LocationBlock({ heading, items }: { heading: string; items: { key: string; label: string; href: string }[] }) {
  if (items.length === 0) return null;

  const columns = (
    <div className="flex gap-3">
      {chunkIntoColumns(items, LOCATION_COLUMNS).map((column, i) => (
        <div key={i} className="flex flex-col gap-2 text-[13px]">
          {column.map((item) => (
            <Link key={item.key} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );

  // Two renders of the same links, one hidden per breakpoint — not one element whose open state
  // somehow differs by viewport, which plain HTML/CSS cannot express: <details>'s open/closed
  // state is a single boolean set once, so there is no way to have it start open on a wide
  // screen and closed on a narrow one without client JS measuring the viewport. Duplicating a
  // footer's worth of <a> tags is a real, known cost against page weight, but every link here
  // is static, server-rendered markup — not blocking JS — and it buys a toggle that needs none
  // either, which is the trade worth making for a list this size.
  //
  // Both copies carry the same links, so a crawler sees them in the DOM regardless of which is
  // visually hidden — the same footing Google already gives a "show more" accordion; this isn't
  // hiding a list from the crawler; it's controlling which of two identical menus a person sees.
  return (
    <div>
      <div className="hidden sm:block">
        <div className="font-bold text-[13px] text-text mb-2.5">{heading}</div>
        {columns}
      </div>
      <details className="sm:hidden group">
        <summary className="font-bold text-[13px] text-text mb-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5">
          {heading}
          <span className="text-[10px] text-muted transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-2.5">{columns}</div>
      </details>
    </div>
  );
}

/** Site-wide footer. On a `/{city}/...` browse page, shows **both** that city's areas (primary —
 * the more topically-relevant drill-down for someone already browsing that city, and the main
 * link source area pages have) **and** a full city list (secondary) — every page links to every
 * city hub, not just the homepage, so no city page is an internal-linking island reachable only
 * from Home (see docs/plans/seo-all-cities-footer-links.md). Elsewhere (homepage, static/account
 * pages), only the full city list applies. Both close the gap left by `sitemap.ts` (which only
 * lists a city/area once it already has a listing) and by `MegaMenu`/`LocationPicker` (which never
 * produce crawlable links to a city/area on their own). */
export async function Footer({
  currentCityName,
  cityAreas,
  allCities,
}: {
  /** Present on the `/{city}/...` browse pages — adds the "Areas in {City}" block above the
   * full city list, instead of the city list being the only location block. */
  currentCityName?: string;
  cityAreas?: Area[];
  /** Every city. Fetched here if the caller doesn't already have it in scope, so every bare
   * `<Footer />` call site still gets a populated location block. */
  allCities?: City[];
}) {
  const cities = allCities ?? (await fetchCities(undefined, true).catch(() => []));

  const areaItems = (cityAreas ?? [])
    .slice(0, MAX_FOOTER_AREAS)
    .map((area) => ({ key: area.id, label: area.name, href: buildBrowsePath({ cityName: currentCityName!, areaName: area.name }) }));
  // Excludes the current city — linking a city page to itself under "Browse Cities" would be a
  // no-op link a user (or crawler) has no reason to follow from a page already there.
  const cityItems = cities
    .filter((city) => city.name !== currentCityName)
    .map((city) => ({ key: city.id, label: city.name, href: buildBrowsePath({ cityName: city.name }) }));

  return (
    <section className="bg-surface-alt border-t border-border py-12 px-8">
      <div className="max-w-[1280px] mx-auto flex flex-wrap justify-between gap-8">
        <div className="max-w-[260px]">
          <div className="font-lora font-bold text-lg text-green mb-1.5">Bhavano</div>
          {/* Brand → legal entity link, on every page. DLT/telco header verification (and payment
              aggregator onboarding) rejects a site that names only the brand — see
              docs/plans/finfolia-entity-disclosure.md. */}
          <p className="text-[12.5px] text-text-soft leading-[1.6] m-0 mb-1.5">{ENTITY_TAGLINE}</p>
          <p className="text-[13px] text-text-soft leading-[1.6] m-0">
            Verified listings to buy, rent or lease houses, apartments, villas, plots, coworking desks, commercial
            spaces, PG accommodation and furniture across India — no login needed to browse.
          </p>
        </div>
        {currentCityName && <LocationBlock heading={`Areas in ${currentCityName}`} items={areaItems} />}
        <LocationBlock heading="Browse Cities" items={cityItems} />
        <div>
          <div className="font-bold text-[13px] text-text mb-2.5">Company</div>
          <div className="flex flex-col gap-2 text-[13px]">
            <Link href={currentCityName ? `/post?city=${slugify(currentCityName)}` : "/post"}>Post a free ad</Link>
            <Link href="/tools">Tools</Link>
            <Link href="/help">Help centre</Link>
            <Link href="/about">About us</Link>
          </div>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto mt-8 pt-5 border-t border-border flex flex-wrap items-center justify-between gap-4">
        <span className="text-xs text-muted">{entityCopyright(2026)}</span>
        <div className="flex gap-5 text-xs">
          <Link href="/about">About Us</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/contact">Contact Us</Link>
        </div>
      </div>
    </section>
  );
}

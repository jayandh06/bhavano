import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import type { ListingCategory, ListingDetailDto } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { auth } from "@/auth";
import { fetchAreas, fetchCities, fetchListingById, fetchListings } from "@/lib/bff";
import { sessionHeaderName } from "@/lib/session";
import { CATEGORY_LABELS, isListingCategory, isTransactionType, resolveArea, resolveCity } from "@/lib/browseRoute";
import { buildBrowsePath, buildListingPath } from "@/lib/listingPath";
import {
  buildFacetSlug,
  buildHeading,
  buildQueryForSegments,
  extractListingId,
  FURNISHING_VALUES,
  parseEnum,
  parseIntList,
  parsePage,
  parsePositiveInt,
  parseSegments,
  isReservedSegment,
  SORT_VALUES,
  transactionGroupFor,
  type ParsedSegments,
} from "@/lib/seoRoute";
import { BrowseListingsView } from "@/components/home/BrowseListingsView";
import { ListingDetailView } from "@/components/home/ListingDetailView";
import { JsonLd } from "@/components/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";

type RouteParams = { city: string; rest?: string[] };

/** Pre-restructuring URLs were /{transaction}/{category}/{city}/{locality}/{slug}-{id} — Next.js
 * doesn't allow two sibling top-level dynamic segments with different names (`[transaction]` vs
 * `[city]`), so rather than a separate route tree, a legacy URL is detected and redirected from
 * inside this same catch-all: its first segment is a raw TransactionType, never a real city slug. */
async function legacyRedirect(transaction: string, rest: string[]): Promise<never> {
  const [category, citySlug, locality, slugId] = rest;
  if (!isTransactionType(transaction)) notFound();
  if (!category || !isListingCategory(category) || !citySlug) notFound();

  if (slugId) {
    const listing = await fetchListingById(extractListingId(slugId)).catch(() => null);
    if (!listing) notFound();
    permanentRedirect(buildListingPath(listing));
  }

  const cityRow = await resolveCity(citySlug);
  if (!cityRow) notFound();
  const areaRow = locality ? await resolveArea(cityRow.id, locality) : null;
  if (locality && !areaRow) notFound();

  permanentRedirect(
    buildBrowsePath({ cityName: cityRow.name, transactionGroup: transactionGroupFor(transaction), category, areaName: areaRow?.name }),
  );
}

/** National browsing — `/buy`, `/rent-lease/pg`, `/furniture` — where the first segment is
 * reserved category vocabulary rather than a city slug.
 *
 * Returns null for anything that is not national, so the caller falls through to the city and
 * legacy branches untouched. Two rejections carry the weight:
 *
 * - **An area disqualifies it.** A locality only exists inside a city, so a parse that yields
 *   one is really the legacy `/{transaction}/{category}/{city}` shape — `/buy/apartment/bengaluru`
 *   parses as group+category+area and must keep 301ing, not render nationally.
 * - **A listing slug-id disqualifies it.** Every listing has a canonical URL under its own city.
 *
 * This ordering matters because "buy" is both a TransactionGroup and a TransactionType, so `/buy`
 * would otherwise be swallowed by `legacyRedirect` and 404. */
function nationalSegments(first: string, rest: string[]): ParsedSegments | null {
  if (!isReservedSegment(first)) return null;
  const parsed = parseSegments([first, ...rest]);
  if (!parsed || parsed.areaSlug || parsed.listingSlugId) return null;
  return parsed;
}

function headingFor(parsed: ParsedSegments, cityName: string, areaName?: string): string {
  const query = buildQueryForSegments(parsed);
  return buildHeading({
    // A group with no category is not "All Listings" — /buy and /bengaluru/buy are specifically
    // things for sale, and said so nowhere before this.
    fallbackLabel:
      parsed.transactionGroup === "buy"
        ? "Properties for Sale"
        : parsed.transactionGroup === "rent-lease"
          ? "Properties for Rent"
          : "All Listings",
    cityName,
    areaName,
    propertyType: query.propertyType,
    bedrooms: query.bedrooms?.[0],
    // buildQueryForSegments folds pg and interiors into `homeCategory` and drops `category`, so
    // /rent-lease/pg lost its label and read "All Listings". Fall back to the category from the
    // URL — but only when no narrower branch of buildHeading would have fired, since those read
    // better: a facet gives "PG Single Sharing", a propertyType gives "2 BHK Apartments".
    listingCategory: query.category ?? (parsed.facetValue === undefined && !query.propertyType ? parsed.category : undefined),
    transactionType: query.transactionType,
    sharingType: query.sharingType,
    condition: query.condition,
    serviceType: query.serviceType,
  });
}

/** The canonical browse path for this exact resolved depth, built fresh from the resolved city/
 * area/segments (not the raw requested path) — so a pre-migration, area-last URL that still
 * resolves (see `parseSegments`) always canonicalizes/redirects to the current area-first shape,
 * never to itself. Filtered query strings (?minPrice=.., ?furnished=..) layer on top of this same
 * clean path without changing it. */
function resolvedCanonicalPath(cityName: string, parsed: ParsedSegments, areaName?: string): string {
  return buildBrowsePath({
    cityName,
    transactionGroup: parsed.transactionGroup,
    category: parsed.category,
    facetValue: parsed.facetValue,
    areaName,
  });
}

function breadcrumbJsonLd(cityName: string, citySlug: string, parsed: ParsedSegments, areaName?: string) {
  const items: { name: string; path: string }[] = [{ name: cityName, path: `/${citySlug}` }];
  let path = `/${citySlug}`;

  if (areaName) {
    path += `/${slugify(areaName)}`;
    items.push({ name: areaName, path });
  }
  if (parsed.transactionGroup) {
    path += `/${parsed.transactionGroup}`;
    items.push({ name: parsed.transactionGroup === "buy" ? "Buy" : "Rent & Lease", path });
  }
  if (parsed.category) {
    path += `/${parsed.category}`;
    items.push({ name: CATEGORY_LABELS[parsed.category], path });
  }
  if (parsed.facetValue !== undefined && parsed.category) {
    path += `/${buildFacetSlug(parsed.category, parsed.facetValue)}`;
    items.push({ name: String(parsed.facetValue), path });
  }

  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

// Categories with real property/land, as opposed to rentable space, goods, or services — these
// get a location-aware `RealEstateListing` instead of the generic `Product` schema.
const REAL_ESTATE_CATEGORIES = new Set<ListingCategory>(["house", "apartment", "villa", "plot", "commercial"]);

// `attributes` values arrive as sanitized strings from PostAdWizard's number inputs, never numbers.
const SQFT_ATTRIBUTE_KEY: Partial<Record<ListingCategory, string>> = {
  house: "sqft",
  apartment: "sqft",
  villa: "sqft",
  commercial: "sqft",
  plot: "plotAreaSqft",
};

function numericAttribute(value: unknown): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function listingJsonLd(listing: ListingDetailDto) {
  const numericPrice = listing.price.replace(/[^\d]/g, "");
  const offers = {
    "@type": "Offer",
    price: numericPrice,
    priceCurrency: "INR",
    availability: listing.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    url: `${SITE_URL}${buildListingPath(listing)}`,
  };

  if (!REAL_ESTATE_CATEGORIES.has(listing.category)) {
    return {
      "@type": "Product",
      name: listing.title,
      description: listing.specs.join(", ") || listing.title,
      category: listing.category,
      image: listing.photosFull,
      offers,
    };
  }

  const sqftKey = SQFT_ATTRIBUTE_KEY[listing.category];
  const sqft = sqftKey ? numericAttribute(listing.attributes[sqftKey]) : undefined;
  const bedrooms = numericAttribute(listing.attributes.bedrooms);

  return {
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.specs.join(", ") || listing.title,
    url: offers.url,
    image: listing.photosFull,
    address: {
      "@type": "PostalAddress",
      addressLocality: listing.area,
      addressRegion: listing.cityName,
      addressCountry: "IN",
    },
    ...(listing.lat !== undefined && listing.lng !== undefined
      ? { geo: { "@type": "GeoCoordinates", latitude: listing.lat, longitude: listing.lng } }
      : {}),
    ...(bedrooms !== undefined ? { numberOfRooms: bedrooms } : {}),
    ...(sqft !== undefined ? { floorSize: { "@type": "QuantitativeValue", value: sqft, unitCode: "FTK" } } : {}),
    offers,
  };
}

/** The national counterpart of the city page body below. Deliberately a separate function rather
 * than threading `cityRow: City | null` through that one: the city branch resolves an area, builds
 * breadcrumb JSON-LD, canonicalises an area-first path and fetches that city's areas, none of
 * which mean anything without a city. Making all of it conditional is where SEO regressions hide.
 *
 * No breadcrumb JSON-LD and no SEO intro copy here on purpose — both are city-shaped — and these
 * routes stay out of sitemap.xml, so they are navigation rather than acquisition surfaces. */
async function NationalBrowsePage({
  parsed,
  requestedPath,
  searchParams,
}: {
  parsed: ParsedSegments;
  /** The path as asked for, so a non-canonical spelling can 301 the way the city branch does. */
  requestedPath: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Same canonical redirect the city branch does, and before any I/O: basePath depends only on
  // the parsed path, so resolving a session and the city list first would throw that work away on
  // every non-canonical request. Without this, /rent-lease/pg served a 200 beside /pg — the
  // self-canonical pointed Google at the right one, but two live URLs for identical content is a
  // weaker signal than one.
  const basePath = buildBrowsePath({
    transactionGroup: parsed.transactionGroup,
    category: parsed.category,
    facetValue: parsed.facetValue,
  });
  if (requestedPath !== basePath) permanentRedirect(basePath);

  const sp = await searchParams;
  const page = parsePage(sp.page);
  const minPrice = parsePositiveInt(sp.minPrice);
  const maxPrice = parsePositiveInt(sp.maxPrice);
  const furnished = parseEnum(sp.furnished, FURNISHING_VALUES);
  const sort = parseEnum(sp.sort, SORT_VALUES);
  const bedroomsFromQuery = parseIntList(sp.bedrooms);

  const session = await auth();
  const baseQuery = buildQueryForSegments(parsed);
  const allCities = await fetchCities(undefined, true);

  return (
    <BrowseListingsView
      query={{
        ...baseQuery,
        bedrooms: bedroomsFromQuery ?? baseQuery.bedrooms,
        minPrice,
        maxPrice,
        furnished,
        sort,
      }}
      heading={headingFor(parsed, "India")}
      page={page}
      basePath={basePath}
      filterCategory={parsed.category}
      filterIsSale={parsed.transactionGroup === "buy"}
      popularCities={allCities.filter((c) => c.isPopular)}
      userName={sessionHeaderName(session)}
      currentSegments={parsed}
      cityAreas={[]}
      allCities={allCities}
    />
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { city, rest = [] } = await params;

  // National routes self-canonicalise and are deliberately absent from sitemap.xml: they overlap
  // the /{city}/... pages that are the actual ranking strategy, so they exist to be navigated to,
  // not to compete for the same queries.
  const national = nationalSegments(city, rest);
  if (national) {
    const heading = headingFor(national, "India");
    const path = buildBrowsePath({
      transactionGroup: national.transactionGroup,
      category: national.category,
      facetValue: national.facetValue,
    });
    return {
      title: `${heading} | Bhavano`,
      description: `Browse ${heading.toLowerCase()} across every city on Bhavano. Post your own ad free — no brokerage.`,
      alternates: { canonical: path },
    };
  }

  if (isTransactionType(city)) return {};
  const cityRow = await resolveCity(city);
  if (!cityRow) return {};
  const parsed = parseSegments(rest);
  if (!parsed) return {};

  if (parsed.listingSlugId) {
    const listing = await fetchListingById(extractListingId(parsed.listingSlugId)).catch(() => null);
    if (!listing) return {};
    const canonicalPath = buildListingPath(listing);
    const description = `${listing.price} ${listing.priceQualifier} — ${listing.specs.join(", ") || listing.title} in ${listing.area}, ${listing.cityName}.`;
    return {
      title: listing.title,
      description,
      alternates: { canonical: canonicalPath },
      openGraph: { title: listing.title, description, images: listing.photosFull.slice(0, 1) },
      twitter: { title: listing.title, description },
    };
  }

  const areaRow = parsed.areaSlug ? await resolveArea(cityRow.id, parsed.areaSlug) : null;
  if (parsed.areaSlug && !areaRow) return {};

  const heading = headingFor(parsed, cityRow.name, areaRow?.name);

  // Count-driven description — matches the canonical (filter-stripped) page's actual result count,
  // since query-string filters (?minPrice=, ?furnished=, …) always collapse to this same canonical
  // URL (see `resolvedCanonicalPath` below) and never get their own indexable description.
  const baseQuery = buildQueryForSegments(parsed);
  const { total } = await fetchListings({ ...baseQuery, cityId: cityRow.id, areaId: areaRow?.id, limit: 1 }).catch(
    () => ({ total: 0, items: [], nextCursor: null }),
  );
  const description = total > 0 ? `${total} ${heading.toLowerCase()} on Bhavano.` : `Browse ${heading.toLowerCase()} on Bhavano.`;

  // Distinct-window pagination (docs/plans/seo-distinct-window-pagination.md): page 1 is the
  // clean canonical as before, but page N>1 is genuinely different content — self-canonical with
  // `?page=N` (not collapsed into page 1) so each page can be indexed independently. Filter query
  // strings (?minPrice=, ?furnished=, …) still collapse to the clean base path, unaffected.
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const canonicalBase = resolvedCanonicalPath(cityRow.name, parsed, areaRow?.name);
  const canonicalPath = page > 1 ? `${canonicalBase}?page=${page}` : canonicalBase;
  const title = page > 1 ? `${heading} — Page ${page}` : heading;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function CityBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { city, rest = [] } = await params;

  const national = nationalSegments(city, rest);
  if (national) {
    return NationalBrowsePage({
      parsed: national,
      requestedPath: `/${[city, ...rest].join("/")}`,
      searchParams,
    });
  }

  if (isTransactionType(city)) await legacyRedirect(city, rest);

  const cityRow = await resolveCity(city);
  if (!cityRow) notFound();

  const parsed = parseSegments(rest);
  if (!parsed) notFound();

  const session = await auth();

  if (parsed.listingSlugId) {
    const id = extractListingId(parsed.listingSlugId);
    const listing = await fetchListingById(id, session?.accessToken).catch(() => null);
    if (!listing) notFound();

    const canonicalPath = buildListingPath(listing);
    const requestedPath = `/${city}/${rest.join("/")}`;
    if (requestedPath !== canonicalPath) permanentRedirect(canonicalPath);

    const allCitiesForDetail = await fetchCities(undefined, true);

    return (
      <>
        <JsonLd data={breadcrumbJsonLd(cityRow.name, city, parsed, listing.area)} />
        <JsonLd data={listingJsonLd(listing)} />
        <ListingDetailView
          listing={listing}
          popularCities={allCitiesForDetail.filter((c) => c.isPopular)}
          userName={sessionHeaderName(session)}
          currentSegments={parsed}
        />
      </>
    );
  }

  const areaRow = parsed.areaSlug ? await resolveArea(cityRow.id, parsed.areaSlug) : null;
  if (parsed.areaSlug && !areaRow) notFound();

  // A pre-migration, area-last URL that still parses (see `parseSegments`) always redirects here
  // to the current area-first shape — the query string (minPrice/furnished/area/etc., handled
  // below) never affects this comparison, so filtered variants of an already-canonical path are
  // never redirected.
  const canonicalPath = resolvedCanonicalPath(cityRow.name, parsed, areaRow?.name);
  const requestedPath = `/${city}${rest.length ? `/${rest.join("/")}` : ""}`;
  if (requestedPath !== canonicalPath) permanentRedirect(canonicalPath);

  const sp = await searchParams;
  const page = parsePage(sp.page);
  const minPrice = parsePositiveInt(sp.minPrice);
  const maxPrice = parsePositiveInt(sp.maxPrice);
  const furnished = parseEnum(sp.furnished, FURNISHING_VALUES);
  const sort = parseEnum(sp.sort, SORT_VALUES);

  // The multi-select BHK filter (`?bedrooms=1,3,5`) — when present it wins over the single
  // bedroom bucket already resolved from the path facet (same precedence `areaIds` already has
  // over the path-based `areaId`), since it reflects a more specific, more recent user choice.
  const bedroomsFromQuery = parseIntList(sp.bedrooms);

  // Soft, best-effort locality filter for the search bar's "area in a city" case, which has no
  // path segment of its own once a category isn't also known — unlike `parsed.areaSlug` (a real
  // path segment), an unresolved `?area=` is silently ignored rather than a 404.
  const areaQueryParam = typeof sp.area === "string" ? sp.area : undefined;
  const areaRowFromQuery = !areaRow && areaQueryParam ? await resolveArea(cityRow.id, areaQueryParam).catch(() => null) : null;

  // `AreaFilter`'s multi-select — a comma-separated list of area ids (`?areas=`), distinct from
  // the single-locality `?area=`/path-based cases above. No resolution needed, these ids round-trip
  // straight into the backend's `areaIds` filter.
  const areasQueryParam = typeof sp.areas === "string" ? sp.areas : undefined;
  const areaIds = areasQueryParam ? areasQueryParam.split(",").filter(Boolean) : undefined;

  const baseQuery = buildQueryForSegments(parsed);
  const heading = headingFor(parsed, cityRow.name, areaRow?.name);
  const [allCities, cityAreas] = await Promise.all([fetchCities(undefined, true), fetchAreas(cityRow.id, undefined, true)]);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(cityRow.name, city, parsed, areaRow?.name)} />
      <BrowseListingsView
        query={{
          ...baseQuery,
          cityId: cityRow.id,
          areaId: areaRow?.id ?? areaRowFromQuery?.id,
          areaIds,
          bedrooms: bedroomsFromQuery ?? baseQuery.bedrooms,
          minPrice,
          maxPrice,
          furnished,
          sort,
        }}
        cityName={cityRow.name}
        heading={heading}
        page={page}
        basePath={canonicalPath}
        filterCategory={parsed.category}
        filterIsSale={parsed.transactionGroup === "buy"}
        popularCities={allCities.filter((c) => c.isPopular)}
        userName={sessionHeaderName(session)}
        currentSegments={parsed}
        pathAreaName={areaRow?.name}
        areaName={areaRow?.name ?? cityAreas[0]?.name}
        cityAreas={cityAreas}
        allCities={allCities}
      />
    </>
  );
}

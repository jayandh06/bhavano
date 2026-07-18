import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import type { ListingDetailDto } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { auth } from "@/auth";
import { fetchListingById } from "@/lib/bff";
import { CATEGORY_LABELS, isListingCategory, isTransactionType, resolveArea, resolveCity } from "@/lib/browseRoute";
import { buildBrowsePath, buildListingPath } from "@/lib/listingPath";
import {
  buildFacetSlug,
  buildHeading,
  buildQueryForSegments,
  extractListingId,
  FURNISHING_VALUES,
  parseEnum,
  parsePositiveInt,
  parseSegments,
  transactionGroupFor,
  type ParsedSegments,
} from "@/lib/seoRoute";
import { BrowseListingsView } from "@/components/home/BrowseListingsView";
import { ListingDetailView } from "@/components/home/ListingDetailView";
import { JsonLd } from "@/components/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

async function headingFor(parsed: ParsedSegments, cityName: string, cityId: string): Promise<string> {
  const query = buildQueryForSegments(parsed);
  const areaRow = parsed.areaSlug ? await resolveArea(cityId, parsed.areaSlug) : null;
  return buildHeading({
    fallbackLabel: "All Listings",
    cityName,
    areaName: areaRow?.name,
    propertyType: query.propertyType,
    bedrooms: query.bedrooms,
    listingCategory: query.category,
    transactionType: query.transactionType,
    sharingType: query.sharingType,
    condition: query.condition,
    serviceType: query.serviceType,
  });
}

/** The canonical browse path for this exact resolved depth — filtered query-string variants
 * (?minPrice=.., ?furnished=..) all canonicalize back to this same clean path. */
function canonicalBrowsePath(city: string, rest: string[]): string {
  return `/${city}${rest.length ? `/${rest.join("/")}` : ""}`;
}

function breadcrumbJsonLd(cityName: string, citySlug: string, parsed: ParsedSegments, areaName?: string) {
  const items: { name: string; path: string }[] = [{ name: cityName, path: `/${citySlug}` }];
  let path = `/${citySlug}`;

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
  if (areaName) {
    path += `/${slugify(areaName)}`;
    items.push({ name: areaName, path });
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

function listingJsonLd(listing: ListingDetailDto) {
  const numericPrice = listing.price.replace(/[^\d]/g, "");
  return {
    "@type": "Product",
    name: listing.title,
    description: listing.specs.join(", ") || listing.title,
    category: listing.category,
    image: listing.photosFull,
    offers: {
      "@type": "Offer",
      price: numericPrice,
      priceCurrency: "INR",
      availability: listing.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      url: `${SITE_URL}${buildListingPath(listing)}`,
    },
  };
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { city, rest = [] } = await params;
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

  const heading = await headingFor(parsed, cityRow.name, cityRow.id);
  const description = `Browse ${heading.toLowerCase()} on Bhavano.`;
  return {
    title: heading,
    description,
    alternates: { canonical: canonicalBrowsePath(city, rest) },
    openGraph: { title: heading, description },
    twitter: { title: heading, description },
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

    return (
      <>
        <JsonLd data={breadcrumbJsonLd(cityRow.name, city, parsed, listing.area)} />
        <JsonLd data={listingJsonLd(listing)} />
        <ListingDetailView listing={listing} />
      </>
    );
  }

  const areaRow = parsed.areaSlug ? await resolveArea(cityRow.id, parsed.areaSlug) : null;
  if (parsed.areaSlug && !areaRow) notFound();

  const sp = await searchParams;
  const pageRaw = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const minPrice = parsePositiveInt(sp.minPrice);
  const maxPrice = parsePositiveInt(sp.maxPrice);
  const furnished = parseEnum(sp.furnished, FURNISHING_VALUES);

  const baseQuery = buildQueryForSegments(parsed);
  const heading = await headingFor(parsed, cityRow.name, cityRow.id);
  const basePath = canonicalBrowsePath(city, rest);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(cityRow.name, city, parsed, areaRow?.name)} />
      <BrowseListingsView
        query={{ ...baseQuery, cityId: cityRow.id, areaId: areaRow?.id, minPrice, maxPrice, furnished }}
        cityName={cityRow.name}
        heading={heading}
        page={page}
        basePath={basePath}
        filterCategory={parsed.category}
        filterIsSale={parsed.transactionGroup === "buy"}
      />
    </>
  );
}

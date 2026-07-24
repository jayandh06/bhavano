import Image from "next/image";
import Link from "next/link";
import type { City, ListingDetailDto } from "@bhavano/types";
import { homeCategoryForSegments, type ParsedSegments } from "@/lib/seoRoute";
import { Header } from "./Header";
import { ListingDetailActions } from "./ListingDetailActions";
import { ViewTracker } from "./ViewTracker";

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/** A plain cached image, not the interactive Maps JavaScript API — this page is by far the
 * highest-traffic surface in the product, so cost here scales with page *views*, unlike the
 * posting flow's map which loads once per post. `listing.lat`/`lng` are already a jittered
 * approximation of the seller's real pin (computed server-side in ListingsService), never the
 * exact location — see docs/plans/google-maps-location-picker.md. Same NEXT_PUBLIC_ key as the
 * posting flow's map; enable "Maps Static API" alongside "Maps JavaScript API" for it in Google
 * Cloud Console. */
function staticMapUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: "15",
    size: "880x220",
    markers: `color:0x0b3d2e|${lat},${lng}`,
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY ?? "",
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** Plain Google Maps URL scheme (no API key involved) — omitting `origin` tells Google Maps to
 * route from the visitor's current location, prompting for geolocation permission itself. */
function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** The full listing-detail page body — shared by the SEO catch-all route so it renders
 * identically regardless of which URL depth resolved to this listing. */
export function ListingDetailView({
  listing,
  popularCities,
  userName,
  currentSegments,
}: {
  listing: ListingDetailDto;
  popularCities: City[];
  userName?: string | null;
  currentSegments: ParsedSegments;
}) {
  const attributeEntries = Object.entries(listing.attributes);

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header
        cityName={listing.cityName}
        popularCities={popularCities}
        searchQuery=""
        activeCategory={homeCategoryForSegments(currentSegments)}
        userName={userName}
        currentSegments={currentSegments}
        areaName={listing.area}
      />
      <ViewTracker listingId={listing.id} />
      <div className="max-w-[880px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>

        <div
          className={`relative h-[320px] rounded-2xl overflow-hidden flex items-center justify-center ${
            listing.photosFull.length > 1 ? "mb-2.5" : "mb-6"
          }`}
          // Dynamic per-listing placeholder gradient stays inline — it's data, not a static style.
          style={
            listing.photosFull[0]
              ? undefined
              : {
                  background: `repeating-linear-gradient(135deg, ${listing.imgColors[0]}, ${listing.imgColors[0]} 14px, ${listing.imgColors[1]} 14px, ${listing.imgColors[1]} 28px)`,
                }
          }
        >
          {listing.photosFull[0] && (
            <Image
              src={listing.photosFull[0]}
              alt={listing.title}
              fill
              priority
              sizes="(max-width: 880px) 100vw, 880px"
              className="object-cover"
            />
          )}
          {listing.photosFull.length === 0 && (
            <span className="font-mono text-[13px] text-[#ffffffcc] bg-[#00000030] px-3 py-1.5 rounded-md">
              {listing.imgLabel}
            </span>
          )}
          <span className="absolute top-4 left-4 bg-green text-on-green text-xs font-bold px-3 py-[5px] rounded-md">
            {listing.tag}
          </span>
          {listing.isExpired && (
            <span className="absolute top-4 right-4 bg-[#242420] text-[#F5F1E6] text-xs font-bold px-3 py-[5px] rounded-md">
              Expired
            </span>
          )}
        </div>

        {listing.photosFull.length > 1 && (
          <div className="flex gap-2.5 mb-6 overflow-x-auto">
            {listing.photosFull.map((photoUrl, i) => (
              <Image
                key={photoUrl}
                src={photoUrl}
                alt={`${listing.title} photo ${i + 1}`}
                width={80}
                height={80}
                className="object-cover rounded-lg shrink-0"
              />
            ))}
          </div>
        )}

        <div className="flex justify-between items-start gap-4 mb-2">
          <div className="font-lora text-[28px] font-bold text-green">{listing.price}</div>
          {listing.priceQualifier && (
            <div className="text-[13px] font-bold text-muted bg-surface-alt px-3 py-[5px] rounded-md whitespace-nowrap">
              {listing.priceQualifier}
            </div>
          )}
        </div>

        <h1 className="font-lora text-[22px] font-semibold m-0 mb-2">{listing.title}</h1>
        <div className="text-sm text-muted mb-2">
          📍 {listing.area}, {listing.cityName}
        </div>
        {listing.lat !== undefined && listing.lng !== undefined && (
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={staticMapUrl(listing.lat, listing.lng)}
              alt={`Approximate location of ${listing.title}`}
              className="w-full h-[180px] object-cover rounded-xl"
            />
            <a
              href={directionsUrl(listing.lat, listing.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-[13px] font-semibold text-green"
            >
              🧭 Get directions
            </a>
          </div>
        )}
        <div className="text-xs text-muted mb-4 flex gap-3.5">
          <span>👁 {listing.viewCount} views</span>
          <span>{listing.isExpired ? "Expired" : `Expires in ${daysUntil(listing.expiresAt)} days`}</span>
        </div>

        <div className="flex gap-4 flex-wrap mb-6">
          {listing.specs.map((spec) => (
            <span key={spec} className="text-[13px] font-semibold text-text-soft bg-surface-alt px-3 py-1.5 rounded-md">
              {spec}
            </span>
          ))}
        </div>

        {attributeEntries.length > 0 && (
          <div className="border border-border rounded-xl p-5 mb-6 bg-surface">
            <div className="font-bold text-sm mb-3">Details</div>
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
              {attributeEntries.map(([key, value]) => (
                <div key={key} className="text-[13px] text-text-soft">
                  <span className="capitalize font-semibold">{key}</span>: {String(value)}
                </div>
              ))}
            </div>
          </div>
        )}

        {listing.isExpired ? (
          <p className="text-[13px] text-muted">This ad has expired and is no longer accepting responses.</p>
        ) : (
          <>
            <span className="text-xs text-muted block mb-3">Ads shown without login — sign in only to respond</span>
            <ListingDetailActions
              listingId={listing.id}
              initialIsFavourited={listing.isFavourited}
              initialLikeCount={listing.likeCount}
            />
          </>
        )}
      </div>
    </div>
  );
}

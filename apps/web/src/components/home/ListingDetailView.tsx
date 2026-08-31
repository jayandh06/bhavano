import Link from "next/link";
import type { City, ListingDetailDto } from "@bhavano/types";
import {
  CATEGORY_FIELD_CONFIG,
  fieldIsVisible,
  groupFieldsBySection,
} from "@bhavano/types/categoryFields";
import { resolveDefaultCity } from "@/lib/defaultCity";
import { daysUntil } from "@/lib/listingExpiry";
import { Header } from "./Header";
import { ListingDetailActions } from "./ListingDetailActions";
import { ListingMediaGallery } from "./ListingMediaGallery";
import { ViewTracker } from "./ViewTracker";
import { Icon, isIconName } from "./Icon";

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
export async function ListingDetailView({
  listing,
  popularCities,
  allCities,
  userName,
}: {
  listing: ListingDetailDto;
  popularCities: City[];
  /** Needed to resolve the *viewer's* city — see the header below. */
  allCities: City[];
  userName?: string | null;
}) {
  const attributes = listing.attributes as Record<string, string | string[]>;
  // A field's stored value only makes sense to show once its `dependsOn` condition (if any) is
  // currently met — e.g. a brokerage fee shouldn't display for a listing where "posted by
  // broker" has since been edited back to "no". Same visibility rule the posting/edit forms use
  // (see `fieldIsVisible` in @bhavano/types/categoryFields), so all three agree. Amenities are
  // additionally dropped when "no" — they read as a badge list of what the place *has*, so a
  // present-but-negative flag (e.g. "🏊 Swimming pool: No") would just be noise here, unlike on
  // the posting/edit forms where every amenity needs to stay editable either way.
  const visibleFields = CATEGORY_FIELD_CONFIG[listing.category].filter((field) => {
    if (!(field.key in attributes)) return false;
    if (!fieldIsVisible(field, listing.transactionType, attributes)) return false;
    if (field.section === "amenities" && attributes[field.key] !== "yes") return false;
    return true;
  });
  const displaySections = groupFieldsBySection(visibleFields);

  // The header describes where the *visitor* is browsing, not where this listing happens to be.
  // It used to take both from the listing, so opening an Ahmedabad flat while browsing all
  // cities left the chip reading "Showing ads near Ahmedabad" and the Rent & Lease tab active —
  // a browsing context the visitor never chose. It is also literally untrue: on a detail page
  // nobody is being shown ads near anywhere. The listing's own location is stated in the body,
  // under the title, where it belongs.
  const viewerCity = await resolveDefaultCity(allCities);

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header
        cityName={viewerCity?.name}
        popularCities={popularCities}
        searchQuery=""
        activeCategory="all"
        userName={userName}
        areaName={listing.area}
      />
      <ViewTracker listingId={listing.id} />
      {/* 1280px, the same container as the header above it and every browse page — this was the
        * one page at 880, which read as the content being indented relative to its own header.
        *
        * The extra width goes to a second column rather than to the prose. Widening a single
        * column to 1280 would give a 100+ character measure and a hero cropped to a letterbox;
        * the space was empty on the right, so that is where the respond panel now lives. The main
        * column ends up about the width it already was, which is the point — the layout stopped
        * wasting the right half, it did not stretch the text.
        *
        * minmax(0,1fr), not 1fr: a grid item defaults to min-width:auto and refuses to shrink
        * below its content, so a long unbroken title would otherwise push the sidebar off. */}
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <div className="min-w-0">
            <ListingMediaGallery
              photosFull={listing.photosFull}
              videos={listing.videos}
              title={listing.title}
              tag={listing.tag}
              isExpired={listing.isExpired}
              imgColors={listing.imgColors}
              imgLabel={listing.imgLabel}
            >
              {/* Passed as children so the thumbnail strip renders below this rather than pinned
                * under the hero — the strip and the hero share a selected index, so they have to stay
                * in one component even though the page wants something between them. */}
              <div className="flex justify-between items-start gap-4 mb-2">
                <div className="font-lora text-[28px] font-bold text-green">
                  {listing.price}
                </div>
                {listing.priceQualifier && (
                  <div className="text-[13px] font-bold text-muted bg-surface-alt px-3 py-[5px] rounded-md whitespace-nowrap">
                    {listing.priceQualifier}
                  </div>
                )}
              </div>

              <h1 className="font-lora text-[22px] font-semibold m-0 mb-2">
                {listing.title}
              </h1>
              <div className="text-sm text-muted mb-3">
                <Icon name="pin" /> {listing.area}, {listing.cityName}
              </div>
            </ListingMediaGallery>
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
                  <Icon name="compass" /> Get directions
                </a>
              </div>
            )}
            <div className="text-xs text-muted mb-4 flex gap-3.5">
              <span className="flex items-center gap-1"><Icon name="eye" /> {listing.viewCount} views</span>
              <span>
                {listing.isExpired
                  ? "Expired"
                  : `Expires in ${daysUntil(listing.expiresAt)} days`}
              </span>
          </div>

          {listing.description && (
            // whitespace-pre-line so the paragraph breaks the seller typed survive. They wrote it
            // in a textarea; collapsing it into one block loses the shape they gave it.
            <div className="text-sm text-text-soft leading-[1.6] whitespace-pre-line mb-6">
              {listing.description}
            </div>
          )}

          {/* No chip row here. It repeated what the labelled sections below already say — a
            * "3bhk" chip a few hundred pixels above "Bedrooms: 3", in the seller's spelling
            * rather than the app's. The chips exist for the card, which renders none of this. */}

          {visibleFields.length > 0 && (
            <div className="flex flex-col gap-3 mb-6">
              {displaySections.map(({ section, label, fields }) => (
                <div
                  key={section}
                  className="border border-border rounded-xl p-5 bg-surface"
                >
                  <div className="font-bold text-sm mb-3">{label}</div>
                  {section === "amenities" ? (
                    // Amenities read as a badge list of what's present, not a label/value pair —
                    // every entry here already passed the "yes" filter above, so the icon + name
                    // alone says everything the value would have.
                    <div className="flex flex-wrap gap-2">
                      {fields.map((field) => (
                        <span
                          key={field.key}
                          className="text-[13px] font-semibold text-text-soft bg-surface-alt px-3 py-1.5 rounded-md"
                        >
                          {isIconName(field.iconName) && <Icon name={field.iconName} className="mr-1.5 text-muted" />}
                          {field.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="grid [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
                      {fields.map((field) => (
                        <div key={field.key} className="text-[13px] text-text-soft">
                          <span className="font-semibold">
                            {isIconName(field.iconName) && <Icon name={field.iconName} className="mr-1.5 text-muted" />}
                            {field.label}
                          </span>
                          : {formatAttributeValue(attributes[field.key])}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>

          {/* Card styling only from lg: below that this is still the plain run of content at the
            * bottom of the page it has always been, in the same order. A phone was never the
            * problem here — 880px does not constrain a 390px screen — so nothing changes. */}
          <aside className="lg:border lg:border-border lg:rounded-2xl lg:p-5 lg:bg-surface">
            {listing.isExpired ? (
              <p className="text-[13px] text-muted">
                This ad has expired and is no longer accepting responses.
              </p>
            ) : (
              <>
                {/* The sign-in nudge is for people who might respond — pointless on your own ad. */}
                {!listing.isOwner && (
                  <span className="text-xs text-muted block mb-3">
                    Ads shown without login — sign in only to respond
                  </span>
                )}
                <ListingDetailActions
                  listingId={listing.id}
                  initialIsFavourited={listing.isFavourited}
                  initialLikeCount={listing.likeCount}
                  isOwner={listing.isOwner}
                />
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function formatAttributeValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return String(value);
}

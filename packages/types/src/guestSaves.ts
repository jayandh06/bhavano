import type { ListingCardDto } from "./index";

/** Listings a logged-out visitor saved on this device, newest first, synced to their account on
 * login. Web keeps them in localStorage, the app in AsyncStorage, under the same key. See
 * docs/plans/more-login-conversion.md. */
export const GUEST_SAVES_KEY = "bhavano.guestSaves";
/** Matches the BFF's ImportFavouritesDto cap. */
export const GUEST_SAVES_MAX = 30;

/** The card fields only, so a detail response doesn't drag its description and galleries into
 * storage, and nothing viewer-specific (contact, ownership) is kept. */
export function toGuestSave(listing: ListingCardDto): ListingCardDto {
  return {
    id: listing.id,
    category: listing.category,
    transactionType: listing.transactionType,
    slug: listing.slug,
    tag: listing.tag,
    price: listing.price,
    priceInWords: listing.priceInWords,
    totalPrice: listing.totalPrice ?? null,
    priceQualifier: listing.priceQualifier,
    priceOnRequest: listing.priceOnRequest,
    title: listing.title,
    area: listing.area,
    cityName: listing.cityName,
    specs: listing.specs,
    imgLabel: listing.imgLabel,
    imgColors: listing.imgColors,
    photos: listing.photos.slice(0, 1),
    viewCount: listing.viewCount,
    likeCount: listing.likeCount,
    isFavourited: true,
    isBoosted: listing.isBoosted,
    hasInstantAlerts: false,
    hasVideo: listing.hasVideo,
    postedBy: listing.postedBy,
    postedByAgency: listing.postedByAgency,
    postedByReraVerified: listing.postedByReraVerified,
    isOwner: false,
    ownerUnverified: listing.ownerUnverified,
    contactRevealed: false,
    ownerPhone: null,
    ownerEmail: null,
  };
}

export function parseGuestSaves(raw: string | null): ListingCardDto[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ListingCardDto =>
        !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string",
    );
  } catch {
    return [];
  }
}

/** The list with `listing` saved (moved to the front if already there), capped at the newest. */
export function withGuestSave(list: ListingCardDto[], listing: ListingCardDto): ListingCardDto[] {
  return [toGuestSave(listing), ...list.filter((item) => item.id !== listing.id)].slice(0, GUEST_SAVES_MAX);
}

export function withoutGuestSave(list: ListingCardDto[], listingId: string): ListingCardDto[] {
  return list.filter((item) => item.id !== listingId);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GUEST_SAVES_MAX = exports.GUEST_SAVES_KEY = void 0;
exports.toGuestSave = toGuestSave;
exports.parseGuestSaves = parseGuestSaves;
exports.withGuestSave = withGuestSave;
exports.withoutGuestSave = withoutGuestSave;
/** Listings a logged-out visitor saved on this device, newest first, synced to their account on
 * login. Web keeps them in localStorage, the app in AsyncStorage, under the same key. See
 * docs/plans/more-login-conversion.md. */
exports.GUEST_SAVES_KEY = "bhavano.guestSaves";
/** Matches the BFF's ImportFavouritesDto cap. */
exports.GUEST_SAVES_MAX = 30;
/** The card fields only, so a detail response doesn't drag its description and galleries into
 * storage, and nothing viewer-specific (contact, ownership) is kept. */
function toGuestSave(listing) {
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
function parseGuestSaves(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter((item) => !!item && typeof item === "object" && typeof item.id === "string");
    }
    catch {
        return [];
    }
}
/** The list with `listing` saved (moved to the front if already there), capped at the newest. */
function withGuestSave(list, listing) {
    return [toGuestSave(listing), ...list.filter((item) => item.id !== listing.id)].slice(0, exports.GUEST_SAVES_MAX);
}
function withoutGuestSave(list, listingId) {
    return list.filter((item) => item.id !== listingId);
}

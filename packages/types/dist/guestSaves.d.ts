import type { ListingCardDto } from "./index";
/** Listings a logged-out visitor saved on this device, newest first, synced to their account on
 * login. Web keeps them in localStorage, the app in AsyncStorage, under the same key. See
 * docs/plans/more-login-conversion.md. */
export declare const GUEST_SAVES_KEY = "bhavano.guestSaves";
/** Matches the BFF's ImportFavouritesDto cap. */
export declare const GUEST_SAVES_MAX = 30;
/** The card fields only, so a detail response doesn't drag its description and galleries into
 * storage, and nothing viewer-specific (contact, ownership) is kept. */
export declare function toGuestSave(listing: ListingCardDto): ListingCardDto;
export declare function parseGuestSaves(raw: string | null): ListingCardDto[];
/** The list with `listing` saved (moved to the front if already there), capped at the newest. */
export declare function withGuestSave(list: ListingCardDto[], listing: ListingCardDto): ListingCardDto[];
export declare function withoutGuestSave(list: ListingCardDto[], listingId: string): ListingCardDto[];

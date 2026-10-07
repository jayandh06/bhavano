/** Whether a listing is currently boosted — `Listing.boostedUntil` is denormalized from
 * `ListingBoost` (the audit-trail model) specifically so this never needs a join. `now` defaults
 * to the current time but can be passed explicitly when checking a whole batch against one
 * shared timestamp (see `AdminService`'s notification-sending loop). */
export function isListingBoosted(listing: { boostedUntil: Date | null }, now: number = Date.now()): boolean {
  return (listing.boostedUntil?.getTime() ?? 0) > now;
}

import type { ListingSlotCapErrorBody } from "@bhavano/types/listingSlots";

export class ListingSlotCapError extends Error {
  readonly body: ListingSlotCapErrorBody;

  constructor(body: ListingSlotCapErrorBody) {
    super(body.message);
    this.name = "ListingSlotCapError";
    this.body = body;
  }
}

export function isListingSlotCapErrorBody(value: unknown): value is ListingSlotCapErrorBody {
  if (!value || typeof value !== "object") return false;
  const v = value as ListingSlotCapErrorBody;
  return v.code === "LISTING_SLOT_CAP_REACHED" && typeof v.activeCount === "number";
}

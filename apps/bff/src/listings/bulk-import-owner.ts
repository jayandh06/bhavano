/** Phone of the system account that bulk_upload_listings.py, OutreachService.createListingFromContact
 * and admin-assisted posting create listings under, until the real owner claims them. Same value as
 * apps/bff/prisma/seedBulkImportOwner.ts. Nobody answers this number. */
export const BULK_IMPORT_OWNER_PHONE = '9000000002';

/** Shown instead of a contact reveal or a first message on a listing still owned by the Bulk Import
 * account: the business hasn't claimed it, so nobody would receive either. */
export const OWNER_UNVERIFIED_MESSAGE =
  "The owner hasn't verified this listing yet, so they can't be contacted through Bhavano.";

export function isBulkImportOwner(
  owner: { phone: string | null } | null | undefined,
): boolean {
  return owner?.phone === BULK_IMPORT_OWNER_PHONE;
}

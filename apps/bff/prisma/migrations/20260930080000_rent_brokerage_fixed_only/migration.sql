-- Rent and lease brokerage is now always a fixed ₹ amount; the fixed / % question is asked on sales
-- only (see BROKERAGE_FIELDS in packages/types/src/categoryFields.ts). Drop the type from rent and
-- lease listings, where the field no longer exists. None of them holds a % (checked 2026-09-30).
-- Data only, no schema change.
UPDATE "Listing"
SET attributes = attributes - 'brokerageFeeType'
WHERE "transactionType" IN ('rent', 'lease')
  AND attributes ? 'brokerageFeeType';

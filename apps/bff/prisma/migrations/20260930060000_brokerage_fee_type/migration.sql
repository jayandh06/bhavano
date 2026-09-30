-- Brokerage is now quoted as either a fixed ₹ amount or a % of the total value, chosen first via
-- `brokerageFeeType` (see BROKERAGE_FIELDS in packages/types/src/categoryFields.ts). Listings stored
-- before that question existed hold exactly one of the two amounts; record which one, so they
-- stay valid and display their amount on the next edit. Data only, no schema change.
UPDATE "Listing"
SET attributes = attributes || '{"brokerageFeeType": "fixed"}'::jsonb
WHERE attributes->>'brokerageFeeApplicable' = 'yes'
  AND NOT (attributes ? 'brokerageFeeType')
  AND attributes ? 'brokerageFee';

UPDATE "Listing"
SET attributes = attributes || '{"brokerageFeeType": "percent"}'::jsonb
WHERE attributes->>'brokerageFeeApplicable' = 'yes'
  AND NOT (attributes ? 'brokerageFeeType')
  AND attributes ? 'brokerageCommissionPercent';

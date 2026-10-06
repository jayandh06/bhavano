-- AlterTable: purely additive, nullable — see docs/plans/boost-proof-stat-and-value-bands.md.
-- Every existing BoostPriceSetting row (there is exactly one, the singleton settings row) gets
-- NULL here, which boostPriceFor's application-level fallback treats identically to "no bands
-- configured for this category/transactionType" — zero pricing change for anyone until an admin
-- explicitly sets this via the new settings UI.
ALTER TABLE "BoostPriceSetting" ADD COLUMN "valueBandRules" JSONB;
